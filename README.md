# Shared objects for Node

This project aims to bring an easy to use interface for synchronising
objects between worker threads or process forks.

### Installation

```bash
npm install -s shared-object
```

> This library requires node version > 12.x

### Using with Node.js worker threads

```javascript
// Main thread (main.js)
const { Worker } = require('worker_threads');
const path = require('path');
const SharedObject = require('shared-object');
const myObject = new SharedObject({
 initial: 'data'
});
for (let i=0; i < 4; i++) {
    let worker = new Worker(path.join(__dirname, 'worker.js'));
    myObject.shareWith(worker);
}
// Change any object field with
myObject.set('my.inner.key', 'someValue');   // => {my: {inner: {key: 'someValue'}}}
// Retrieve any object field with
console.log(myObject.get('my.inner.key'));
setTimeout(() => {
  console.log('Now we have', myObject.get('my.inner.key')); // prints 'worker'
}, 100);

// Worker thread (worker.js)
const SharedObject = require('shared-object');
const myObject = new SharedObject();
// Retrieve its data
console.log(myObject.get('initial'));   // prints 'data'
// Change data on all worker threads and main thread.
myObject.set('my.inner.key', 'worker');
```

### Using with the Node.js cluster module

```javascript
const cluster = require('cluster');
const SharedObject = require('shared-object');
if(cluster.isMaster) {
    // Initiate main shared object only in master process
    let myObject = new SharedObject({
        initial: 'data'
    });
    for (let i=0; i < 4; i++) {
        let child = cluster.fork();
        myObject.shareWith(child);
    }
    // Change any object field with
    myObject.set('my.inner.key', 'someValue');   // => {my: {inner: {key: 'someValue'}}}
    // Retrieve any object field with
    console.log(myObject.get('my.inner.key'));
    setTimeout(() => {
      console.log('Now we have', myObject.get('my.inner.key')); // prints 'worker'
    }, 100);

} else {
    // We are in a forked process
    let myObject = new SharedObject();
    console.log(myObject.get());  // prints the entire data object.
    myObject.set('some.field', 'value');  // propagates value to all forked children, and the main process
}
```

### How it works
The library uses the standard Node `cluster` module (for when in cluster mode), or `worker_threads` (for when in thread mode).
In essence, it performs object synchronisation between workers, by transferring object deltas (or changes) between workers,
and merging the main data object.

Internally, when used with `threads`, it serializes the data using `bson` and sends/receives Uint8Array objects between workers.
However, when used with the `cluster` module, it sends direct objects between workers.
Synchronisation is performed between all threads/processes (worker and main), with the `last-update-wins` scenario.

### API

#### instance.constructor(initialData={})
Creates a new SharedObject instance and gives it the initial data.

#### instance.get(key?)
Returns the value of a specific key in the shared object. The key can use dot notation to retrieve inner objects (eg: my.inner.field)
If no key is specified, the entire data object will be retrieved.

#### instance.set(key, value?)
Sets the given value to the specified key inside the object. The key uses dot notation, and overrides any value present in the object.
If the key itself is an object, it will be merged with the shared object's data, overriding any values.

#### instance.clear(key)
Removes the specified key from the SharedObject's data. If no key is specified, the entire data object will be reset.

#### SharedObject.SharedParent
The Shared object parent class used in main thread/process

#### SharedObject.SharedChild
The Shared object child class used in sub-threads/processes

