import { parentPort } from 'worker_threads';

import * as babel from '@babel/core';

import transformCode from './transformCode.js';

export default function startWorker() {
  parentPort.on('message', async ({ id, inputCode, babelOptions }) => {
    try {
      const result = await transformCode(inputCode, babelOptions, {}, null, null, null);
      parentPort.postMessage({
        id,
        result
      });
    } catch (error) {
      parentPort.postMessage({
        id,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    }
  });
}
