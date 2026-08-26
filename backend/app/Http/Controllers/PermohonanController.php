<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class PermohonanController {
    
    public function submitIzin($postData, $filesData) {
        $karyawan_id = !empty($postData['karyawan_id']) ? $postData['karyawan_id'] : null;
        $nik = !empty($postData['nik']) ? $postData['nik'] : '-';
        $nama = !empty($postData['nama']) ? $postData['nama'] : 'Tanpa Nama';
        $divisi = !empty($postData['divisi']) ? $postData['divisi'] : '-';
        $jenis_izin = $postData['jenis_izin'] ?? null;
        $tanggal_mulai = $postData['tanggal_mulai'] ?? null;
        $tanggal_selesai = $postData['tanggal_selesai'] ?? null;
        $waktu = !empty($postData['waktu']) ? $postData['waktu'] : null;
        $alasan = $postData['alasan'] ?? '';

        if (!$jenis_izin || !$tanggal_mulai) {
            http_response_code(400);
            echo json_encode(['message' => 'Data jenis izin dan tanggal mulai harus diisi']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            
            $user_id = $postData['user_id'] ?? null;
            if (!$karyawan_id && $user_id) {
                $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
                $stmtUser->execute([$user_id]);
                $userData = $stmtUser->fetch();
                if ($userData && $userData['karyawan_id']) {
                    $karyawan_id = $userData['karyawan_id'];
                }
            }

            $lampiran_path = null;
            if (isset($filesData['lampiran']) && $filesData['lampiran']['error'] === UPLOAD_ERR_OK) {
                $upload_dir = UPLOAD_BASE_DIR . '/uploads/surat_sakit/';
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }
                $file = $filesData['lampiran'];
                if ($file['size'] <= 5242880) {
                    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
                    $filename = 'surat_sakit_' . $karyawan_id . '_' . time() . '.' . $ext;
                    if (move_uploaded_file($file['tmp_name'], $upload_dir . $filename)) {
                        $lampiran_path = 'uploads/surat_sakit/' . $filename;
                    }
                }
            }

            $initialStatus = 'Pending HRD';
            if ($karyawan_id) {
                $stmtSpv = $pdo->prepare("SELECT nik_supervisor, supervisor FROM karyawans WHERE id = ?");
                $stmtSpv->execute([$karyawan_id]);
                $kData = $stmtSpv->fetch();
                if ($kData && (!empty(trim($kData['nik_supervisor'])) || !empty(trim($kData['supervisor'])))) {
                    $initialStatus = 'Pending SPV';
                }
            }

            $stmt = $pdo->prepare("INSERT INTO permohonan_izins (karyawan_id, nik, nama, divisi, jenis_izin, tanggal_mulai, tanggal_selesai, waktu, alasan, lampiran, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$karyawan_id, $nik, $nama, $divisi, $jenis_izin, $tanggal_mulai, $tanggal_selesai, $waktu, $alasan, $lampiran_path, $initialStatus]);
            
            http_response_code(200);
            echo json_encode(['message' => 'Permohonan izin berhasil diajukan']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function submitCuti($postData) {
        try {
            $pdo = Database::getConnection();
            
            $karyawan_id = !empty($postData['karyawan_id']) ? $postData['karyawan_id'] : null;
            $user_id = $postData['user_id'] ?? null;
            if (!$karyawan_id && $user_id) {
                $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
                $stmtUser->execute([$user_id]);
                $userData = $stmtUser->fetch();
                if ($userData && $userData['karyawan_id']) {
                    $karyawan_id = $userData['karyawan_id'];
                }
            }
            $tanggal_mulai = $postData['tanggal_mulai'] ?? '';
            $tanggal_selesai = $postData['tanggal_selesai'] ?? '';
            $jenis_cuti = $postData['jenis_cuti'] ?? '';
            $keterangan = $postData['keterangan'] ?? '';

            if (empty($tanggal_mulai) || empty($tanggal_selesai) || empty($jenis_cuti) || empty($keterangan)) {
                http_response_code(400);
                echo json_encode(['message' => 'Lengkapi semua field tanggal, jenis, dan keterangan!']);
                return;
            }

            $initialStatus = 'Pending HRD';
            if ($karyawan_id) {
                $stmtSpv = $pdo->prepare("SELECT nik_supervisor, supervisor FROM karyawans WHERE id = ?");
                $stmtSpv->execute([$karyawan_id]);
                $kData = $stmtSpv->fetch();
                if ($kData && (!empty(trim($kData['nik_supervisor'])) || !empty(trim($kData['supervisor'])))) {
                    $initialStatus = 'Pending SPV';
                }
            }

            $stmt = $pdo->prepare("
                INSERT INTO cutis (karyawan_id, tanggal_mulai, tanggal_selesai, jenis_cuti, keterangan, status, created_at, updated_at) 
                VALUES (:karyawan_id, :tanggal_mulai, :tanggal_selesai, :jenis_cuti, :keterangan, :status, NOW(), NOW())
            ");
            $stmt->execute([
                'karyawan_id' => $karyawan_id,
                'tanggal_mulai' => $tanggal_mulai,
                'tanggal_selesai' => $tanggal_selesai,
                'jenis_cuti' => $jenis_cuti,
                'keterangan' => $keterangan,
                'status' => $initialStatus
            ]);

            echo json_encode(['message' => 'Success']);
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
        $alasan = $postData['alasan'] ?? '';

        if (!$user_id || !$tanggal || !$tipe_absen || !$waktu) {
            http_response_code(400);
            echo json_encode(['message' => 'Lengkapi semua field tanggal, waktu, dan alasan!']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            $karyawan_id = $userData ? $userData['karyawan_id'] : null;

            if (!$karyawan_id) {
                http_response_code(400);
                echo json_encode(['message' => 'Data karyawan tidak ditemukan']);
                return;
            }

            $stmt = $pdo->prepare("
                INSERT INTO persetujuan_absensi_lupas (karyawan_id, tanggal, tipe_absen, waktu, alasan, status, created_at, updated_at) 
                VALUES (:karyawan_id, :tanggal, :tipe_absen, :waktu, :alasan, 'pending', NOW(), NOW())
            ");
            $stmt->execute([
                'karyawan_id' => $karyawan_id,
                'tanggal' => $tanggal,
                'tipe_absen' => $tipe_absen,
                'waktu' => $waktu,
                'alasan' => $alasan
            ]);

            echo json_encode(['message' => 'Success']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function getPermohonan($getData) {
        $user_id = $getData['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID diperlukan']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            $karyawan_id = $userData ? $userData['karyawan_id'] : null;

            if (!$karyawan_id) {
                echo json_encode(['data' => []]);
                return;
            }

            $stmtIzin = $pdo->prepare("SELECT p.id, 'Izin' as tipe, p.jenis_izin as jenis, p.tanggal_mulai, p.tanggal_selesai, p.waktu, p.alasan as keterangan, p.status, p.created_at, COALESCE(k.nama_lengkap, u.username) as approved_by_name FROM permohonan_izins p LEFT JOIN users u ON p.approved_by = u.id LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE p.karyawan_id = ? ORDER BY p.created_at DESC");
            $stmtIzin->execute([$karyawan_id]);
            $izin = $stmtIzin->fetchAll();

            $stmtCuti = $pdo->prepare("SELECT c.id, 'Cuti' as tipe, c.jenis_cuti as jenis, c.tanggal_mulai, c.tanggal_selesai, 'Full Day' as waktu, c.keterangan, c.status, c.created_at, COALESCE(k.nama_lengkap, u.username) as approved_by_name FROM cutis c LEFT JOIN users u ON c.approved_by = u.id LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE c.karyawan_id = ? ORDER BY c.created_at DESC");
            $stmtCuti->execute([$karyawan_id]);
            $cuti = $stmtCuti->fetchAll();

            $stmtLupa = $pdo->prepare("SELECT l.id, 'Lupa Absen' as tipe, l.tipe_absen as jenis, l.tanggal as tanggal_mulai, l.tanggal as tanggal_selesai, l.waktu, l.alasan as keterangan, l.status, l.created_at, COALESCE(k.nama_lengkap, u.username) as approved_by_name FROM persetujuan_absensi_lupas l LEFT JOIN users u ON l.approved_by = u.id LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE l.karyawan_id = ? ORDER BY l.created_at DESC");
            $stmtLupa->execute([$karyawan_id]);
            $lupa = $stmtLupa->fetchAll();

            $stmtLembur = $pdo->prepare("SELECT b.id, 'Lembur' as tipe, 'Pengajuan Lembur' as jenis, b.tanggal as tanggal_mulai, b.tanggal as tanggal_selesai, CONCAT(b.jam_mulai, ' - ', b.jam_selesai) as waktu, b.keterangan, b.keterangan_karyawan, b.status, b.created_at, COALESCE(k.nama_lengkap, u.username) as approved_by_name, pl.keterangan as keterangan_rencana FROM persetujuan_absensi_lemburs b LEFT JOIN users u ON b.approved_by = u.id LEFT JOIN karyawans k ON u.karyawan_id = k.id LEFT JOIN perencanaan_lemburs pl ON pl.karyawan_id = b.karyawan_id AND pl.tanggal = b.tanggal WHERE b.karyawan_id = ? ORDER BY b.created_at DESC");
            $stmtLembur->execute([$karyawan_id]);
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

    public function deletePermohonan($requestData) {
        $id   = $requestData['id'] ?? null;
        $tipe = $requestData['tipe'] ?? null; // 'Izin', 'Cuti', 'Lupa Absen', 'Lembur'
        $user_id = $requestData['user_id'] ?? null;

        if (!$id || !$tipe || !$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'Data id, tipe, dan user_id diperlukan']);
            return;
        }

        $tableMap = [
            'Izin'       => ['table' => 'permohonan_izins', 'status_col' => 'status'],
            'Cuti'       => ['table' => 'cutis', 'status_col' => 'status'],
            'Lupa Absen' => ['table' => 'persetujuan_absensi_lupas', 'status_col' => 'status'],
            'Lembur'     => ['table' => 'persetujuan_absensi_lemburs', 'status_col' => 'status'],
        ];

        if (!isset($tableMap[$tipe])) {
            http_response_code(400);
            echo json_encode(['message' => 'Tipe permohonan tidak valid']);
            return;
        }
        try {
            $pdo = Database::getConnection();

            // Ambil karyawan_id milik user
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if (!$userData) {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
                return;
            }
            $karyawan_id = $userData['karyawan_id'];

            $tableName  = $tableMap[$tipe]['table'];
            $statusCol  = $tableMap[$tipe]['status_col'];

            // Pastikan record ada, milik user ini, dan masih Pending
            $stmtCek = $pdo->prepare("SELECT id, $statusCol as status FROM $tableName WHERE id = ? AND karyawan_id = ?");
            $stmtCek->execute([$id, $karyawan_id]);
            $record = $stmtCek->fetch();

            if (!$record) {
                http_response_code(404);
                echo json_encode(['message' => 'Permohonan tidak ditemukan']);
                return;
            }

            if (strpos(strtolower($record['status']), 'pending') === false) {
                http_response_code(403);
                echo json_encode(['message' => 'Hanya permohonan berstatus Pending yang dapat dihapus']);
                return;
            }

            $stmtDel = $pdo->prepare("DELETE FROM $tableName WHERE id = ? AND karyawan_id = ?");
            $stmtDel->execute([$id, $karyawan_id]);

            http_response_code(200);
            echo json_encode(['message' => 'Permohonan berhasil dihapus']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
    
    public function updateKeteranganKaryawan($requestData) {
        $id = $requestData['id'] ?? null;
        $keterangan = $requestData['keterangan'] ?? null;
        $user_id = $requestData['user_id'] ?? null;

        if (!$id || !$user_id || $keterangan === null) {
            http_response_code(400);
            echo json_encode(['message' => 'Data id, keterangan, dan user_id diperlukan']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if (!$userData) {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
                return;
            }
            $karyawan_id = $userData['karyawan_id'];

            $stmtCek = $pdo->prepare("SELECT id, status FROM persetujuan_absensi_lemburs WHERE id = ? AND karyawan_id = ?");
            $stmtCek->execute([$id, $karyawan_id]);
            $record = $stmtCek->fetch();

            if (!$record) {
                http_response_code(404);
                echo json_encode(['message' => 'Permohonan lembur tidak ditemukan']);
                return;
            }

            if (strpos(strtolower($record['status']), 'pending') === false) {
                http_response_code(403);
                echo json_encode(['message' => 'Hanya permohonan berstatus Pending yang dapat diubah']);
                return;
            }

            $stmtUpdate = $pdo->prepare("UPDATE persetujuan_absensi_lemburs SET keterangan_karyawan = ? WHERE id = ?");
            $stmtUpdate->execute([$keterangan, $id]);

            http_response_code(200);
            echo json_encode(['message' => 'Keterangan berhasil disimpan']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
