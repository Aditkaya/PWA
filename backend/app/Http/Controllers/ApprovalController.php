<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class ApprovalController {
    
    public function getAllPermohonan($getData) {
        $user_id = $getData['user_id'] ?? null;
        $status = $getData['status'] ?? null;
        $page = isset($getData['page']) ? (int)$getData['page'] : 1;
        $limit = isset($getData['limit']) ? (int)$getData['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        // Trigger overtime validation automatically to catch data synced from external devices
        require_once __DIR__ . '/../../Helpers/OvertimeValidator.php';
        \App\Helpers\OvertimeValidator::validateAll(date('Y-m-d'));
        \App\Helpers\OvertimeValidator::validateAll(date('Y-m-d', strtotime('-1 day')));

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
                SELECT b.id, b.karyawan_id, kr.nama_lengkap as pengaju, kr.nik, kr.pekerjaan, CONCAT('/uploads/avatars/avatar_', u.id, '.jpg') as foto_profil, 'Lembur' as tipe, 'Pengajuan Lembur' as jenis, b.tanggal as tanggal_mulai, b.tanggal as tanggal_selesai, CONCAT(b.jam_mulai, ' - ', b.jam_selesai) as waktu, b.keterangan, b.keterangan_karyawan, b.status, b.created_at, NULL as lampiran, spv_kr.nama_lengkap as nama_spv, hrd_kr.nama_lengkap as nama_hrd, pl.keterangan as keterangan_rencana
                FROM persetujuan_absensi_lemburs b 
                LEFT JOIN karyawans kr ON b.karyawan_id = kr.id 
                LEFT JOIN users u ON u.karyawan_id = kr.id
                LEFT JOIN users spv_u ON b.approved_by_spv = spv_u.id
                LEFT JOIN karyawans spv_kr ON spv_u.karyawan_id = spv_kr.id
                LEFT JOIN users hrd_u ON b.approved_by_hrd = hrd_u.id
                LEFT JOIN karyawans hrd_kr ON hrd_u.karyawan_id = hrd_kr.id
                LEFT JOIN perencanaan_lemburs pl ON pl.karyawan_id = b.karyawan_id AND pl.tanggal = b.tanggal
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
            
            // Map status correctly for tables using english enum (Lembur and Lupa Absen)
            $isLembur = ($tableName === 'persetujuan_absensi_lemburs');
            $isEnglishEnum = ($isLembur || $tableName === 'persetujuan_absensi_lupas');
            $valDisetujui = $isEnglishEnum ? 'approved' : 'Disetujui';
            $valDitolak = $isEnglishEnum ? 'rejected' : 'Ditolak';
            $valPendingHrd = $isEnglishEnum ? 'approved' : 'Pending HRD'; // Lembur/Lupa Absen don't have 2 steps in enum

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
            
            $jam_mulai = $requestData['jam_mulai'] ?? null;
            $jam_selesai = $requestData['jam_selesai'] ?? null;
            
            $updateFields = "status = ?";
            $updateParams = [];
            
            if ($isHRD) {
                $updateParams[] = ($newStatus === 'Disetujui') ? $valDisetujui : $valDitolak;
                $updateFields .= ", approved_by_hrd = ?";
                $updateParams[] = $user_id;
            } else if ($isSupervisor) {
                if ($currentStatus !== 'Pending SPV' && strtolower($currentStatus) !== 'pending') {
                    http_response_code(403);
                    echo json_encode(['message' => 'Tidak dapat mengubah status pada tahap ini (status saat ini: ' . $currentStatus . ').']);
                    return;
                }
                $updateParams[] = ($newStatus === 'Disetujui') ? $valPendingHrd : $valDitolak;
                $updateFields .= ", approved_by_spv = ?";
                $updateParams[] = $user_id;
            }

            if ($isLembur && $jam_mulai && $jam_selesai) {
                $updateFields .= ", jam_mulai = ?, jam_selesai = ?";
                $updateParams[] = $jam_mulai;
                $updateParams[] = $jam_selesai;
            }
            
            $updateParams[] = $id;

            $stmt = $pdo->prepare("UPDATE $tableName SET $updateFields WHERE id = ?");
            $stmt->execute($updateParams);

            if ($isLembur && $jam_mulai && $jam_selesai && $newStatus === 'Disetujui') {
                $stmtGet = $pdo->prepare("SELECT karyawan_id, tanggal FROM $tableName WHERE id = ?");
                $stmtGet->execute([$id]);
                $lemburData = $stmtGet->fetch();
                
                if ($lemburData) {
                    $kId = $lemburData['karyawan_id'];
                    $tgl = $lemburData['tanggal'];
                    
                    // Update absensis untuk jam masuk lembur
                    $stmtUpdateMasuk = $pdo->prepare("
                        UPDATE absensis 
                        SET waktu = CONCAT(?, ' ', ?) 
                        WHERE karyawan_id = ? 
                          AND DATE(waktu) = ? 
                          AND LOWER(REPLACE(tipe, '_', ' ')) IN ('lembur masuk', 'mulai lembur', 'lembur')
                    ");
                    $stmtUpdateMasuk->execute([$tgl, $jam_mulai, $kId, $tgl]);
                    
                    // Update absensis untuk jam selesai lembur
                    $stmtUpdateSelesai = $pdo->prepare("
                        UPDATE absensis 
                        SET waktu = CONCAT(?, ' ', ?) 
                        WHERE karyawan_id = ? 
                          AND DATE(waktu) = ? 
                          AND LOWER(REPLACE(tipe, '_', ' ')) IN ('lembur pulang', 'selesai lembur', 'lembur keluar')
                    ");
                    $stmtUpdateSelesai->execute([$tgl, $jam_selesai, $kId, $tgl]);
                }
            }

            $isLupa = ($tableName === 'persetujuan_absensi_lupas');
            if ($isLupa && $isHRD && $newStatus === 'Disetujui') {
                $stmtGet = $pdo->prepare("SELECT l.karyawan_id, l.tanggal, l.tipe_absen, l.waktu, l.alasan, k.nik FROM persetujuan_absensi_lupas l JOIN karyawans k ON l.karyawan_id = k.id WHERE l.id = ?");
                $stmtGet->execute([$id]);
                $lupaData = $stmtGet->fetch();
                
                if ($lupaData) {
                    $kId = $lupaData['karyawan_id'];
                    $nik = $lupaData['nik'];
                    $tgl = $lupaData['tanggal'];
                    $tipeAbsen = $lupaData['tipe_absen'];
                    $wkt = $lupaData['waktu'];
                    $alasan = $lupaData['alasan'];
                    
                    $fullWaktu = $tgl . ' ' . $wkt;
                    
                    // Map tipe_absen to tipe of absensis table
                    $tipeMapAbsen = [
                        'Check In'         => 'masuk',
                        'Pulang'           => 'pulang',
                        'Istirahat Keluar' => 'istirahat_keluar',
                        'Istirahat Masuk'  => 'istirahat_masuk',
                        'Mulai Lembur'     => 'lembur_masuk',
                        'Selesai Lembur'   => 'lembur_pulang'
                    ];
                    
                    $dbTipe = isset($tipeMapAbsen[$tipeAbsen]) ? $tipeMapAbsen[$tipeAbsen] : strtolower($tipeAbsen);
                    
                    // Search terms to find existing record
                    $searchTipes = [];
                    if (strcasecmp($tipeAbsen, 'Check In') === 0) {
                        $searchTipes = ['masuk', 'check in'];
                    } else if (strcasecmp($tipeAbsen, 'Pulang') === 0) {
                        $searchTipes = ['pulang', 'keluar'];
                    } else if (strcasecmp($tipeAbsen, 'Istirahat Keluar') === 0) {
                        $searchTipes = ['istirahat_keluar', 'istirahat keluar'];
                    } else if (strcasecmp($tipeAbsen, 'Istirahat Masuk') === 0) {
                        $searchTipes = ['istirahat_masuk', 'istirahat masuk'];
                    } else if (strcasecmp($tipeAbsen, 'Mulai Lembur') === 0) {
                        $searchTipes = ['lembur_masuk', 'lembur masuk', 'mulai lembur'];
                    } else if (strcasecmp($tipeAbsen, 'Selesai Lembur') === 0) {
                        $searchTipes = ['lembur_pulang', 'lembur pulang', 'selesai lembur'];
                    } else {
                        $searchTipes = [strtolower($tipeAbsen)];
                    }
                    
                    $placeholders = implode(',', array_fill(0, count($searchTipes), '?'));
                    $checkParams = array_merge([$kId, $tgl], $searchTipes);
                    
                    $stmtCheckAbs = $pdo->prepare("
                        SELECT id 
                        FROM absensis 
                        WHERE karyawan_id = ? 
                          AND DATE(waktu) = ? 
                          AND LOWER(tipe) IN ($placeholders)
                        LIMIT 1
                    ");
                    $stmtCheckAbs->execute($checkParams);
                    $existingAbs = $stmtCheckAbs->fetch();
                    
                    if ($existingAbs) {
                        $stmtUpdateAbs = $pdo->prepare("
                            UPDATE absensis 
                            SET waktu = ?, keterangan = ? 
                            WHERE id = ?
                        ");
                        $stmtUpdateAbs->execute([$fullWaktu, $alasan, $existingAbs['id']]);
                    } else {
                        $stmtInsertAbs = $pdo->prepare("
                            INSERT INTO absensis (karyawan_id, nik, waktu, tipe, status, keterangan) 
                            VALUES (?, ?, ?, ?, 'Selesai', ?)
                        ");
                        $stmtInsertAbs->execute([$kId, $nik, $fullWaktu, $dbTipe, $alasan]);
                    }

                    // Jika Lupa Absen terkait Lembur, validasi ulang dengan Perencanaan Lembur
                    if (in_array(strtolower(str_replace('_', ' ', $dbTipe)), ['lembur masuk', 'mulai lembur', 'lembur pulang', 'selesai lembur', 'lembur keluar'])) {
                        require_once __DIR__ . '/../../Helpers/OvertimeValidator.php';
                        \App\Helpers\OvertimeValidator::checkAndCreateApproval($kId, $tgl);
                    }
                }
            }

            if ($isHRD) {
                // Keep backward compatibility for approved_by if exists
                $stmtCols = $pdo->query("SHOW COLUMNS FROM $tableName LIKE 'approved_by'");
                if ($stmtCols->fetch()) {
                    $pdo->prepare("UPDATE $tableName SET approved_by = ? WHERE id = ?")->execute([$user_id, $id]);
                }
            }

            echo json_encode(['message' => 'Status berhasil diperbarui']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function destroy($id, $params) {
        $tipe = $params['tipe'] ?? '';
        
        $tableMap = [
            'Izin' => 'permohonan_izins',
            'Cuti' => 'cutis',
            'Lupa Absen' => 'persetujuan_absensi_lupas',
            'Lembur' => 'persetujuan_absensi_lemburs'
        ];
        
        if (!isset($tableMap[$tipe])) {
            http_response_code(400);
            echo json_encode(['message' => 'Tipe pengajuan tidak valid']);
            return;
        }

        $tableName = $tableMap[$tipe];

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM $tableName WHERE id = ?");
            $stmt->execute([$id]);
            
            echo json_encode(['message' => 'Data berhasil dihapus']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error in destroy: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
