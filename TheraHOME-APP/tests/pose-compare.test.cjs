// What the comparison engine has to get right before anyone is told their
// form is wrong.
//
// Every test here is a thing that, if it broke, would show a customer a red
// limb they do not deserve — which is the failure that matters. A feature
// that misses a genuine mistake is disappointing; one that invents mistakes
// is one people switch off and distrust.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./call-test-helpers.cjs');

const compare = loadModule('src/lib/poseCompare.ts', {});

/** A seated, front-on body with both arms down. Coordinates are 0..1 in a
 * 16:9 frame, like a real track. */
function pose(overrides = {}) {
  return {
    nose: [0.5, 0.18],
    earL: [0.47, 0.19],
    earR: [0.53, 0.19],
    shoulderL: [0.44, 0.32],
    shoulderR: [0.56, 0.32],
    elbowL: [0.42, 0.46],
    elbowR: [0.58, 0.46],
    wristL: [0.41, 0.6],
    wristR: [0.59, 0.6],
    hipL: [0.46, 0.62],
    hipR: [0.54, 0.62],
    kneeL: [0.45, 0.8],
    kneeR: [0.55, 0.8],
    ankleL: [0.44, 0.95],
    ankleR: [0.56, 0.95],
    ...overrides,
  };
}

const points = (body) => Object.entries(body).map(([k, [x, y]]) => ({ k, x, y, c: 0.95 }));

function track(body, { view = 'front', frames = 20, step = 66 } = {}) {
  const sample = Object.fromEntries(Object.entries(body).map(([k, [x, y]]) => [k, [x, y, 0.95]]));
  return {
    version: 1,
    label: 'test',
    source: 'test.mp4',
    generatedAt: '2026-10-16T00:00:00Z',
    view,
    fps: 15,
    duration: (frames * step) / 1000,
    frameWidth: 1920,
    frameHeight: 1080,
    samples: Array.from({ length: frames }, (_, i) => ({ t: i * step, p: sample })),
  };
}

/** The aspect of the pane the customer is drawn in. Deliberately NOT the
 * clip's: the whole point of passing it separately is that a tall phone
 * pane and a wide clip must still agree about a right angle. */
const PANE_ASPECT = 9 / 16;

test('a body copying the demonstration exactly is entirely ok', () => {
  const body = pose();
  const comparator = compare.createComparator(track(body), { view: 'front' });
  const verdict = comparator.push(points(body), 1920 / 1080, 200);

  assert.equal(verdict.tracking, 'ok');
  assert.equal(verdict.score, 100);
  assert.ok(verdict.measures.length > 0);
  assert.ok(verdict.measures.every((m) => m.level === 'ok'), 'no limb should be flagged');
  assert.equal(verdict.hint, null);
});

test('the same body in a differently shaped pane scores the same', () => {
  // The customer's pane is tall (9:16); the clip is wide (16:9). The SAME
  // physical body therefore has different normalized x's in each — a metre
  // is a bigger fraction of a narrow pane. Re-express the body for the
  // pane and the engine must see no difference at all.
  //
  // If it forgot to undo the frame's shape, every angle would be tens of
  // degrees out and the customer would be red from head to foot. Measured:
  // handing it the clip's numbers as if they were the pane's costs 11
  // points of score on a body that is doing nothing wrong.
  const body = pose();
  const CLIP_ASPECT = 1920 / 1080;
  const inPane = Object.fromEntries(
    Object.entries(body).map(([k, [x, y]]) => [k, [(x * CLIP_ASPECT) / PANE_ASPECT, y]]),
  );

  const comparator = compare.createComparator(track(body), { view: 'front' });
  const verdict = comparator.push(points(inPane), PANE_ASPECT, 200);
  assert.equal(verdict.score, 100, 'the same body is the same body, whatever it is drawn in');
});

test('one bent elbow is flagged, and only that arm', () => {
  const reference = pose();
  // Wrist swung in towards the body: the left elbow closes, nothing else
  // moves.
  const customer = pose({ wristL: [0.52, 0.52] });

  const comparator = compare.createComparator(track(reference), { view: 'front' });
  let verdict;
  // Three frames, because a limb has to stay wrong before it goes red.
  for (let i = 0; i < 3; i += 1) verdict = comparator.push(points(customer), 1920 / 1080, 200);

  const elbow = verdict.measures.find((m) => m.id === 'elbowL');
  assert.equal(elbow.level, 'bad');
  assert.ok(elbow.error > 25, `expected a large error, got ${elbow.error}`);
  assert.equal(verdict.edges['elbowL-wristL'], 'bad');
  assert.equal(verdict.edges['elbowR-wristR'], 'ok', 'the other arm must stay clean');
  assert.equal(verdict.hint.id, 'elbowL');
  assert.ok(verdict.score < 95);
});

test('one wrong limb shows in the score instead of being averaged away', () => {
  // Found while trying the engine against the real day-1 track: a clearly
  // wrong arm scored 88, because one angle out of eight moves the mean by
  // an eighth. The screen would have shown a red arm and a reassuring
  // number beside it, and the number is the one people believe.
  const reference = pose();
  const customer = pose({ wristL: [0.52, 0.52] });
  const comparator = compare.createComparator(track(reference), { view: 'front' });
  let verdict;
  for (let i = 0; i < 4; i += 1) verdict = comparator.push(points(customer), 1920 / 1080, 200);

  assert.equal(verdict.measures.find((m) => m.id === 'elbowL').level, 'bad');
  assert.ok(
    verdict.score < compare.GOOD_SCORE,
    `a limb the app paints red must not score as a good frame (got ${verdict.score})`,
  );
});

