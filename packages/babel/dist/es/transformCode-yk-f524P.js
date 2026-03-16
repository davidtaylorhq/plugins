import * as babel from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';

const BUNDLED = 'bundled';
const INLINE = 'inline';
const RUNTIME = 'runtime';
const EXTERNAL = 'external';

// NOTE: DO NOT REMOVE the null character `\0` as it may be used by other plugins
// e.g. https://github.com/rollup/rollup-plugin-node-resolve/blob/313a3e32f432f9eb18cc4c231cc7aac6df317a51/src/index.js#L74
const HELPERS = '\0rollupPluginBabelHelpers.js';

function importHelperPlugin({
  types: t
}) {
  return {
    pre(file) {
      const cachedHelpers = {};
      file.set('helperGenerator', name => {
        if (!file.availableHelper(name)) {
          return null;
        }
        if (cachedHelpers[name]) {
          return t.cloneNode(cachedHelpers[name]);
        }
        return cachedHelpers[name] = addNamed(file.path, name, HELPERS);
      });
    }
  };
}

const addBabelPlugin = (options, plugin) => {
  return {
    ...options,
    plugins: options.plugins.concat(plugin)
  };
};
const warned = {};
function warnOnce(ctx, msg) {
  if (warned[msg]) return;
  warned[msg] = true;
  ctx.warn(msg);
}
const regExpCharactersRegExp = /[\\^$.*+?()[\]{}|]/g;
const escapeRegExpCharacters = str => str.replace(regExpCharactersRegExp, '\\$&');

const MODULE_ERROR = 'Rollup requires that your Babel configuration keeps ES6 module syntax intact. ' + 'Unfortunately it looks like your configuration specifies a module transformer ' + 'to replace ES6 modules with another module format. To continue you have to disable it.' + '\n\n' + "Most commonly it's a CommonJS transform added by @babel/preset-env - " + 'in such case you should disable it by adding `modules: false` option to that preset ' + '(described in more detail here - https://github.com/rollup/plugins/tree/master/packages/babel#modules ).';
const UNEXPECTED_ERROR = 'An unexpected situation arose. Please raise an issue at ' + 'https://github.com/rollup/plugins/issues. Thanks!';
const PREFLIGHT_TEST_STRING = '__ROLLUP__PREFLIGHT_CHECK_DO_NOT_TOUCH__';
const PREFLIGHT_INPUT = `export default "${PREFLIGHT_TEST_STRING}";`;
function helpersTestTransform() {
  return {
    visitor: {
      StringLiteral(path, state) {
        if (path.node.value === PREFLIGHT_TEST_STRING) {
          path.replaceWith(state.file.addHelper('inherits'));
        }
      }
    }
  };
}
const mismatchError = (actual, expected, filename) => `You have declared using "${expected}" babelHelpers, but transforming ${filename} resulted in "${actual}". Please check your configuration.`;

// Revert to /\/helpers\/(esm\/)?inherits/ when Babel 8 gets released, this was fixed in https://github.com/babel/babel/issues/14185
const inheritsHelperRe = /[\\/]+helpers[\\/]+(esm[\\/]+)?inherits/;
async function preflightCheck(error, babelHelpers, transformOptions) {
  const finalOptions = addBabelPlugin(transformOptions, helpersTestTransform);
  const check = (await babel.transformAsync(PREFLIGHT_INPUT, finalOptions)).code;

  // Babel sometimes splits ExportDefaultDeclaration into 2 statements, so we also check for ExportNamedDeclaration
  if (!/export (d|{)/.test(check)) {
    error(MODULE_ERROR);
  }
  if (inheritsHelperRe.test(check)) {
    if (babelHelpers === RUNTIME) {
      return;
    }
    error(mismatchError(RUNTIME, babelHelpers, transformOptions.filename));
  }
  if (check.includes('babelHelpers.inherits')) {
    if (babelHelpers === EXTERNAL) {
      return;
    }
    error(mismatchError(EXTERNAL, babelHelpers, transformOptions.filename));
  }

  // test unminifiable string content
  if (check.includes('Super expression must either be null or a function')) {
    if (babelHelpers === INLINE || babelHelpers === BUNDLED) {
      return;
    }
    if (babelHelpers === RUNTIME && !transformOptions.plugins.length) {
      error(`You must use the \`@babel/plugin-transform-runtime\` plugin when \`babelHelpers\` is "${RUNTIME}".\n`);
    }
    error(mismatchError(INLINE, babelHelpers, transformOptions.filename));
  }
  error(UNEXPECTED_ERROR);
}

async function transformCode({
  inputCode,
  babelOptions,
  overrides,
  customOptions,
  error,
  skipPreflightCheck,
  babelHelpers
}) {
  // loadPartialConfigAsync has become available in @babel/core@7.8.0
  const config = await (babel.loadPartialConfigAsync || babel.loadPartialConfig)(babelOptions);

  // file is ignored by babel
  if (!config) {
    return null;
  }
  let transformOptions = !(overrides !== null && overrides !== void 0 && overrides.config) ? config.options : await overrides.config(config, {
    code: inputCode,
    customOptions
  });
  if (!skipPreflightCheck) {
    await preflightCheck(error, babelHelpers, transformOptions);
  }
  transformOptions = babelHelpers === BUNDLED ? addBabelPlugin(transformOptions, importHelperPlugin) : transformOptions;
  if (!(overrides !== null && overrides !== void 0 && overrides.result)) {
    const {
      code,
      map
    } = await babel.transformAsync(inputCode, transformOptions);
    return {
      code,
      map
    };
  }
  const result = await babel.transformAsync(inputCode, transformOptions);
  const {
    code,
    map
  } = await overrides.result(result, {
    code: inputCode,
    customOptions,
    config,
    transformOptions
  });
  return {
    code,
    map
  };
}

export { BUNDLED as B, HELPERS as H, escapeRegExpCharacters as e, transformCode as t, warnOnce as w };
//# sourceMappingURL=transformCode-yk-f524P.js.map
