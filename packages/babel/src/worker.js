import { parentPort } from 'worker_threads';

import transformCode from './transformCode.js';

parentPort.on('message', async ({ inputCode, babelOptions }) => {
  try {
    const result = await transformCode(inputCode, babelOptions, {}, null, null, null);
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
