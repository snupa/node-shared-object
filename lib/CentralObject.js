'use strict';
/**
 * The central object is a different type of object, that essentially
 * uses the main thread/cluster worker as the single source of truth,
 * while all other workers will work with fetching the data from the main thread/worker,
 * on every single get/set request.
 * */

const common = require('./common'),
  wt = require('worker_threads'),
  cluster = require('cluster');

const OP_SET = 1,
  OP_GET = 2,
  OP_CLEAR = 3;

class CentralObject {

  #id = null;   // the object instance id
  #type = null;
  #data = null;
  #seq = 0; // the request sequence, for children.
  #pending = {};  // a map of pending {seq:resolve} to call, once we got ack.

  constructor(obj, id) {
    this.#type = common.getType();
    this.#id = (typeof obj === 'string' ? obj : typeof id === 'string' ? id : 'main');
    if (this.#type === 'main') {
      this.#data = (typeof obj === 'object' && obj ? obj : {});
    } else if (this.#type === 'thread') {
      wt.parentPort.on('message', this.#handleResponse);
    } else if (this.#type === 'child') {
      process.on('message', this.#handleResponse);
    }
  }

  get id() {
    return this.#id;
  }

  /**
   * Sets a field on the shared child.
   * @Arguments
   *  - k - the raw object to merge
   *    OR
   *  - k and v - the key string and the value for that key.
   * */
  set(k, v) {
    if (this.#type === 'main') {
      let changes = common.prepareSet(k, v);
      if (changes === false) return false;
      common.merge(changes, this.#data);
      return true;
    }
    return this.#request(OP_SET, [k, v]);
  }

  /**
   * Returns either the full data object, or a key inside the data object.
   * @Arguments
   *  - k - the string key to retrieve.
   * */
  get(k) {
    if (this.#type === 'main') {
      if (typeof k === 'undefined') return this.#data;
      return common.pick(k, this.#data);
    }
    return this.#request(OP_GET, [k]);
  }

  /**
   * Clears the specified key, or the entire data object, if key not specified.
   * @Arguments
   *  - k
   * */
  clear(k) {
    if (this.#type === 'main') {
      if (typeof k === 'string') {
        return this.set(k, null);
      }
      // Clear all the data.
      this.#data = {};
      return true;
    }
    return this.#request(OP_CLEAR, [k]);
  }

  /**
   * Shares the current data with the given subProcesses/workers.
   * @Arguments
   *   - target - a Worker instance, or a Cluster.Worker instance
   * */
  shareWith(target) {
    if (this.#type !== 'main') return false;
    let handleMessage = this.#handleRequest(target);
    if (target instanceof wt.Worker) {
      target.once('exit', () => {
        target.removeListener('message', handleMessage);
      });
      target.on('message', handleMessage);
    } else if (target instanceof cluster.Worker) {
      target.once('exit', () => {
        target.removeListener('message', handleMessage);
      });
      target.on('message', handleMessage);
    } else {
      throw new Error(`Requires a Worker or ChildProcess instance`);
    }
  }

  /**
   * Internal function that handles incoming requests from children.
   * */
  #handleRequest = (worker) => {
    let type = worker.process ? 'child' : 'thread';
    return (msg) => {
      if (typeof msg !== 'object' || !msg) return;
      try {
        let q = common.deserialize(msg, type);
        if (q.i !== this.#id) return;
        if (!q.o) return;
        let op = q.o[0],
          seq = q.o[1],
          args = q.o[2];
        let res;
        if (op === OP_SET) {
          // handle set.
          res = this.set(args[0], args[1]);
        } else if (op === OP_GET) {
          res = this.get(args[0]);
        } else if (op === OP_CLEAR) {
          res = this.clear(args[0]);
        } else {
          return;
        }
        let cmd = [seq, res];
        let msgRes = common.serialize(this, cmd, type, 'r');
        if (type === 'thread') {
          worker.postMessage(msgRes);
        } else {
          worker.send(msgRes);
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  /**
   * Used by children to handle incoming responses from parent
   * */
  #handleResponse = (msg) => {
    if (typeof msg !== 'object' || !msg) return;
    try {
      let resp = common.deserialize(msg, this.#type);
      if (resp.i !== this.#id || !resp.r) return;
      let result = resp.r;
      let seq = resp.r[0],
        cmdResult = resp.r[1];
      if (typeof this.#pending[seq] !== 'function') return;
      this.#pending[seq](cmdResult);
    } catch (e) {
      console.log(e);
    }
  }

  #request = async (op, args) => {
    let s = ++this.#seq;
    let cmd = [op, s];
    cmd.push(args);
    return new Promise((resolve) => {
      this.#pending[s] = resolve;
      let msg = common.serialize(this, cmd, this.#type, 'o');
      if (this.#type === 'thread') {
        wt.parentPort.postMessage(msg);
      } else {
        process.send(msg);
      }
    });
  }


}

module.exports = CentralObject;
