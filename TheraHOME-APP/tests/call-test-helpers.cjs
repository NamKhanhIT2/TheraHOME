/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');

function loadModule(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, __DEV__: false,
    require: (id) => {
      if (id in mocks) return mocks[id];
      throw new Error(`Unmocked import ${id} in ${file}`);
    },
    console: { warn() {} }, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    ...globals,
  }, { filename: file });
  return module.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
function room(peer = true) {
  return Object.assign(new EventEmitter(), {
    state: 'connected',
    remoteParticipants: new Map(peer ? [['peer', {}]] : []),
    localParticipant: {},
  });
}
function timers() {
  let sequence = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout: (fn) => { const id = ++sequence; pending.set(id, fn); return id; },
    clearTimeout: (id) => pending.delete(id),
    fire: () => { const all = [...pending.values()]; pending.clear(); all.forEach((fn) => fn()); },
  };
}
module.exports = { loadModule, deferred, flush, room, timers };
