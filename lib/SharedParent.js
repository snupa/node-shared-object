'use strict';
/**
 * This is the parent class, available when we're in parent mode(either isMainThread or isMaster)
 * */
const common = require('./common'),
  wt = require('worker_threads'),
  cluster = require('cluster');

class SharedMemoryMain {

  #id = null;   // the shared memory instance id.
  #data = {}; // our default data.
  #workers = new Set();   // child workers, for when isMainThread
  #processes = new Set(); // child processes, for when cluster.isMaster

  constructor(data = {}, id) {
    this.#data = data;
    this.#id = id || 'main';
  }

  get id() {
    return this.#id;
  }


  /**
   * Shares our current data with the given subProcess/worker.
   * @Arguments
   *  - target - a Worker instance, or a cluster.Worker instance
   * */
  shareWith(target, opt = {}) {
    let handleMessage = this.#syncWithChild(target);
    if (target instanceof wt.Worker) {
      this.#workers.add(target);
      target.once('exit', () => {
        this.#workers.delete(target);
        target.removeListener('message', handleMessage);
      });
      target.on('message', handleMessage);
      let initialData = common.serialize(this, this.#data, 'worker');
      target.postMessage(initialData, [initialData.buffer]);
    } else if (target instanceof cluster.Worker) {
      this.#processes.add(target);
      target.once('exit', () => {
        this.#processes.delete(target);
        target.removeListener('message', handleMessage);
      });
      target.on('message', handleMessage);
      let initialData = common.serialize(this, this.#data, 'child');
      target.send(initialData);
    } else {
      throw new Error(`Requires a Worker or ChildProcess instance`);
    }
  }

  /**
   * Sets a field on the shared child.
   * @Arguments
   *  - k - the raw object to merge
   *    OR
   *  - k and v - the key string and the value for that key.
   * */
  set(k, v) {
    let changes = common.prepareSet(k, v);
    if (changes === false) return false;
    common.merge(changes, this.#data);
    this.#announce(changes);
  }

  /**
   * Returns either the full data object, or a key inside the data object.
   * @Arguments
   *  - k - the string key to retrieve.
   * */
  get(k) {
    if (typeof k === 'undefined') return this.#data;
    return common.pick(k, this.#data);
  }

  /**
   * Serializes the data for initial worker data.
   * */
  prepare(type = 'worker') {
    let msg = common.serialize(this, this.#data, type);
    return msg;
  }

  /**
   * Clears the specified key, or the entire data object, if key not specified.
   * @Arguments
   *  - k
   * */
  clear(k) {
    if (typeof k === 'string') {
      return this.set(k, null);
    }
    // Clear all the data.
    this.#data = {};
    this.#announce(null);
  }

  /**
   * Handles syncing data from a child, with our current data.
   * */
  #syncWithChild = (worker) => {
    return (msg) => {
      let type = worker.process ? 'child' : 'thread';
      try {
        let d = common.deserialize(msg, type);
        if (d.i !== this.#id) return;
        if (d.d === null) {
          this.#data = {};
        } else {
          common.merge(d.d, this.#data);
        }
        this.#announce(d.d, worker);
      } catch (e) {
      }
    }
  }

  /**
   * Announces changes to other workers.
   * */
  #announce = (data, ignored) => {
    if (this.#workers.size > 0) {
      let workerMsg = common.serialize(this, data, 'worker');
      this.#workers.forEach(w => {
        if (ignored && w === ignored) return;
        try {
          w.postMessage(workerMsg);
        } catch (e) {
          console.log(e);
        }
      });
    }
    if (this.#processes.size > 0) {
      let procMsg = common.serialize(this, data, 'child');
      this.#processes.forEach(p => {
        if (ignored && p === ignored) return;
        try {
          p.send(procMsg, undefined, {
            keepOpen: true
          });
        } catch (e) {
          console.log(e);
        }
      });
    }
  }

}

module.exports = SharedMemoryMain;
