const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Loads TypeScript modules of the app for Node's test runner. Relative imports
 * are compiled the same way; other packages must be listed in `allow` (and are
 * required for real), so a test never silently reaches into React Native.
 */
const createLoader = ({ allow = [], mocks = {} } = {}) => {
  const cache = {};
  const load = (relativePath) => {
    const file = path.join(__dirname, "..", "..", relativePath);
    if (cache[file]) return cache[file];
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    cache[file] = module.exports;
    new Function("exports", "require", "module", code)(module.exports, (specifier) => {
      if (specifier in mocks) return mocks[specifier];
      if (!specifier.startsWith(".")) {
        if (allow.includes(specifier)) return require(specifier);
        throw new Error(`Unexpected import ${specifier} from ${relativePath}`);
      }
      const target = path.relative(path.join(__dirname, "..", ".."), path.join(path.dirname(file), specifier));
      const withExt = fs.existsSync(path.join(__dirname, "..", "..", `${target}.ts`)) ? `${target}.ts` : `${target}.tsx`;
      return load(withExt);
    }, module);
    cache[file] = module.exports;
    return module.exports;
  };
  return load;
};

module.exports = { createLoader };
