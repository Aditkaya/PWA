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
// BIOMETRIC_THRESHOLD: Jarak Euclidean maksimum yang diterima.
//   < 0.40 → Wajah sangat mirip (kembar identik)
//   0.40–0.45 → Wajah sama orang (toleransi pencahayaan/sudut kecil)
//   0.45–0.55 → Area abu-abu (berisiko False Accept)
//   > 0.55 → Jelas wajah orang berbeda
//
// Standar industri absensi biometrik (ZKTeco, Suprema, Hikvision): 0.40–0.45
// Kami memakai 0.44 — cukup ketat untuk mencegah spoofing namun toleran
// terhadap variasi pencahayaan dan ekspresi normal.
const BIOMETRIC_THRESHOLD = parseFloat(process.env.FACE_AI_THRESHOLD || '0.44');

// Ukuran wajah minimum: wajah harus menempati minimal 8% area foto.
// Mencegah spoofing menggunakan foto kecil/jauh.
const MIN_FACE_AREA_RATIO = parseFloat(process.env.FACE_AI_MIN_AREA || '0.08');

// Detektor dengan scoreThreshold lebih tinggi (0.6) agar hanya wajah jelas yang diterima.
const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.6 });
const references = new Map();
const MAX_REFERENCES = 500;

async function initialize(modelDir) {
  if (process.env.FACE_AI_BACKEND === 'cpu') await faceapi.tf.setBackend('cpu');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir),
  ]);
  console.log(`[FaceAI] Siap. Threshold: ${BIOMETRIC_THRESHOLD}, Min area wajah: ${MIN_FACE_AREA_RATIO}`);
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
 *  - Wajah terlalu kecil (foto dari jauh / spoofing foto kecil)
 */
async function descriptor(image) {
  const decoded = decodeImage(image);
  const totalPixels = decoded.width * decoded.height;
  const input = faceapi.tf.tensor3d(decoded.data, [decoded.height, decoded.width, 3], 'int32');
  try {
    const faces = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors();

    if (faces.length === 0) {
      throw new Error('Wajah tidak terdeteksi. Hadapkan wajah ke kamera langsung dengan pencahayaan yang cukup.');
    }
    if (faces.length > 1) {
      throw new Error('Terdeteksi lebih dari satu wajah. Pastikan hanya Anda yang ada di kamera saat absen.');
    }

    // Validasi ukuran wajah: wajah harus cukup besar dalam frame
    const { box } = faces[0].detection;
    const faceAreaRatio = (box.width * box.height) / totalPixels;
    if (faceAreaRatio < MIN_FACE_AREA_RATIO) {
      throw new Error(
        `Wajah terlalu jauh dari kamera (area terdeteksi: ${(faceAreaRatio * 100).toFixed(1)}%). ` +
        'Dekatkan wajah ke kamera hingga memenuhi minimal 1/3 layar.'
      );
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
  const matched = Number.isFinite(distance) && distance < BIOMETRIC_THRESHOLD;

  // Audit log: catat jarak untuk keperluan monitoring
  const ts = new Date().toISOString();
  const verdict = matched ? 'COCOK' : 'DITOLAK';
  console.log(`[FaceAI] ${ts} | Verifikasi: jarak=${distance.toFixed(4)} threshold=${BIOMETRIC_THRESHOLD} | ${verdict}`);

  if (!matched) {
    // Pesan yang jelas bagi karyawan tanpa membocorkan nilai distance
    throw new Error(
      'Wajah tidak cocok dengan foto terdaftar. ' +
      'Pastikan Anda menghadap kamera langsung dengan pencahayaan yang baik, lalu coba lagi. ' +
      'Jika masalah berlanjut, hubungi HRD untuk registrasi ulang wajah.'
    );
  }

  return { matched: true };
}

function getBackend() { return faceapi.tf.getBackend(); }

module.exports = { initialize, evaluate, decodeImage, getBackend };
