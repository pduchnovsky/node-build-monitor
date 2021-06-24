var request = require('../requests');
const async = require('async');

module.exports = function () {
    var self = this,
        makeUrlDeployment = function () {
            return 'https://api.bitbucket.org/2.0/repositories/' + (self.configuration.teamname || self.configuration.username) + '/' + self.configuration.slug + '/deployments/?sort=-state.started_on&pagelen=1&environment=' + self.configuration.envUUID;
        },
        makeUrlPipeline = function (pipelineUUID) {
          return 'https://api.bitbucket.org/2.0/repositories/' + (self.configuration.teamname || self.configuration.username) + '/' + self.configuration.slug + '/pipelines/' + pipelineUUID;
      },
        makeBasicAuthToken = function() {
            return Buffer.from(self.configuration.username + ':' + self.configuration.apiKey).toString('base64');
        },
        makeRequest = function (url, callback) {
          request.makeRequest({
            url: url,
            headers: {Authorization: 'Basic ' + makeBasicAuthToken()}
          }, callback);
        },
        parseDate = function (dateAsString) {
            return dateAsString ? new Date(dateAsString) : null;
        },
        getStatus = function (statusText, resultText) {
            if (statusText === "COMPLETED" && resultText === "SUCCESSFUL") return "Green";
            if (statusText === "COMPLETED" && resultText === "FAILED") return "Red";
            if (statusText === "COMPLETED" && resultText === "STOPPED") return "Gray";
            if (statusText === "PENDING") return "'#FFA500'";
            if (statusText === "IN_PROGRESS") return "Blue";
        },
        getStatusText = function (statusText, resultText) {
          if (statusText === "COMPLETED" && resultText === "SUCCESSFUL") return "Succeeded";
          if (statusText === "COMPLETED" && resultText === "FAILED") return "Failed";
          if (statusText === "COMPLETED" && resultText === "STOPPED") return "Stopped";
          if (statusText === "PENDING") return "Pending";
          if (statusText === "IN_PROGRESS") return "In Progress";

          return statusText;
        },
        simplifyBuild = function (deployment,pipeline) {
            return {
                id: deployment.uuid,
                project: self.configuration.envName + "_" + pipeline.repository.name,
                number: pipeline.build_number,
                isRunning: !pipeline.completed_on,
                startedAt: parseDate(pipeline.created_on),
                finishedAt: parseDate(pipeline.completed_on),
                requestedFor: pipeline.creator.display_name,
                statusText: getStatusText(pipeline.state.name, (pipeline.state.result || {}).name),
                status: getStatus(pipeline.state.name, (pipeline.state.result || {}).name),
                url: "https://bitbucket.org/groupsolver/" + self.configuration.slug + "/addon/pipelines/deployments#!/environments/" + self.configuration.envUUID + "/deployments/" + deployment.uuid
            };
        },
        queryBuilds = function (callback) {
            makeRequest(makeUrlDeployment(), function (error, body) {
            if (error || body.type === 'error') {
              callback(error || body.error);
              return;
            }

            var builds = [];

            var requests_promises = body.values.map(function (res) {
              return new Promise(function(resolve,reject){
                makeRequest(makeUrlPipeline(res.release.pipeline.uuid), function (error, body) {
                  if (error || body.type === 'error') {
                    callback(error || body.error);
                    return;
                  }
                  var simplifiedBuild = simplifyBuild(res, body);

                  builds.push(simplifiedBuild);
                  resolve();
                });
              });

            });
            Promise.all(requests_promises).then(function(res){
            callback(error, builds);});

          });
        };

    self.configure = function (config) {
        self.configuration = config;
    };

    self.check = function (callback) {
        queryBuilds(callback);
    };
};
