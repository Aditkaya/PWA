<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class ApprovalController {
    
    public function getAllPermohonan($getData) {
        $user_id = $getData['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID diperlukan']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            // Check if user is HRD
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.pekerjaan FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            
            if (!$userData || strcasecmp(trim($userData['pekerjaan']), 'HRD') !== 0) {
                http_response_code(403);
                echo json_encode(['message' => 'Akses ditolak. Hanya HRD yang dapat mengakses data ini.']);
                return;
            }

            // Get all permohonan from all users
            $stmtIzin = $pdo->query("
                SELECT p.id, p.karyawan_id, kr.nama_lengkap as pengaju, 'Izin' as tipe, p.jenis_izin as jenis, p.tanggal_mulai, p.tanggal_selesai, p.waktu, p.alasan as keterangan, p.status, p.created_at, p.lampiran 
                FROM permohonan_izins p 
                LEFT JOIN karyawans kr ON p.karyawan_id = kr.id 
                ORDER BY p.created_at DESC
            ");
            $izin = $stmtIzin->fetchAll();

            $stmtCuti = $pdo->query("
                SELECT c.id, c.karyawan_id, kr.nama_lengkap as pengaju, 'Cuti' as tipe, c.jenis_cuti as jenis, c.tanggal_mulai, c.tanggal_selesai, 'Full Day' as waktu, c.keterangan, c.status, c.created_at, NULL as lampiran 
                FROM cutis c 
                LEFT JOIN karyawans kr ON c.karyawan_id = kr.id 
                ORDER BY c.created_at DESC
            ");
            $cuti = $stmtCuti->fetchAll();

            $stmtLupa = $pdo->query("
                SELECT l.id, l.karyawan_id, kr.nama_lengkap as pengaju, 'Lupa Absen' as tipe, l.tipe_absen as jenis, l.tanggal as tanggal_mulai, l.tanggal as tanggal_selesai, l.waktu, l.alasan as keterangan, l.status, l.created_at, NULL as lampiran 
                FROM persetujuan_absensi_lupas l 
                LEFT JOIN karyawans kr ON l.karyawan_id = kr.id 
                ORDER BY l.created_at DESC
            ");
            $lupa = $stmtLupa->fetchAll();

            $stmtLembur = $pdo->query("
                SELECT b.id, b.karyawan_id, kr.nama_lengkap as pengaju, 'Lembur' as tipe, 'Pengajuan Lembur' as jenis, b.tanggal as tanggal_mulai, b.tanggal as tanggal_selesai, CONCAT(b.jam_mulai, ' - ', b.jam_selesai) as waktu, b.keterangan, b.status, b.created_at, NULL as lampiran 
                FROM persetujuan_absensi_lemburs b 
                LEFT JOIN karyawans kr ON b.karyawan_id = kr.id 
                ORDER BY b.created_at DESC
            ");
            $lembur = $stmtLembur->fetchAll();

            $allData = array_merge($izin, $cuti, $lupa, $lembur);
            usort($allData, function($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });

            echo json_encode(['data' => $allData]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function updateStatus($requestData) {
        $id = $requestData['id'] ?? null;
        $tipe = $requestData['tipe'] ?? null;
        $status = $requestData['status'] ?? null;
        $user_id = $requestData['user_id'] ?? null;

        if (!$id || !$tipe || !$status || !$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'Data id, tipe, status, dan user_id diperlukan']);
            return;
        }

        if (!in_array($status, ['Disetujui', 'Ditolak'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Status tidak valid']);
            return;
        }

        $tableMap = [
            'Izin'       => 'permohonan_izins',
            'Cuti'       => 'cutis',
            'Lupa Absen' => 'persetujuan_absensi_lupas',
            'Lembur'     => 'persetujuan_absensi_lemburs',
        ];

        if (!isset($tableMap[$tipe])) {
            http_response_code(400);
            echo json_encode(['message' => 'Tipe permohonan tidak valid']);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Check if user is HRD
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.pekerjaan FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            
            if (!$userData || strcasecmp(trim($userData['pekerjaan']), 'HRD') !== 0) {
                http_response_code(403);
                echo json_encode(['message' => 'Akses ditolak. Hanya HRD yang dapat melakukan aksi ini.']);
                return;
            }

            $tableName = $tableMap[$tipe];
            
            // Periksa apakah kolom approved_by ada di tabel tersebut.
            // Sebelumnya hanya ditambah di permohonan_izins dan cutis. 
            // Kita coba update, jika gagal karena kolom tidak ada, abaikan kolom approved_by.
            $hasApprovedBy = false;
            $stmtCols = $pdo->query("SHOW COLUMNS FROM $tableName LIKE 'approved_by'");
            if ($stmtCols->fetch()) {
                $hasApprovedBy = true;
            }

            if ($hasApprovedBy) {
                $stmt = $pdo->prepare("UPDATE $tableName SET status = ?, approved_by = ? WHERE id = ?");
                $stmt->execute([$status, $user_id, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE $tableName SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);
            }

            echo json_encode(['message' => 'Status berhasil diperbarui']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
