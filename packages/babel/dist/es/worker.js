import workerpool from 'workerpool';
import { t as transformCode } from './transformCode-yk-f524P.js';
import '@babel/core';
import '@babel/helper-module-imports';

async function transform(opts) {
  return transformCode({
    ...opts,
    error: msg => {
      throw new Error(msg);
    }
  });
}
workerpool.worker({
  transform
});
//# sourceMappingURL=worker.js.map
