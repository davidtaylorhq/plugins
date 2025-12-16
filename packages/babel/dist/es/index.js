import * as babel from '@babel/core';
import { createFilter } from '@rollup/pluginutils';
import { e as escapeRegExpCharacters, H as HELPERS, t as transformCode, w as warnOnce, B as BUNDLED } from './transformCode-jCS_26lC.js';
import { Worker } from 'worker_threads';
import os from 'os';
import '@babel/helper-module-imports';

class WorkerPool {
  workers = [];
  availableWorkers = [];
  pendingTasks = [];
  runningTasks = new Map();
  nextTaskId = 0;
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
  }
  createWorker() {
    const worker = new Worker(this.workerScript);
    worker.on('message', message => {
      const {
        result,
        error
      } = message;
      const runningTask = this.runningTasks.get(worker);
      if (runningTask) {
        this.runningTasks.delete(worker);
        if (error) {
          const err = new Error(error.message);
          err.name = error.name;
          err.stack = error.stack;
          runningTask.reject(err);
        } else {
          runningTask.resolve(result);
        }
        this.availableWorkers.push(worker);
        this.processQueue();
      }
    });
    worker.on('error', error => {
      console.error('Worker error:', error);
    });
    worker.on('exit', code => {
      if (code !== 0 && !this.isTerminating) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });
    this.workers.push(worker);
    return worker;
  }
  getAvailableWorker() {
    if (this.availableWorkers.length > 0) {
      return this.availableWorkers.shift();
    }
    if (this.workers.length < this.poolSize) {
      return this.createWorker();
    }
    return null;
  }
  processQueue() {
    while (this.pendingTasks.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) break;
      const task = this.pendingTasks.shift();
      this.runningTasks.set(worker, task);
      worker.postMessage(task.opts);
    }
  }
  async runTask(opts) {
    const taskPromise = new Promise((resolve, reject) => {
      this.pendingTasks.push({
        resolve,
        reject,
        opts
      });
    });
    this.processQueue();
    return taskPromise;
  }
  async terminate() {
    this.isTerminating = true;
    for (const [, {
      reject
    }] of this.runningTasks.entries()) {
      reject(new Error('Worker pool is terminating'));
    }
    this.runningTasks.clear();
    this.pendingTasks.length = 0;
    const terminatePromises = this.workers.map(worker => worker.terminate().catch(err => {
      console.error('Error terminating worker:', err);
    }));
    await Promise.all(terminatePromises);
    this.workers.length = 0;
    this.availableWorkers.length = 0;
  }
}

