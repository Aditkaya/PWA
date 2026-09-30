// Utility untuk mengelola antrean absensi offline berbasis IndexedDB

export interface OfflineAttendanceItem {
  id: string;
  user_id: number;
  tipe: string;
  foto_base64: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  location_age_ms?: number | null;
  detail_lokasi?: string | null;
  keterangan?: string | null;
  waktu_offline: string; // format: 'YYYY-MM-DD HH:mm:ss'
  created_at: number;    // timestamp ms
  status?: 'pending' | 'syncing' | 'failed';
  error_message?: string;
}

const DB_NAME = 'aypsis_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB'));
  });
}

export async function saveOfflineAttendance(item: OfflineAttendanceItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Gagal menyimpan absensi offline'));
  });
}

export async function getOfflineAttendances(): Promise<OfflineAttendanceItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as OfflineAttendanceItem[]) || [];
        // Urutkan berdasarkan waktu paling lama dulu (FIFO)
        results.sort((a, b) => a.created_at - b.created_at);
        resolve(results);
      };
      request.onerror = () => reject(request.error || new Error('Gagal mengambil antrean offline'));
    });
  } catch (err) {
    console.warn('Gagal membaca IndexedDB:', err);
    return [];
  }
}

export async function removeOfflineAttendance(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Gagal menghapus antrean offline'));
  });
}

export async function getPendingOfflineCount(): Promise<number> {
  try {
    const items = await getOfflineAttendances();
    return items.length;
  } catch {
    return 0;
  }
}

export async function syncOfflineAttendances(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const items = await getOfflineAttendances();
  if (items.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const formData = new FormData();
      formData.append('user_id', item.user_id.toString());
      formData.append('tipe', item.tipe);
      formData.append('foto_base64', item.foto_base64);
      formData.append('is_offline', '1');
      formData.append('waktu_offline', item.waktu_offline);

      if (item.latitude !== null && item.latitude !== undefined) {
        formData.append('latitude', item.latitude.toString());
      }
      if (item.longitude !== null && item.longitude !== undefined) {
        formData.append('longitude', item.longitude.toString());
      }
      if (item.gps_accuracy !== null && item.gps_accuracy !== undefined) {
        formData.append('gps_accuracy', item.gps_accuracy.toString());
      }
      if (item.location_age_ms !== null && item.location_age_ms !== undefined) {
        formData.append('location_age_ms', item.location_age_ms.toString());
      }
      if (item.detail_lokasi) {
        formData.append('detail_lokasi', item.detail_lokasi);
      }
      if (item.keterangan) {
        formData.append('keterangan', item.keterangan);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/attendance/break', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (response.ok) {
        // Hapus dari IndexedDB jika berhasil
        await removeOfflineAttendance(item.id);
        successCount++;
      } else {
        const data = await response.json().catch(() => ({}));
        const errMsg = data.message || `Server error (${response.status})`;
        
        // Jika server error 502/503/504 (server masih mati), hentikan loop agar tidak buang-buang koneksi
        if ([502, 503, 504].includes(response.status)) {
          errors.push('Server masih belum merespons (Offline). Sinkronisasi ditunda.');
          break;
        }

        // Jika validasi bisnis ditolak permanen (misal 400/422 wajah tidak cocok), simpan error
        failedCount++;
        errors.push(`Absen ${item.tipe}: ${errMsg}`);
        // Jika error validasi wajah / format, tetap hapus agar tidak menyangkut selamanya, tapi catat error
        if (response.status === 422 || response.status === 400) {
          await removeOfflineAttendance(item.id);
        }
      }
    } catch (netErr: any) {
      // Jaringan terputus saat proses sync
      console.warn('Network error during sync:', netErr);
      errors.push('Koneksi terputus saat sinkronisasi.');
      break; // Stop loop, coba lagi nanti
    }

    if (onProgress) {
      onProgress(successCount + failedCount, items.length);
    }
  }

  return { success: successCount, failed: failedCount, errors };
}
