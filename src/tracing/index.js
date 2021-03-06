'use strict';

var semver = require('semver');

var logger = require('../logger').getLogger('tracing');

var tracingEnabled = false;
var automaticTracingEnabled = false;
var config;

var instrumentations = [
  './instrumentation/bluebird',
  './instrumentation/elasticsearch',
  './instrumentation/express',
  './instrumentation/fastify',
  './instrumentation/httpClient',
  './instrumentation/httpServer',
  './instrumentation/ioredis',
  './instrumentation/kafka',
  './instrumentation/mongodb',
  './instrumentation/mssql',
  './instrumentation/mysql',
  './instrumentation/pg',
  './instrumentation/redis',
];
var instrumentationModules = {};


exports.init = function(_config) {
  config = _config;
  setDefaults();

  tracingEnabled = shouldEnableTracing();
  automaticTracingEnabled = tracingEnabled && shouldEnableAutomaticTracing();

  if (tracingEnabled) {
    require('./tracingUtil').init(config);
    require('./transmission').init(config);
    require('./opentracing').init(config, automaticTracingEnabled);

    if (automaticTracingEnabled) {
      instrumentations.forEach(function(instrumentationKey) {
        instrumentationModules[instrumentationKey] = require(instrumentationKey);
        instrumentationModules[instrumentationKey].init(config);
      });
    }
  }
};


function setDefaults() {
  config.tracing = config.tracing || {};
  config.tracing.enabled = config.tracing.enabled !== false;
}


function shouldEnableTracing() {
  if (config.tracing && config.tracing.enabled === false) {
    logger.info('Not enabling manual tracing as tracing is not enabled via config.');
    return false;
  }

  return true;
}


function shouldEnableAutomaticTracing() {
  if (config.tracing && config.tracing.enabled === false) {
    logger.info('Not enabling automatic tracing as tracing is not enabled via config.');
    return false;
  }

  if (config.tracing && config.tracing.disableAutomaticTracing) {
    logger.info('Not enabling automatic tracing as automatic tracing is disabled via config.');
    return false;
  }

  if (!exports.supportedVersion(process.versions.node)) {
    logger.info('Not enabling automatic tracing this is an unsupported version of Node.' +
                '  See: https://docs.instana.io/ecosystem/node-js/');
    return false;
  }
  return true;
}


exports.supportedVersion = function supportedVersion(version) {
  return semver.satisfies(version, '^4.5 || ^5.10 || ^6 || ^7 || ^8.2.1 || ^9.1.0 || ^10.0.0');
};


exports.activate = function() {
  if (tracingEnabled) {
    require('./transmission').activate();
    require('./opentracing').activate();

    if (automaticTracingEnabled) {
      instrumentations.forEach(function(instrumentationKey) {
        instrumentationModules[instrumentationKey].activate();
      });
    }
  }
};


exports.deactivate = function() {
  if (tracingEnabled) {
    if (automaticTracingEnabled) {
      instrumentations.forEach(function(instrumentationKey) {
        instrumentationModules[instrumentationKey].deactivate();
      });
    }

    require('./opentracing').deactivate();
    require('./transmission').deactivate();
  }
};
