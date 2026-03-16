'use strict';

var workerpool = require('workerpool');
var transformCode = require('./transformCode-47UZeDHQ.js');
require('@babel/core');
require('@babel/helper-module-imports');

async function transform(opts) {
  return transformCode.transformCode({
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
