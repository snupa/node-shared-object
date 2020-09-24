'use strict';
const { threadId } = require('worker_threads');
const { SharedObject } = require('../lib/index');

let myObject = new SharedObject();
console.log(`Spawned thread [${threadId}] with initial version: ${myObject.get('version')}`);
// Simulate only the first worker to change the data.
if (threadId === 1) {
  // at some point in time
  setTimeout(() => {
    console.log(`Changed version`);
    myObject.set('version', 2);
  }, 1050);
  setTimeout(() => {
    console.log(`Clear data`);
    myObject.clear();
  }, 3000);
} else {
  setInterval(() => {
    console.log(`Worker ${threadId} version: ${myObject.get('version')}`);
  }, 1000);
}
