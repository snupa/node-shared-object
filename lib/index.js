'use strict';
const common = require('./common'),
  wt = require('worker_threads'),
  cluster = require('cluster'),
  SharedParent = require('./SharedParent'),
  SharedChild = require('./SharedChild'),
  CentralObject = require('./CentralObject');

let SharedModule;
let wtype = common.getType();

if (wtype === 'main') {
  SharedModule = SharedParent;
} else {
  SharedModule = SharedChild;
}

module.exports.serialize = common.serialize;
module.exports.deserialize = common.deserialize;
module.exports.SharedObject = SharedModule;
module.exports.CentralObject = CentralObject;
module.exports.SharedParent = SharedParent;
module.exports.SharedChild = SharedChild;
