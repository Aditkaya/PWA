// The native backend uses the same TFJS core/models but executes inference in
// TensorFlow C++. Keep CPU mode available for unsupported development machines.
if (process.env.FACE_AI_BACKEND !== 'cpu') {
  try {
    require('@tensorflow/tfjs-node');
  } catch (error) {
    if (process.env.FACE_AI_BACKEND === 'tensorflow') throw error;
    console.warn('TensorFlow native tidak tersedia; memakai CPU JavaScript.');
  }
}
const faceapi = require('face-api.js');
const jpeg = require('jpeg-js');
const crypto = require('node:crypto');

const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
const references = new Map();
const MAX_REFERENCES = 500;

async function initialize(modelDir) {
  if (process.env.FACE_AI_BACKEND === 'cpu') await faceapi.tf.setBackend('cpu');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir),
  ]);
}

function decodeImage(value) {
  if (typeof value !== 'string' || value.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Foto tidak valid atau terlalu besar.');
  }
  try {
    const bytes = Buffer.from(value, 'base64');
    return jpeg.decode(bytes, { useTArray: true, formatAsRGBA: false,
      maxResolutionInMP: 2, maxMemoryUsageInMB: 64, tolerantDecoding: false });
  } catch {
    throw new Error('Foto JPEG tidak dapat dibaca.');
  }
}

async function descriptor(image) {
  const decoded = decodeImage(image);
  const input = faceapi.tf.tensor3d(decoded.data, [decoded.height, decoded.width, 3], 'int32');
  try {
    const faces = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors();
    if (faces.length !== 1) {
      throw new Error(faces.length ? 'Pastikan hanya satu wajah terlihat pada foto.' : 'Wajah tidak terdeteksi. Hadapkan wajah ke kamera dengan pencahayaan yang cukup.');
    }
    return faces[0].descriptor;
  } finally {
    input.dispose();
  }
}

async function evaluate(operation, payload) {
  const candidate = await descriptor(payload.image);
  if (operation === '/validate') return { valid: true };
  if (operation !== '/verify') throw new Error('Operasi tidak valid.');
  if (typeof payload.reference !== 'string') throw new Error('Foto wajah terdaftar tidak tersedia.');
  const key = crypto.createHash('sha256').update(payload.reference).digest('hex');
  let reference = references.get(key);
  if (!reference) {
    reference = await descriptor(payload.reference);
    if (references.size >= MAX_REFERENCES) references.delete(references.keys().next().value);
  }
  references.delete(key);
  references.set(key, reference);
  const distance = faceapi.euclideanDistance(candidate, reference);
  return { matched: Number.isFinite(distance) && distance < 0.58 };
}

function getBackend() { return faceapi.tf.getBackend(); }

module.exports = { initialize, evaluate, decodeImage, getBackend };
