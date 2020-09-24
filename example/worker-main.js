'use strict';
const path = require('path');
const { Worker } = require('worker_threads');
const { SharedObject } = require('../lib/index'); // require('shared-space')

const NUM_WORKERS = 2;
const myObject = new SharedObject({
  version: 1,
  name: 'My object',
  children: {
    snupa: 'available',
    john: 'not-available'
  }
});

for (let i = 0; i < NUM_WORKERS; i++) {
  const worker = new Worker(path.normalize(__dirname + '/worker-thread.js'), {
    workerData: myObject.prepare('worker')
  });
  myObject.shareWith(worker);
}

console.log(`Started main`);
setInterval(() => {
  console.log(`Main version: ${myObject.get('version')}`);
}, 1000);