const unpackOptions = ({
  extensions = babel.DEFAULT_EXTENSIONS,
  // rollup uses sourcemap, babel uses sourceMaps
  // just normalize them here so people don't have to worry about it
  sourcemap = true,
  sourcemaps = true,
  sourceMap = true,
  sourceMaps = true,
  ...rest
} = {}) => {
  return {
    extensions,
    plugins: [],
    sourceMaps: sourcemap && sourcemaps && sourceMap && sourceMaps,
    ...rest,
    caller: {
      name: '@rollup/plugin-babel',
      ...rest.caller
    }
  };
};
const warnAboutDeprecatedHelpersOption = ({
  deprecatedOption,
  suggestion
}) => {
  // eslint-disable-next-line no-console
  console.warn(`\`${deprecatedOption}\` has been removed in favor a \`babelHelpers\` option. Try changing your configuration to \`${suggestion}\`. ` + `Refer to the documentation to learn more: https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers`);
};
const unpackInputPluginOptions = ({
  skipPreflightCheck = false,
  ...rest
}) => {
  if ('runtimeHelpers' in rest) {
    warnAboutDeprecatedHelpersOption({
      deprecatedOption: 'runtimeHelpers',
      suggestion: `babelHelpers: 'runtime'`
    });
  } else if ('externalHelpers' in rest) {
    warnAboutDeprecatedHelpersOption({
      deprecatedOption: 'externalHelpers',
      suggestion: `babelHelpers: 'external'`
    });
  } else if (!rest.babelHelpers) {
    // eslint-disable-next-line no-console
    console.warn("babelHelpers: 'bundled' option was used by default. It is recommended to configure this option explicitly, read more here: " + 'https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers');
  }
  return unpackOptions({
    ...rest,
    skipPreflightCheck,
    babelHelpers: rest.babelHelpers || BUNDLED,
    caller: {
      supportsStaticESM: true,
      supportsDynamicImport: true,
      supportsTopLevelAwait: true,
      supportsExportNamespaceFrom: true,
      ...rest.caller
    }
  });
};
const unpackOutputPluginOptions = (options, {
  format
}) => unpackOptions({
  configFile: false,
  sourceType: format === 'es' ? 'module' : 'script',
  ...options,
  caller: {
    supportsStaticESM: format === 'es',
    ...options.caller
  }
});
function getOptionsWithOverrides(pluginOptions = {}, overrides = {}) {
  if (!overrides.options) return {
    customOptions: null,
    pluginOptionsWithOverrides: pluginOptions
  };
  const overridden = overrides.options(pluginOptions);
  if (typeof overridden.then === 'function') {
    throw new Error(".options hook can't be asynchronous. It should return `{ customOptions, pluginsOptions }` synchronously.");
  }
  return {
    customOptions: overridden.customOptions || null,
    pluginOptionsWithOverrides: overridden.pluginOptions || pluginOptions
  };
}
const returnObject = () => {
  return {};
};
function isSerializable(value) {
  if (value === null) {
    return true;
  } else if (Array.isArray(value)) {
    return value.every(isSerializable);
  }
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true;
    case 'object':
      return Object.keys(value).every(key => isSerializable(value[key]));
    default:
      return false;
  }
}
function createBabelInputPluginFactory(customCallback = returnObject) {
  const overrides = customCallback(babel);
  return pluginOptions => {
    const {
      customOptions,
      pluginOptionsWithOverrides
    } = getOptionsWithOverrides(pluginOptions, overrides);
    let workerPool;
    const {
      exclude,
      extensions,
      babelHelpers,
      include,
      filter: customFilter,
      skipPreflightCheck,
      parallel,
      ...babelOptions
    } = unpackInputPluginOptions(pluginOptionsWithOverrides);
    const extensionRegExp = new RegExp(`(${extensions.map(escapeRegExpCharacters).join('|')})(\\?.*)?(#.*)?$`);
    if (customFilter && (include || exclude)) {
      throw new Error('Could not handle include or exclude with custom filter together');
    }
    const userDefinedFilter = typeof customFilter === 'function' ? customFilter : createFilter(include, exclude);
    const filter = (id, code) => extensionRegExp.test(id) && userDefinedFilter(id, code);
    if (parallel) {
      const canParalllelize = isSerializable(babelOptions) && !(overrides !== null && overrides !== void 0 && overrides.config) && !(overrides !== null && overrides !== void 0 && overrides.result);
      if (!canParalllelize) {
        throw new Error('Cannot use "parallel" mode alongside custom overrides or non-serializable Babel options.');
      }
      workerPool = new WorkerPool(new URL('./worker.js', import.meta.url).pathname);
    }
    const helpersFilter = {
      id: new RegExp(`^${escapeRegExpCharacters(HELPERS)}$`)
    };
    return {
      name: 'babel',
      resolveId: {
        filter: helpersFilter,
        handler(id) {
          if (id !== HELPERS) {
            return null;
          }
          return id;
        }
      },
      load: {
        filter: helpersFilter,
        handler(id) {
          if (id !== HELPERS) {
            return null;
          }
          return babel.buildExternalHelpers(null, 'module');
        }
      },
      transform: {
        filter: {
          id: extensionRegExp
        },
        async handler(code, filename) {
          var _overrides$config, _overrides$result;
          if (!(await filter(filename, code))) return null;
          if (filename === HELPERS) return null;
          if (parallel) {
            return workerPool.runTask({
              inputCode: code,
              babelOptions: {
                ...babelOptions,
                filename
              },
              runPreflightCheck: !skipPreflightCheck,
              babelHelpers
            });
          }
          return transformCode({
            inputCode: code,
            babelOptions: {
              ...babelOptions,
              filename
            },
            overrides: {
              config: (_overrides$config = overrides.config) === null || _overrides$config === void 0 ? void 0 : _overrides$config.bind(this),
              result: (_overrides$result = overrides.result) === null || _overrides$result === void 0 ? void 0 : _overrides$result.bind(this)
            },
            customOptions,
            error: this.error.bind(this),
            runPreflightCheck: !skipPreflightCheck,
            babelHelpers
          });
        }
      },
      async buildEnd() {
        if (parallel) {
          await workerPool.terminate();
        }
      },
      async renderChunk() {
        // Hack - rolldown doesn't seem to fire the buildEnd hook. If we see renderChunk, then it's fine to terminate the workers
        if (parallel) {
          await workerPool.terminate();
        }
      }
    };
  };
}
function getRecommendedFormat(rollupFormat) {
  switch (rollupFormat) {
    case 'amd':
      return 'amd';
    case 'iife':
    case 'umd':
      return 'umd';
    case 'system':
      return 'systemjs';
    default:
      return '<module format>';
  }
}
function createBabelOutputPluginFactory(customCallback = returnObject) {
  const overrides = customCallback(babel);
  return pluginOptions => {
    const {
      customOptions,
      pluginOptionsWithOverrides
    } = getOptionsWithOverrides(pluginOptions, overrides);

    // cache for chunk name filter (includeChunks/excludeChunks)
    let chunkNameFilter;
    return {
      name: 'babel',
      renderStart(outputOptions) {
        const {
          extensions,
          include,
          exclude,
          allowAllFormats
        } = pluginOptionsWithOverrides;
        if (extensions || include || exclude) {
          warnOnce(this, 'The "include", "exclude" and "extensions" options are ignored when transforming the output.');
        }
        if (!allowAllFormats && outputOptions.format !== 'es' && outputOptions.format !== 'cjs') {
          this.error(`Using Babel on the generated chunks is strongly discouraged for formats other than "esm" or "cjs" as it can easily break wrapper code and lead to accidentally created global variables. Instead, you should set "output.format" to "esm" and use Babel to transform to another format, e.g. by adding "presets: [['@babel/env', { modules: '${getRecommendedFormat(outputOptions.format)}' }]]" to your Babel options. If you still want to proceed, add "allowAllFormats: true" to your plugin options.`);
        }
      },
      renderChunk(code, chunk, outputOptions) {
        var _overrides$config2, _overrides$result2;
        /* eslint-disable no-unused-vars */
        const {
          allowAllFormats,
          includeChunks,
          excludeChunks,
          exclude,
          extensions,
          externalHelpers,
          externalHelpersWhitelist,
          include,
          runtimeHelpers,
          ...babelOptions
        } = unpackOutputPluginOptions(pluginOptionsWithOverrides, outputOptions);
        /* eslint-enable no-unused-vars */
        // If includeChunks/excludeChunks are specified, filter by chunk.name
        if (includeChunks != null || excludeChunks != null) {
          if (!chunkNameFilter) {
            chunkNameFilter = createFilter(includeChunks, excludeChunks, {
              resolve: false
            });
          }
          if (!chunkNameFilter(chunk.name)) {
            // Skip transforming this chunk
            return null;
          }
        }
        return transformCode({
          inputCode: code,
          babelOptions,
          overrides: {
            config: (_overrides$config2 = overrides.config) === null || _overrides$config2 === void 0 ? void 0 : _overrides$config2.bind(this),
            result: (_overrides$result2 = overrides.result) === null || _overrides$result2 === void 0 ? void 0 : _overrides$result2.bind(this)
          },
          customOptions,
          error: this.error.bind(this)
        });
      }
    };
  };
}

// export this for symmetry with output-related exports
const getBabelInputPlugin = createBabelInputPluginFactory();
const getBabelOutputPlugin = createBabelOutputPluginFactory();

export { getBabelInputPlugin as babel, createBabelInputPluginFactory, createBabelOutputPluginFactory, getBabelInputPlugin as default, getBabelInputPlugin, getBabelOutputPlugin };
//# sourceMappingURL=index.js.map
