import * as faceapi from 'face-api.js';

// The detector is shared by registration and attendance. Recognition still uses
// the same 128-value descriptor and matching threshold as before.
export const faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});

let detectorPromise: Promise<void> | null = null;
let recognitionPromise: Promise<void> | null = null;

export function loadFaceDetector(): Promise<void> {
  if (!detectorPromise) {
    detectorPromise = faceapi.nets.tinyFaceDetector.loadFromUri('/models').catch(error => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

export function loadFaceRecognition(): Promise<void> {
  if (!recognitionPromise) {
    recognitionPromise = Promise.all([
      loadFaceDetector(),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ]).then(() => undefined).catch(error => {
      recognitionPromise = null;
      throw error;
    });
  }
  return recognitionPromise;
}

let cachedProfile: { key: string; descriptor: Float32Array } | null = null;

export function clearFaceProfileCache() {
  cachedProfile = null;
}

export async function loadFaceProfile(userId: number | string, signal: AbortSignal) {
  const response = await fetch(`/api/profile?user_id=${encodeURIComponent(userId)}`, { signal });
  if (!response.ok) throw new Error('Gagal memuat profil. Silakan coba lagi.');
  const { data } = await response.json();
  if (!data?.is_face_verified || !data.face_verification_url) {
    throw new Error('Anda belum melakukan verifikasi wajah.');
  }
  const key = `${userId}:${data.face_verification_url}`;
  if (cachedProfile?.key === key) return cachedProfile.descriptor;

  const imageResponse = await fetch(data.face_verification_url, { signal });
  if (!imageResponse.ok) throw new Error('Gagal memuat foto verifikasi.');
  const objectUrl = URL.createObjectURL(await imageResponse.blob());
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Gagal membaca foto verifikasi.'));
      img.src = objectUrl;
    });
    await loadFaceRecognition();
    signal.throwIfAborted();
    const detection = await faceapi.detectSingleFace(img, faceDetectorOptions)
      .withFaceLandmarks().withFaceDescriptor();
    signal.throwIfAborted();
    if (!detection) throw new Error('Wajah pada foto verifikasi tidak terdeteksi. Silakan daftar ulang dengan pencahayaan yang cukup.');
    cachedProfile = { key, descriptor: detection.descriptor };
    return detection.descriptor;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
