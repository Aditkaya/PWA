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

// ---------------------------------------------------------------------------
// Standar Biometrik Perusahaan
// ---------------------------------------------------------------------------
// BIOMETRIC_THRESHOLD: jarak Euclidean maksimum untuk menerima kecocokan.
// Nilai 0.50 lebih toleran terhadap perubahan pencahayaan, sudut, dan ekspresi.
// Nilai yang lebih tinggi juga meningkatkan risiko dua orang berbeda dianggap cocok.
const BIOMETRIC_THRESHOLD = parseFloat(process.env.FACE_AI_THRESHOLD || '0.50');

// Input lebih besar dan ambang deteksi lebih rendah membantu kamera HP yang
// kurang tajam serta wajah yang berada agak jauh dari kamera.
const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.2 });
const references = new Map();
const MAX_REFERENCES = 500;

async function initialize(modelDir) {
  if (process.env.FACE_AI_BACKEND === 'cpu') await faceapi.tf.setBackend('cpu');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir),
  ]);
  console.log(`[FaceAI] Siap. Threshold kecocokan: ${BIOMETRIC_THRESHOLD}`);
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

/**
 * Ambil face descriptor dan validasi kualitas wajah.
 * Throws jika:
 *  - Tidak ada atau lebih dari 1 wajah
 *  - Wajah tidak dapat dideteksi atau lebih dari satu wajah
 */
async function descriptor(image) {
  const decoded = decodeImage(image);
  const input = faceapi.tf.tensor3d(decoded.data, [decoded.height, decoded.width, 3], 'int32');
  try {
    const faces = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors();

    if (faces.length === 0) {
      throw new Error('Wajah tidak terdeteksi. Hadapkan wajah ke kamera dan pastikan seluruh wajah masuk ke bingkai.');
    }
    if (faces.length > 1) {
      throw new Error('Terdeteksi lebih dari satu wajah. Pastikan hanya Anda yang ada di kamera saat absen.');
    }

    return {
      descriptor: faces[0].descriptor,
      box: faces[0].detection.box,
      width: decoded.width,
      height: decoded.height,
    };
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
    reference = (await descriptor(payload.reference)).descriptor;
    if (references.size >= MAX_REFERENCES) references.delete(references.keys().next().value);
  }
  references.delete(key);
  references.set(key, reference);

  const distance = faceapi.euclideanDistance(candidate.descriptor, reference);
  const matched = Number.isFinite(distance) && distance < BIOMETRIC_THRESHOLD;

  // Audit log: catat jarak untuk keperluan monitoring
  const ts = new Date().toISOString();
  const verdict = matched ? 'COCOK' : 'DITOLAK';
  console.log(`[FaceAI] ${ts} | Verifikasi: jarak=${distance.toFixed(4)} threshold=${BIOMETRIC_THRESHOLD} | ${verdict}`);

  if (!matched) {
    // Pesan yang jelas bagi karyawan tanpa membocorkan nilai distance
    throw new Error(
      'Wajah tidak cocok dengan foto terdaftar. ' +
      'Pastikan wajah terlihat jelas dan menghadap kamera, lalu coba lagi. ' +
      'Jika masalah berlanjut, hubungi HRD untuk registrasi ulang wajah.'
    );
  }

  return { matched: true };
}

function getBackend() { return faceapi.tf.getBackend(); }

module.exports = { initialize, evaluate, decodeImage, getBackend };
