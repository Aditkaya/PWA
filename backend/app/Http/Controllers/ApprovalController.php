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
            
            // Check if user is HRD, IT, or Supervisor
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.pekerjaan, k.nik, k.nama_lengkap FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            
            if (!$userData) {
                http_response_code(403);
                echo json_encode(['message' => 'User tidak valid.']);
                return;
            }

            $isHRD = strcasecmp(trim($userData['pekerjaan']), 'HRD') === 0 || strcasecmp(trim($userData['pekerjaan']), 'IT') === 0;
            
            $isSupervisor = false;
            if (!$isHRD && $userData['nik']) {
                $stmtSpv = $pdo->prepare("SELECT id FROM karyawans WHERE nik_supervisor = ? OR supervisor = ? LIMIT 1");
                $stmtSpv->execute([$userData['nik'], $userData['nama_lengkap']]);
                if ($stmtSpv->fetch()) {
                    $isSupervisor = true;
                }
            }

            if (!$isHRD && !$isSupervisor) {
                http_response_code(403);
                echo json_encode(['message' => 'Akses ditolak. Hanya HRD, IT, dan Supervisor yang dapat mengakses data ini.']);
                return;
            }

            $whereClause = "";
            $params = [];
            if ($isSupervisor && !$isHRD) {
                $whereClause = " WHERE kr.nik_supervisor = ? OR kr.supervisor = ? ";
                $params = [$userData['nik'], $userData['nama_lengkap']];
            }

            // Get permohonan from users
            $stmtIzin = $pdo->prepare("
                SELECT p.id, p.karyawan_id, kr.nama_lengkap as pengaju, kr.nik, kr.pekerjaan, CONCAT('/uploads/avatars/avatar_', u.id, '.jpg') as foto_profil, 'Izin' as tipe, p.jenis_izin as jenis, p.tanggal_mulai, p.tanggal_selesai, p.waktu, p.alasan as keterangan, p.status, p.created_at, p.lampiran, spv_kr.nama_lengkap as nama_spv, hrd_kr.nama_lengkap as nama_hrd 
                FROM permohonan_izins p 
                LEFT JOIN karyawans kr ON p.karyawan_id = kr.id 
                LEFT JOIN users u ON u.karyawan_id = kr.id
                LEFT JOIN users spv_u ON p.approved_by_spv = spv_u.id
                LEFT JOIN karyawans spv_kr ON spv_u.karyawan_id = spv_kr.id
                LEFT JOIN users hrd_u ON p.approved_by_hrd = hrd_u.id
                LEFT JOIN karyawans hrd_kr ON hrd_u.karyawan_id = hrd_kr.id
                $whereClause
                ORDER BY p.created_at DESC
            ");
            $stmtIzin->execute($params);
            $izin = $stmtIzin->fetchAll();

            $stmtCuti = $pdo->prepare("
                SELECT c.id, c.karyawan_id, kr.nama_lengkap as pengaju, kr.nik, kr.pekerjaan, CONCAT('/uploads/avatars/avatar_', u.id, '.jpg') as foto_profil, 'Cuti' as tipe, c.jenis_cuti as jenis, c.tanggal_mulai, c.tanggal_selesai, 'Full Day' as waktu, c.keterangan, c.status, c.created_at, NULL as lampiran, spv_kr.nama_lengkap as nama_spv, hrd_kr.nama_lengkap as nama_hrd 
                FROM cutis c 
                LEFT JOIN karyawans kr ON c.karyawan_id = kr.id 
                LEFT JOIN users u ON u.karyawan_id = kr.id
                LEFT JOIN users spv_u ON c.approved_by_spv = spv_u.id
                LEFT JOIN karyawans spv_kr ON spv_u.karyawan_id = spv_kr.id
                LEFT JOIN users hrd_u ON c.approved_by_hrd = hrd_u.id
                LEFT JOIN karyawans hrd_kr ON hrd_u.karyawan_id = hrd_kr.id
                $whereClause
                ORDER BY c.created_at DESC
            ");
            $stmtCuti->execute($params);
            $cuti = $stmtCuti->fetchAll();

            $stmtLupa = $pdo->prepare("
                SELECT l.id, l.karyawan_id, kr.nama_lengkap as pengaju, kr.nik, kr.pekerjaan, CONCAT('/uploads/avatars/avatar_', u.id, '.jpg') as foto_profil, 'Lupa Absen' as tipe, l.tipe_absen as jenis, l.tanggal as tanggal_mulai, l.tanggal as tanggal_selesai, l.waktu, l.alasan as keterangan, l.status, l.created_at, NULL as lampiran, spv_kr.nama_lengkap as nama_spv, hrd_kr.nama_lengkap as nama_hrd 
                FROM persetujuan_absensi_lupas l 
                LEFT JOIN karyawans kr ON l.karyawan_id = kr.id 
                LEFT JOIN users u ON u.karyawan_id = kr.id
                LEFT JOIN users spv_u ON l.approved_by_spv = spv_u.id
                LEFT JOIN karyawans spv_kr ON spv_u.karyawan_id = spv_kr.id
                LEFT JOIN users hrd_u ON l.approved_by_hrd = hrd_u.id
                LEFT JOIN karyawans hrd_kr ON hrd_u.karyawan_id = hrd_kr.id
                $whereClause
                ORDER BY l.created_at DESC
            ");
            $stmtLupa->execute($params);
            $lupa = $stmtLupa->fetchAll();

            $stmtLembur = $pdo->prepare("
                SELECT b.id, b.karyawan_id, kr.nama_lengkap as pengaju, kr.nik, kr.pekerjaan, CONCAT('/uploads/avatars/avatar_', u.id, '.jpg') as foto_profil, 'Lembur' as tipe, 'Pengajuan Lembur' as jenis, b.tanggal as tanggal_mulai, b.tanggal as tanggal_selesai, CONCAT(b.jam_mulai, ' - ', b.jam_selesai) as waktu, b.keterangan, b.status, b.created_at, NULL as lampiran, spv_kr.nama_lengkap as nama_spv, hrd_kr.nama_lengkap as nama_hrd 
                FROM persetujuan_absensi_lemburs b 
                LEFT JOIN karyawans kr ON b.karyawan_id = kr.id 
                LEFT JOIN users u ON u.karyawan_id = kr.id
                LEFT JOIN users spv_u ON b.approved_by_spv = spv_u.id
                LEFT JOIN karyawans spv_kr ON spv_u.karyawan_id = spv_kr.id
                LEFT JOIN users hrd_u ON b.approved_by_hrd = hrd_u.id
                LEFT JOIN karyawans hrd_kr ON hrd_u.karyawan_id = hrd_kr.id
                $whereClause
                ORDER BY b.created_at DESC
            ");
            $stmtLembur->execute($params);
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

            // Check user role
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.pekerjaan, k.nik, k.nama_lengkap FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            
            if (!$userData) {
                http_response_code(403);
                echo json_encode(['message' => 'User tidak valid.']);
                return;
            }

            $isHRD = strcasecmp(trim($userData['pekerjaan']), 'HRD') === 0 || strcasecmp(trim($userData['pekerjaan']), 'IT') === 0;
            
            $isSupervisor = false;
            if (!$isHRD && $userData['nik']) {
                $stmtSpv = $pdo->prepare("SELECT id FROM karyawans WHERE nik_supervisor = ? OR supervisor = ? LIMIT 1");
                $stmtSpv->execute([$userData['nik'], $userData['nama_lengkap']]);
                if ($stmtSpv->fetch()) {
                    $isSupervisor = true;
                }
            }

            if (!$isHRD && !$isSupervisor) {
                http_response_code(403);
                echo json_encode(['message' => 'Akses ditolak.']);
                return;
            }

            $tableName = $tableMap[$tipe];
            
            // Get current record status
            $stmtCheck = $pdo->prepare("SELECT status FROM $tableName WHERE id = ?");
            $stmtCheck->execute([$id]);
            $record = $stmtCheck->fetch();
            
            if (!$record) {
                http_response_code(404);
                echo json_encode(['message' => 'Data tidak ditemukan']);
                return;
            }
            
            $currentStatus = $record['status'];
            $newStatus = $status; // 'Disetujui' or 'Ditolak'
            
            if ($isHRD) {
                if ($newStatus === 'Disetujui') {
                    $stmt = $pdo->prepare("UPDATE $tableName SET status = 'Disetujui', approved_by_hrd = ? WHERE id = ?");
                    $stmt->execute([$user_id, $id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE $tableName SET status = 'Ditolak', approved_by_hrd = ? WHERE id = ?");
                    $stmt->execute([$user_id, $id]);
                }
                
                // Keep backward compatibility for approved_by if exists
                $stmtCols = $pdo->query("SHOW COLUMNS FROM $tableName LIKE 'approved_by'");
                if ($stmtCols->fetch()) {
                    $pdo->prepare("UPDATE $tableName SET approved_by = ? WHERE id = ?")->execute([$user_id, $id]);
                }
            } else if ($isSupervisor) {
                if ($currentStatus !== 'Pending SPV') {
                    http_response_code(403);
                    echo json_encode(['message' => 'Tidak dapat mengubah status pada tahap ini (status saat ini: ' . $currentStatus . ').']);
                    return;
                }
                if ($newStatus === 'Disetujui') {
                    $stmt = $pdo->prepare("UPDATE $tableName SET status = 'Pending HRD', approved_by_spv = ? WHERE id = ?");
                    $stmt->execute([$user_id, $id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE $tableName SET status = 'Ditolak', approved_by_spv = ? WHERE id = ?");
                    $stmt->execute([$user_id, $id]);
                }
            }

            echo json_encode(['message' => 'Status berhasil diperbarui']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
