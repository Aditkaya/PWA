<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;
use App\Services\PushNotificationService;

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

            // Insert into absensis
            $stmt = $pdo->prepare("INSERT INTO absensis (karyawan_id, nik, waktu, tipe, status, foto, latitude, longitude, detail_lokasi, keterangan) VALUES (?, ?, NOW(), ?, 'Selesai', ?, ?, ?, ?, ?)");
            $stmt->execute([$karyawan_id, $nik, $tipe, $db_photo_path, $latitude, $longitude, $detail_lokasi, $keterangan]);

            // Kirim Notifikasi Push
            try {
                require_once __DIR__ . '/../../Services/PushNotificationService.php';
                $pushService = new \App\Services\PushNotificationService();
                $pushService->sendToUser($user_id, 'Absensi Berhasil', "Anda telah berhasil $tipe.");
            } catch (\Throwable $e) {
                error_log("Push error: " . $e->getMessage());
            }

            http_response_code(200);
            echo json_encode(['message' => 'Absensi berhasil']);
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

            $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lupas (karyawan_id, tanggal, tipe_absen, waktu, alasan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
            $stmt->execute([$karyawan_id, $tanggal, $tipe_absen, $waktu, $alasan]);

            // Kirim Notifikasi Push
            try {
                require_once __DIR__ . '/../../Services/PushNotificationService.php';
                $pushService = new \App\Services\PushNotificationService();
                $pushService->sendToUser($user_id, 'Lupa Absen Dikirim', "Pengajuan Lupa Absen untuk tanggal $tanggal telah berhasil dikirim dan menunggu persetujuan.");
            } catch (\Throwable $e) {
                error_log("Push error: " . $e->getMessage());
            }

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
                }
            }

            $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, foto, detail_lokasi, latitude, longitude, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
            $stmt->execute([$karyawan_id, $tanggal, $jam_mulai, $jam_selesai, $keterangan, $db_photo_path, $detail_lokasi, $latitude, $longitude]);

            http_response_code(200);
            echo json_encode(['message' => 'Pengajuan Lembur berhasil dikirim']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