test('a limb does not go red on a single bad frame', () => {
  const reference = pose();
  const customer = pose({ wristL: [0.52, 0.52] });
  const comparator = compare.createComparator(track(reference), { view: 'front' });

  const first = comparator.push(points(customer), 1920 / 1080, 200);
  assert.notEqual(first.measures.find((m) => m.id === 'elbowL').level, 'bad');
  assert.equal(first.hint, null, 'nothing should be said on the strength of one frame');
});

test('being half a second behind the clip is not a mistake', () => {
  // The clip moves: an arm comes up over the first second. The customer is
  // doing it correctly but 400ms late.
  const down = pose();
  const up = pose({ elbowL: [0.33, 0.3], wristL: [0.28, 0.17] });
  const reference = track(down);
  reference.samples = reference.samples.map((sample, i) => ({
    t: sample.t,
    p: i < 8 ? sample.p : Object.fromEntries(Object.entries(up).map(([k, [x, y]]) => [k, [x, y, 0.95]])),
  }));

  const comparator = compare.createComparator(reference, { view: 'front' });
  // Clip is at 660ms (arm already up); the customer's arm is still down,
  // which matches the clip at ~260ms — inside the tolerance window.
  const verdict = comparator.push(points(down), 1920 / 1080, 660);

  assert.ok(verdict.score >= 95, `a late copy should still score well, got ${verdict.score}`);
  assert.ok(verdict.matchedMs < 530, `should have matched an earlier moment, matched ${verdict.matchedMs}`);
});

test('a joint the camera cannot see is greyed, never blamed', () => {
  const reference = pose();
  const customer = points(pose()).map((p) => (p.k === 'wristL' || p.k === 'elbowL' ? { ...p, c: 0.1 } : p));

  const comparator = compare.createComparator(track(reference), { view: 'front' });
  let verdict;
  for (let i = 0; i < 5; i += 1) verdict = comparator.push(customer, 1920 / 1080, 200);

  assert.equal(verdict.edges['elbowL-wristL'], 'weak');
  assert.ok(!verdict.measures.some((m) => m.id === 'elbowL'), 'an unseen elbow is not a measurement');
  assert.equal(verdict.hint, null);
  assert.equal(verdict.tracking, 'partial');
});

test('nobody in frame is reported as lost, not as bad form', () => {
  const comparator = compare.createComparator(track(pose()), { view: 'front' });
  const verdict = comparator.push([], 1920 / 1080, 200);
  assert.equal(verdict.tracking, 'lost');
  assert.equal(verdict.measures.length, 0);
  assert.equal(verdict.hint, null);
});

test('a side-on exercise is not scored on angles a side camera cannot see', () => {
  const comparator = compare.createComparator(track(pose(), { view: 'side' }), { view: 'side' });
  const verdict = comparator.push(points(pose()), 1920 / 1080, 200);
  const ids = verdict.measures.map((m) => m.id);
  assert.ok(!ids.includes('shoulderTilt'), 'shoulders overlap from the side');
  assert.ok(!ids.includes('headTurn'), 'a yaw guess from the side is noise');
  assert.ok(ids.includes('kneeL'), 'knees are exactly what a side camera sees');
});

test('mirroring swaps which arm the customer is told to move', () => {
  const reference = pose({ elbowL: [0.33, 0.3], wristL: [0.28, 0.17] }); // specialist raises their left
  const customer = pose({ elbowR: [0.67, 0.3], wristR: [0.72, 0.17] }); // customer raises their right

  const mirrored = compare.createComparator(track(reference), { view: 'front', mirror: true });
  const straight = compare.createComparator(track(reference), { view: 'front', mirror: false });

  const withMirror = mirrored.push(points(customer), 1920 / 1080, 200);
  const withoutMirror = straight.push(points(customer), 1920 / 1080, 200);

  assert.ok(withMirror.score > withoutMirror.score + 10,
    `mirroring should accept the copy (${withMirror.score}) that the straight comparison rejects (${withoutMirror.score})`);
});

test('the session summary names the worst joint, not a random one', () => {
  const reference = pose();
  const customer = pose({ wristL: [0.52, 0.52] });
  const comparator = compare.createComparator(track(reference), { view: 'front' });
  for (let i = 0; i < 10; i += 1) comparator.push(points(customer), 1920 / 1080, 200);

  const summary = comparator.summary();
  assert.equal(summary.frames, 10);
  assert.equal(summary.worst, 'elbowL');
  assert.ok(summary.averageScore > 0 && summary.averageScore < 100);
});

test('direction says which way to move, not just that something is wrong', () => {
  const reference = pose();
  const bent = pose({ wristL: [0.52, 0.52] }); // elbow closed up
  const comparator = compare.createComparator(track(reference), { view: 'front' });
  let verdict;
  for (let i = 0; i < 4; i += 1) verdict = comparator.push(points(bent), 1920 / 1080, 200);

  const elbow = verdict.measures.find((m) => m.id === 'elbowL');
  assert.equal(elbow.direction, -1, 'a closed elbow is a smaller angle than the demonstration');
});
