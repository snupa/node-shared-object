'use strict';
const DotObject = require('dot-object'),
  dot = new DotObject(),
  cluster = require('cluster'),
  wt = require('worker_threads'),
  bson = require('bson');
dot.override = true;

const common = {};

/**
 * Returns the type of process that we're in
 * "worker" or "child" or "main"
 * */
common.getType = function getProcessType() {
  if (cluster.isMaster && wt.isMainThread) {
    return 'main';
  }
  if (cluster.worker) return 'child';
  if (wt.threadId > 0) return 'thread';
  return null;
}

/**
 * Returns the cluster worker id/thread id
 * */
common.getWorkerId = function getWorkerId() {
  if (cluster.worker) return cluster.worker.id;
  return wt.threadId;
}

/**
 * Handles default serialization.
 * We use BSON to perform Uint8Array serialization.
 * @Arguments
 *  - instance - the SharedChild/SharedParent instance object
 *  - obj - the object containing the changes.
 *  - type=worker/child - the type of serialization we're going to use.
 *  Note:
 *    - worker serializations will return an Uint8Array
 *    - child serializations will return the raw object.
 * */
common.serialize = function serialize(instance, obj, type, field = 'd') {
  try {
    let r = {
      i: instance.id,
      [field]: obj
    };
    if (type === 'child') return r;
    let buff = bson.serialize(r).buffer;
    return new Uint8Array(buff);
  } catch (e) {
    console.log(e);
    return null;
  }
}

/**
 * @Arguments
 *  - buff - the Uint8 array buffer, or the json object
 *  Note:
 *    - type=worker - will try to deserialize using bson
 *    - type=child - will try to deserialize using raw json.
 * */
common.deserialize = function deserialize(buff, type) {
  if (type === 'child') return buff;
  try {
    return bson.deserialize(buff);
  } catch (e) {
    console.log(e);
    return {};
  }
}

/**
 * Given a key string and an object, it will retrieve the value of that key within the object.
 * @Arguments
 *  - key - the key to pick
 *  - obj - the object to use
 * */
common.pick = function pick(key, source) {
  if (typeof key === 'number') {
    key = key.toString();
  } else if (typeof key !== 'string') return null;
  return dot.pick(key, source);
}

/**
 * Utility function that merges 2 objects together.
 * We use dot-object for this, to perform as few overwrites as possible, to avoid as many
 * collisions as possible.
 * @Arguments
 *  - source - the source object we want to use
 *  - target - the target object we'll be applying the merges to.
 * */
common.merge = function merge(source, target) {
  if (source === null) return {};
  let k = dot.dot(source);
  let keys = Object.keys(k);
  for (let i = 0, len = keys.length; i < len; i++) {
    let key = keys[i];
    if (k[key] === null) {
      dot.remove(key, target);
    } else {
      dot.str(key, k[key], target);
    }
  }
  return target;
}

/**
 * Given an object, or a key+value, it will convert them into a raw object
 * that will be sent to merge.
 * */
common.prepareSet = function prepareSet(key, value) {
  if (typeof key === 'object' && key) {
    if (Object.keys(key).length === 0) return false;
    return key;
  } else if (typeof key === 'string') {
    if (typeof value === undefined) value = null;
    return dot.object({
      [key]: value
    });
  } else {
    return false;
  }
}

module.exports = common;
