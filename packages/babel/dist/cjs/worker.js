'use strict';

var worker_threads = require('worker_threads');
var transformCode = require('./transformCode-uyx3CS9q.js');
require('@babel/core');
require('@babel/helper-module-imports');

worker_threads.parentPort.on('message', async opts => {
  try {
    const result = await transformCode.transformCode({
      ...opts,
      error: msg => {
        throw new Error(msg);
      }
    });
    worker_threads.parentPort.postMessage({
      result
    });
  } catch (error) {
    worker_threads.parentPort.postMessage({
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
});
//# sourceMappingURL=worker.js.map
