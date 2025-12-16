import { parentPort } from 'worker_threads';
import { t as transformCode } from './transformCode-jCS_26lC.js';
import '@babel/core';
import '@babel/helper-module-imports';

parentPort.on('message', async opts => {
  try {
    const result = await transformCode({
      ...opts,
      error: msg => {
        throw new Error(msg);
      }
    });
    parentPort.postMessage({
      result
    });
  } catch (error) {
    parentPort.postMessage({
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
});
//# sourceMappingURL=worker.js.map
