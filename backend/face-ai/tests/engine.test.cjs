const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const jpeg = require('jpeg-js');
const api = require('face-api.js');
const { initialize, evaluate, decodeImage } = require('../engine.cjs');

test('invalid JPEG is rejected without model inference', () => {
  assert.throws(() => decodeImage('not-a-photo'), /tidak valid/);
  assert.throws(() => decodeImage(Buffer.from('invalid').toString('base64')), /tidak dapat dibaca/);
});

test('real server models load from disk and reject a photo with no face', async () => {
  await initialize(path.resolve(__dirname, '../models'));
  const image = jpeg.encode({ width: 160, height: 160, data: Buffer.alloc(160 * 160 * 4, 255) }).data.toString('base64');
  const before = api.tf.memory().numTensors;
  await assert.rejects(evaluate('/validate', { image }), /Wajah tidak terdeteksi/);
  await assert.rejects(evaluate('/verify', { image, reference: image }), /Wajah tidak terdeteksi/);
  assert.equal(api.tf.memory().numTensors, before, 'request tensors are disposed');
  // Supply a deterministic detection to exercise real landmark/descriptor nets
  // in Node without DOM/canvas. This checks plumbing, not face-match accuracy.
  const original = api.nets.tinyFaceDetector.locateFaces;
  api.nets.tinyFaceDetector.locateFaces = async () => [
    new api.FaceDetection(0.99, new api.Rect(0.2, 0.2, 0.6, 0.6), { width: 160, height: 160 }),
  ];
  try {
    assert.deepEqual(await evaluate('/verify', { image, reference: image }), { matched: true });
    assert.equal(api.tf.memory().numTensors, before, 'descriptor tensors are also disposed');
  } finally {
    api.nets.tinyFaceDetector.locateFaces = original;
  }
  [api.nets.tinyFaceDetector, api.nets.faceLandmark68Net, api.nets.faceRecognitionNet].forEach(net => net.dispose());
});
