'use strict';
const common = require('./common'),
  wt = require('worker_threads'),
  cluster = require('cluster'),
  SharedParent = require('./SharedParent'),
  SharedChild = require('./SharedChild');

let SharedModule;
if (wt.isMainThread && cluster.isMaster) {
  SharedModule = SharedParent;
} else {
  SharedModule = SharedChild;
}

SharedModule.serialize = common.serialize;
SharedModule.deserialize = common.deserialize;
module.exports = SharedModule;
module.exports.SharedParent = SharedParent;
module.exports.SharedChild = SharedChild;
