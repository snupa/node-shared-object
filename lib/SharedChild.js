'use strict';
const wt = require('worker_threads'),
  cluster = require('cluster'),
  common = require('./common');

class SharedMemoryChild {

  #type = wt.threadId ? 'thread' : 'child'; // the type of child (thread/child)
  #id = null;   // the shared instance name.
  #data = {};   // the default data.

  constructor(id) {
    this.#id = typeof id === 'object' ? 'main' : id || 'main';
    // We're a thread.
    if (this.#type === 'thread') {
      // Check the initial data.
      if (wt.workerData instanceof Uint8Array) {
        let q = common.deserialize(wt.workerData, 'thread');
        if (q.i === this.#id) {
          this.#data = q.d;
        }
      }
      wt.parentPort.on('message', this.#handleUpdate);
    } else {  // we're a subProcess
      process.on('message', this.#handleUpdate);
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
   * Function called when we want to announce a change to the parent.
   * */
  #announce = (changes) => {
    let s = common.serialize(this, changes, this.#type);
    if (this.#type === 'thread') {
      wt.parentPort.postMessage(s);
    } else {
      process.send(s);
    }
  }

  /**
   * Function called when a change was sent by the parent.
   * */
  #handleUpdate = (m) => {
    try {
      let r = common.deserialize(m, this.#type);
      if (r.i !== this.#id) return;
      if (r.d === null) {
        this.#data = {};
      } else {
        common.merge(r.d, this.#data);
      }
    } catch (e) {
      console.log(e);
    }
  }

}

module.exports = SharedMemoryChild;
