// The rule this file exists to protect: a mistake in the config must never
// lock a working app. Every "unknown" has to resolve to 'none'.
//
// The failure being guarded against is specific. These thresholds are typed
// into a web form by a person, read by every install on the next launch, and
// the 'required' verdict has no way past it. A stray character in that field
// would otherwise take every customer's app away at once, with the fix
// needing the same admin who made the typo to notice.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./call-test-helpers.cjs');

const { compareVersions, decideUpdate } = loadModule('src/lib/appUpdate.ts', {
  'react-native': { Linking: {}, Platform: { OS: 'ios' } },
});

test('compares versions numerically, not as text', () => {
  // The one every hand-rolled string compare gets wrong.
  assert.equal(compareVersions('1.9.0', '1.10.0'), -1);
  assert.equal(compareVersions('1.0.2', '1.0.2'), 0);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
});

test('treats a missing part as zero', () => {
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1.2', '1.2.1'), -1);
});

test('forgives what an admin actually types', () => {
  assert.equal(compareVersions('v1.0.3', '1.0.3'), 0);
  assert.equal(compareVersions('1.0.2-beta', '1.0.2'), 0);
  assert.equal(compareVersions(' 1.0.4 ', '1.0.3'), 1);
});

test('says "unanswerable" rather than guessing', () => {
  assert.equal(compareVersions('', '1.0.0'), null);
  assert.equal(compareVersions('latest', '1.0.0'), null);
});

const AT = '1.0.2';

test('no thresholds set is the off switch', () => {
  assert.equal(decideUpdate({ current: AT, minimum: '', latest: '' }), 'none');
  assert.equal(decideUpdate({ current: AT, minimum: null, latest: undefined }), 'none');
});

test('below the minimum is required, below the latest is optional', () => {
  assert.equal(decideUpdate({ current: AT, minimum: '1.0.3', latest: '1.0.5' }), 'required');
  assert.equal(decideUpdate({ current: AT, minimum: '1.0.0', latest: '1.0.5' }), 'optional');
  assert.equal(decideUpdate({ current: AT, minimum: '1.0.0', latest: '1.0.2' }), 'none');
});

test('the newest build is never nagged', () => {
  assert.equal(decideUpdate({ current: '2.0.0', minimum: '1.0.0', latest: '1.9.0' }), 'none');
});

test('garbage in the config cannot lock anybody out', () => {
  // Each of these used to be a plausible way to brick every install.
  assert.equal(decideUpdate({ current: AT, minimum: 'sắp tới', latest: '' }), 'none');
  assert.equal(decideUpdate({ current: AT, minimum: '-', latest: 'mới nhất' }), 'none');
  assert.equal(decideUpdate({ current: '', minimum: '9.9.9', latest: '9.9.9' }), 'none');
  assert.equal(decideUpdate({ current: null, minimum: '9.9.9', latest: '9.9.9' }), 'none');
});
