'use strict';
const cluster = require('cluster');
const { CentralObject } = require('../lib/index'); // require('shared-space')
const NUM_WORKERS = 1;
if (cluster.isMaster) {
  let myObject = new CentralObject({
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
  setTimeout(() => {
    console.log(`Main version: ${myObject.get('version')}`);
  }, 1000);
  setTimeout(() => {
    console.log(`Main version again: ${myObject.get('version')}`);
  }, 3000);
} else {
  console.log(`Spawned worker [${cluster.worker.id}]`);
  let myObject = new CentralObject();
  // Simulate only the first worker to change the data.
  if (cluster.worker.id === 1) {
    // at some point in time
    setTimeout(async () => {
      console.log(`Changed version`);
      await myObject.set('version', 2);
      console.log('Done change version');
      console.log('New version', await myObject.get('version'))
    }, 1050);
  }
}
