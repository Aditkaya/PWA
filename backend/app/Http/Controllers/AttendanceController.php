<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../Services/FaceVerificationService.php';

use Database;
use PDO;
use Exception;

class AttendanceController {
    
    public function submitBreak($postData) {
        $user_id = $postData['user_id'] ?? null;
        $tipe = $postData['tipe'] ?? null;
        $foto_base64 = $postData['foto_base64'] ?? null;
        $latitude = $postData['latitude'] ?? null;
        $longitude = $postData['longitude'] ?? null;
        $detail_lokasi = $postData['detail_lokasi'] ?? null;
        $keterangan = $postData['keterangan'] ?? null;

        if (!$user_id || !$tipe) {
            http_response_code(400);
            echo json_encode(['message' => 'Data user_id dan tipe diperlukan']);
            return;
        }
        // Check location quality before face verification or any writes.
        $accuracy = $postData['gps_accuracy'] ?? null;
        $locationAge = $postData['location_age_ms'] ?? null;
        if (!is_numeric($latitude) || !is_numeric($longitude)
            || !is_finite((float)$latitude) || !is_finite((float)$longitude)
            || abs((float)$latitude) > 90 || abs((float)$longitude) > 180
            || !is_numeric($accuracy) || !is_finite((float)$accuracy)
            || (float)$accuracy <= 0 || (float)$accuracy > 50
            || !is_numeric($locationAge) || !is_finite((float)$locationAge)
            || (float)$locationAge < 0 || (float)$locationAge > 30000) {
            http_response_code(422);
            echo json_encode(['message' => 'Lokasi belum valid. Cari ulang GPS dengan akurasi maksimal 50 meter, lalu ambil foto kembali.']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            
            // Get karyawan_id and nik first
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.nik FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if (!$userData) {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
                return;
            }
            $karyawan_id = $userData['karyawan_id'];
            $nik = $userData['nik'] ?? $user_id; // Fallback if missing

            $today = date('Y-m-d');
            
            // Cek Izin Tidak Masuk / Sakit
            $stmtLeave = $pdo->prepare("SELECT id FROM permohonan_izins WHERE karyawan_id = ? AND (jenis_izin = 'Tidak Masuk' OR jenis_izin = 'Sakit') AND LOWER(status) = 'disetujui' AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
            $stmtLeave->execute([$karyawan_id, $today]);
            
            // Cek Cuti
            $stmtCutiLeave = $pdo->prepare("SELECT id FROM cutis WHERE karyawan_id = ? AND (LOWER(status) = 'approved' OR LOWER(status) = 'disetujui') AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
            $stmtCutiLeave->execute([$karyawan_id, $today]);
            
            if ($stmtLeave->fetch() || $stmtCutiLeave->fetch()) {
                http_response_code(403);
                echo json_encode(['message' => 'Anda tidak dapat melakukan absensi karena sedang dalam masa Izin/Cuti.']);
                return;
            }

            // Validasi: Istirahat hanya boleh 1x sehari
            // Jika tipe = Istirahat Keluar, cek apakah sudah ada Istirahat Masuk hari ini
            if (strtolower($tipe) === 'istirahat keluar') {
                $stmtCek = $pdo->prepare("SELECT COUNT(*) as total FROM absensis WHERE karyawan_id = ? AND tipe IN ('Istirahat Keluar', 'Istirahat Masuk') AND DATE(waktu) = CURDATE()");
                $stmtCek->execute([$karyawan_id]);
                $cekResult = $stmtCek->fetch();
                if ($cekResult['total'] >= 2) {
                    // Sudah ada pasangan Istirahat Keluar + Istirahat Masuk, tolak
                    http_response_code(400);
                    echo json_encode(['message' => 'Istirahat hanya dapat dilakukan 1 kali per hari']);
                    return;
                }
                if ($cekResult['total'] >= 1) {
                    // Sudah ada Istirahat Keluar, tidak boleh keluar lagi
                    http_response_code(400);
                    echo json_encode(['message' => 'Anda sudah melakukan Istirahat Keluar hari ini']);
                    return;
                }
            }

            // Verification is mandatory before any photo or attendance is saved.
            (new \App\Services\FaceVerificationService())->verifyAttendance($pdo, $user_id, $foto_base64);

            // Save image
            $tipe_folder = strtolower(str_replace([' ', '/'], '_', $tipe));
            $upload_dir = UPLOAD_BASE_DIR . '/uploads/attendance/' . $tipe_folder . '/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            
            if ($foto_base64) {
                $image_parts = explode(";base64,", $foto_base64);
                if (count($image_parts) == 2) {
                    $image_base64 = base64_decode($image_parts[1]);
                    $filename = 'break_' . $nik . '_' . time() . '.jpg';
                    $file_path = $upload_dir . $filename;
                    file_put_contents($file_path, $image_base64);
                    $db_photo_path = 'uploads/attendance/' . $tipe_folder . '/' . $filename;
                    // Duplikat ke public AYPSIS agar bisa diakses via Laravel
                    $aypsis_dir = AYPSIS_PUBLIC_DIR . '/uploads/attendance/' . $tipe_folder . '/';
                    if (!is_dir($aypsis_dir)) { mkdir($aypsis_dir, 0755, true); }
                    if (AYPSIS_PUBLIC_DIR !== UPLOAD_BASE_DIR) { file_put_contents($aypsis_dir . $filename, $image_base64); }
                } else {
                    $db_photo_path = null;
                }
            } else {
                $db_photo_path = null;
            }

            // Validasi Lokasi Absensi Wajib & Radius Geofence (Opsi B: Status Persetujuan jika di luar radius)
            $statusAbsensi = 'Selesai';
            $finalDetailLokasi = $detail_lokasi;

            // 1. Ambil lokasi penugasan khusus karyawan
            $stmtSpecialLoc = $pdo->prepare("
                SELECT la.id, la.latitude, la.longitude, la.radius, la.nama_lokasi, la.tipe_penugasan
                FROM lokasi_absensis la
                INNER JOIN lokasi_absensi_karyawan lak ON la.id = lak.lokasi_absensi_id
                WHERE lak.karyawan_id = ? AND la.is_active = 1
            ");
            $stmtSpecialLoc->execute([$karyawan_id]);
            $assignedLocations = $stmtSpecialLoc->fetchAll();
            $hasSpecialAssignment = !empty($assignedLocations);

            // 2. Jika tidak ada penugasan khusus, ambil lokasi bertipe 'semua'
            if (empty($assignedLocations)) {
                $stmtSemuaLoc = $pdo->query("
                    SELECT id, latitude, longitude, radius, nama_lokasi, tipe_penugasan
                    FROM lokasi_absensis
                    WHERE is_active = 1 AND (tipe_penugasan = 'semua' OR tipe_penugasan IS NULL)
                ");
                $assignedLocations = $stmtSemuaLoc->fetchAll();
            }

            // 3. Fallback jika masih kosong
            if (empty($assignedLocations)) {
                $stmtFallbackLoc = $pdo->query("
                    SELECT id, latitude, longitude, radius, nama_lokasi, tipe_penugasan
                    FROM lokasi_absensis
                    WHERE is_active = 1
                ");
                $assignedLocations = $stmtFallbackLoc->fetchAll();
            }

            $nearestLoc = null;
            $nearestDistance = null;
            $isInRadius = false;

            if ($latitude !== null && $longitude !== null && !empty($assignedLocations)) {
                $lat1 = deg2rad((float)$latitude);
                $lon1 = deg2rad((float)$longitude);

                foreach ($assignedLocations as $loc) {
                    if (!is_numeric($loc['latitude']) || !is_numeric($loc['longitude'])) {
                        continue;
                    }
                    $lat2 = deg2rad((float)$loc['latitude']);
                    $lon2 = deg2rad((float)$loc['longitude']);
                    $dLat = $lat2 - $lat1;
                    $dLon = $lon2 - $lon1;
                    $a = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLon / 2) ** 2;
                    $dist = 6371000 * 2 * atan2(sqrt($a), sqrt(1 - $a));

                    if ($nearestDistance === null || $dist < $nearestDistance) {
                        $nearestDistance = $dist;
                        $nearestLoc = $loc;
                    }

                    if ($dist <= (int)$loc['radius']) {
                        $isInRadius = true;
                        $nearestDistance = $dist;
                        $nearestLoc = $loc;
                        break;
                    }
                }

                if ($nearestLoc) {
                    $distRound = round($nearestDistance);
                    if ($isInRadius) {
                        $statusAbsensi = 'Selesai';
                        $locNote = "{$nearestLoc['nama_lokasi']} (Jarak: {$distRound}m)";
                        $finalDetailLokasi = $detail_lokasi ? ($detail_lokasi . " - " . $locNote) : $locNote;
                    } else {
                        // Di luar radius lokasi wajib -> Status Persetujuan
                        $statusAbsensi = 'Persetujuan';
                        $locNote = "Di luar radius {$nearestLoc['nama_lokasi']} (Jarak: {$distRound}m, Radius: {$nearestLoc['radius']}m)";
                        $finalDetailLokasi = $detail_lokasi ? ($detail_lokasi . " | " . $locNote) : $locNote;
                    }
                }
            } elseif ($hasSpecialAssignment && ($latitude === null || $longitude === null)) {
                // Karyawan punya lokasi khusus tetapi tidak ada koordinat GPS
                $statusAbsensi = 'Persetujuan';
                $finalDetailLokasi = ($detail_lokasi ? $detail_lokasi . " | " : "") . "Koordinat GPS tidak terdeteksi pada lokasi wajib";
            }

            // Insert into absensis
            $stmt = $pdo->prepare("INSERT INTO absensis (karyawan_id, nik, waktu, tipe, status, foto, latitude, longitude, detail_lokasi, keterangan) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$karyawan_id, $nik, $tipe, $statusAbsensi, $db_photo_path, $latitude, $longitude, $finalDetailLokasi, $keterangan]);

            $normalizedTipe = strtolower(str_replace('_', ' ', $tipe));
            if (in_array($normalizedTipe, ['lembur pulang', 'selesai lembur', 'lembur keluar'])) {
                require_once __DIR__ . '/../../Helpers/OvertimeValidator.php';
                require_once __DIR__ . '/../../Helpers/AttendanceWorkDate.php';

                // Resolve the inserted end log using the same session as history/AYPSIS.
                $endId = $pdo->lastInsertId();
                $workDate = \App\Helpers\AttendanceWorkDate::sql('mysql', 'a', 0);
                $stmtSession = $pdo->prepare("SELECT $workDate FROM absensis a WHERE a.id = ?");
                $stmtSession->execute([$endId]);
                $tanggalSesiLembur = $stmtSession->fetchColumn();

                \App\Helpers\OvertimeValidator::checkAndCreateApproval($karyawan_id, $tanggalSesiLembur);
            }

            $successMsg = ($statusAbsensi === 'Persetujuan' && $nearestLoc)
                ? "Absensi {$tipe} tercatat di luar radius lokasi wajib ({$nearestLoc['nama_lokasi']}) dan memerlukan persetujuan."
                : 'Absensi berhasil';

            http_response_code(200);
            echo json_encode([
                'message' => $successMsg,
                'status' => $statusAbsensi,
                'is_approval' => ($statusAbsensi === 'Persetujuan')
            ]);
        } catch (\App\Services\FaceVerificationException $e) {
            http_response_code($e->getCode());
            echo json_encode(['message' => $e->getMessage()]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function submitLupaAbsen($postData) {
        $user_id = $postData['user_id'] ?? null;
        $tanggal = $postData['tanggal'] ?? null;
        $tipe_absen = $postData['tipe_absen'] ?? null;
        $waktu = $postData['waktu'] ?? null;
        $alasan = $postData['alasan'] ?? null;

        if ($user_id === null || $user_id === '' || 
            $tanggal === null || $tanggal === '' || 
            $tipe_absen === null || $tipe_absen === '' || 
            $waktu === null || $waktu === '' || 
            $alasan === null || $alasan === '') {
            http_response_code(400);
            echo json_encode(['message' => 'Lengkapi semua form! Data yang diterima: ' . json_encode($postData)]);
            return;
        }
        try {
            $pdo = Database::getConnection();
            
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if (!$userData || !$userData['karyawan_id']) {
                http_response_code(404);
                echo json_encode(['message' => 'Karyawan tidak ditemukan']);
                return;
            }
            $karyawan_id = $userData['karyawan_id'];

            $initialStatus = 'pending';

            $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lupas (karyawan_id, tanggal, tipe_absen, waktu, alasan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$karyawan_id, $tanggal, $tipe_absen, $waktu, $alasan, $initialStatus]);

            http_response_code(200);
            echo json_encode(['message' => 'Pengajuan Lupa Absen berhasil dikirim']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function submitLembur($postData) {
        $user_id = $postData['user_id'] ?? null;
        $tanggal = $postData['tanggal'] ?? null;
        $jam_mulai = $postData['jam_mulai'] ?? null;
        $jam_selesai = $postData['jam_selesai'] ?? null;
        $keterangan = $postData['keterangan'] ?? null;
        $foto_base64 = $postData['foto_base64'] ?? null;
        $latitude = $postData['latitude'] ?? null;
        $longitude = $postData['longitude'] ?? null;
        $detail_lokasi = $postData['detail_lokasi'] ?? null;

        if ($user_id === null || $user_id === '' || 
            $tanggal === null || $tanggal === '' || 
            $jam_mulai === null || $jam_mulai === '' || 
            $jam_selesai === null || $jam_selesai === '' || 
            $keterangan === null || $keterangan === '') {
            http_response_code(400);
            echo json_encode(['message' => 'Lengkapi semua form! Data yang diterima: ' . json_encode($postData)]);
            return;
        }
        try {
            $pdo = Database::getConnection();
            
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.nik FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if (!$userData || !$userData['karyawan_id']) {
                http_response_code(404);
                echo json_encode(['message' => 'Karyawan tidak ditemukan']);
                return;
            }
            $karyawan_id = $userData['karyawan_id'];
            $nik = $userData['nik'] ?? $user_id;

            $db_photo_path = null;
            if ($foto_base64) {
                $upload_dir = UPLOAD_BASE_DIR . '/uploads/attendance/lembur/';
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }
                $image_parts = explode(";base64,", $foto_base64);
                if (count($image_parts) == 2) {
                    $image_base64 = base64_decode($image_parts[1]);
                    $filename = 'lembur_' . $nik . '_' . time() . '.jpg';
                    $file_path = $upload_dir . $filename;
                    file_put_contents($file_path, $image_base64);
                    $db_photo_path = 'uploads/attendance/lembur/' . $filename;
                    // Duplikat ke public AYPSIS agar bisa diakses via Laravel
                    if (defined('AYPSIS_PUBLIC_DIR')) {
                        $aypsis_dir = AYPSIS_PUBLIC_DIR . '/uploads/attendance/lembur/';
                        if (!is_dir($aypsis_dir)) { @mkdir($aypsis_dir, 0777, true); }
                        if (AYPSIS_PUBLIC_DIR !== UPLOAD_BASE_DIR) { @file_put_contents($aypsis_dir . $filename, $image_base64); }
                    }
                }
            }

            $initialStatus = 'pending';

            $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, foto, detail_lokasi, latitude, longitude, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$karyawan_id, $tanggal, $jam_mulai, $jam_selesai, $keterangan, $db_photo_path, $detail_lokasi, $latitude, $longitude, $initialStatus]);

            http_response_code(200);
            echo json_encode(['message' => 'Pengajuan Lembur berhasil dikirim']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
