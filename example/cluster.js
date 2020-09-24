'use strict';
const cluster = require('cluster');
const { SharedObject } = require('../lib/index'); // require('shared-space')
const NUM_WORKERS = 4;
if (cluster.isMaster) {
  let myObject = new SharedObject({
    version: 1,
    name: 'My object',
    children: {
      snupa: 'available',
      john: 'not-available'
    }
  });
  console.log(`Started main`);
  for (let i = 0; i < NUM_WORKERS; i++) {
    const child = cluster.fork();
    myObject.shareWith(child);
  }
  setInterval(() => {
    console.log(`Main version: ${myObject.get('version')}`);
  }, 1000);
} else {
  console.log(`Spawned worker [${cluster.worker.id}]`);
  let myObject = new SharedObject();
  // Simulate only the first worker to change the data.
  if (cluster.worker.id === 1) {
    // at some point in time
    setTimeout(() => {
      console.log(`Changed version`);
      myObject.set('version', 2);
    }, 1050);
  } else {
    setInterval(() => {
      console.log(`Worker ${cluster.worker.id} version: ${myObject.get('version')}`);
    }, 1000);
  }
}
