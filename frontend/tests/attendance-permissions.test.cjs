const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, queueMicrotask, ...globals });
  return exports;
}

test('camera effect restart shares one pending prompt and stops after final release', async () => {
  let calls = 0, stops = 0, resolve;
  const { acquireAttendanceCamera: acquire } = load('utils/attendanceCamera.ts', {
    navigator: { mediaDevices: { getUserMedia() { calls++; return new Promise(r => { resolve = r; }); } } },
  });
  const first = acquire(); first.release();
  const second = acquire();
  assert.equal(calls, 1);
  resolve({ getTracks: () => [{ stop() { stops++; } }] });
  await second.ready;
  assert.equal(stops, 0);
  second.release(); second.release();
  await Promise.resolve();
  assert.equal(stops, 1);
  const next = acquire();
  assert.equal(calls, 2);
  next.release();
  resolve({ getTracks: () => [{ stop() { stops++; } }] });
  await next.ready;
  assert.equal(stops, 2);
});

test('denied camera can be retried without reusing a rejected request', async () => {
  let calls = 0;
  const { acquireAttendanceCamera: acquire } = load('utils/attendanceCamera.ts', {
    navigator: { mediaDevices: { getUserMedia() { calls++; return Promise.reject(new Error('denied')); } } },
  });
  const first = acquire();
  await assert.rejects(first.ready); first.release();
  const second = acquire();
  await assert.rejects(second.ready); second.release();
  assert.equal(calls, 2);
});

function locationHarness(permissions) {
  let cursor = 0, requests = 0, queries = 0, tree;
  const hooks = [], pending = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], v => { hooks[i] = typeof v === 'function' ? v(hooks[i]) : v; }]; },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!hooks[i] || deps.some((d, n) => d !== hooks[i].deps[n])) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; const prev = hooks[i]; if (!prev || deps.some((d, n) => d !== prev.deps[n])) pending.push(() => { prev?.cleanup?.(); hooks[i] = { deps, cleanup: fn() }; }); },
  };
  const jsx = (type, props) => ({ type, props });
  const { LocationStatus } = load('components/LocationStatus.tsx', {
    window: { addEventListener() {}, removeEventListener() {} },
    navigator: {
      permissions: permissions ? { query() { queries++; return permissions(); } } : undefined,
      geolocation: { getCurrentPosition() { requests++; } },
    },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      return {};
    },
  });
  return {
    render() { cursor = 0; tree = LocationStatus({ variant: 'banner', onStatusChange() {} }); pending.splice(0).forEach(fn => fn()); },
    click() {
      const find = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'button' && node.props.disabled !== undefined) return node;
        for (const child of [node.props?.children].flat(Infinity)) { const match = find(child); if (match) return match; }
      };
      find(tree).props.onClick();
    },
    cleanup() { hooks.forEach(h => h?.cleanup?.()); },
    get requests() { return requests; }, get queries() { return queries; },
  };
}

for (const [name, permissions] of [
  ['unsupported queries', undefined],
  ['rejected queries', () => Promise.reject(new Error('unsupported'))],
  ['temporary or missing permission', () => Promise.resolve({ state: 'prompt' })],
]) {
  test(`location waits for user action with ${name}`, async () => {
    const h = locationHarness(permissions);
    h.render(); await new Promise(setImmediate); h.render();
    assert.equal(h.requests, 0);
    h.click(); h.click();
    assert.equal(h.requests, 1);
    h.cleanup();
  });
}

test('saved location permission is reused and new parent callbacks do not restart requests', async () => {
  const permission = { state: 'granted', onchange: null };
  const h = locationHarness(() => Promise.resolve(permission));
  h.render(); await new Promise(setImmediate);
  h.render(); h.render();
  assert.equal(h.queries, 1);
  assert.equal(h.requests, 1);
  assert.equal(typeof permission.onchange, 'function');
  h.cleanup();
  assert.equal(permission.onchange, null);
});
