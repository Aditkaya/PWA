<?php
namespace App\Http\Controllers;

use Database;
use PDO;

class PerencanaanLemburController {
    
    public function getBawahan($params) {
        $user_id = $params['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID is required']);
            return;
        }
        
        try {
            $pdo = Database::getConnection();
            $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.pekerjaan, k.nik, k.nama_lengkap FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            
            if (!$userData) {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
                return;
            }
            
            $pekerjaan = strtoupper(trim($userData['pekerjaan'] ?? ''));
            $nik = $userData['nik'];
            $nama = $userData['nama_lengkap'];
            
            // Cek apakah bawahan supervisor atau HRD (semua)
            if ($pekerjaan === 'HRD' || $pekerjaan === 'IT') {
                $stmt = $pdo->prepare("SELECT id, nik, nama_lengkap, pekerjaan, grup FROM karyawans ORDER BY nama_lengkap ASC");
                $stmt->execute();
            } else {
                $stmt = $pdo->prepare("SELECT id, nik, nama_lengkap, pekerjaan, grup FROM karyawans WHERE nik_supervisor = ? OR supervisor = ? ORDER BY nama_lengkap ASC");
                $stmt->execute([$nik, $nama]);
            }
            
            $bawahan = $stmt->fetchAll();
            echo json_encode(['data' => $bawahan]);
            
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server', 'error' => $e->getMessage()]);
        }
    }

    public function store($postData) {
        $user_id = $postData['user_id'] ?? null;
        $tanggal = $postData['tanggal'] ?? null;
        $jam_mulai = $postData['jam_mulai'] ?? null;
        $jam_selesai = $postData['jam_selesai'] ?? null;
        $keterangan = $postData['keterangan'] ?? null;
        $karyawan_ids = $postData['karyawan_ids'] ?? [];

        if (!$user_id || !$tanggal || !$jam_mulai || !$jam_selesai || !$keterangan || empty($karyawan_ids)) {
            http_response_code(400);
            echo json_encode(['message' => 'Lengkapi semua data perencanaan lembur!']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("INSERT INTO perencanaan_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
            
            foreach ($karyawan_ids as $kid) {
                $stmt->execute([$kid, $tanggal, $jam_mulai, $jam_selesai, $keterangan, $user_id]);
            }
            
            $pdo->commit();

            require_once __DIR__ . '/../Helpers/OvertimeValidator.php';
            foreach ($karyawan_ids as $kid) {
                \App\Helpers\OvertimeValidator::checkAndCreateApproval($kid, $tanggal);
            }

            echo json_encode(['message' => 'Perencanaan lembur berhasil disimpan']);
            
        } catch (\Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => 'Gagal menyimpan perencanaan lembur', 'error' => $e->getMessage()]);
        }
    }
    public function getHistory($params) {
        $user_id = $params['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID is required']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT p.*, k.nama_lengkap, k.nik, k.pekerjaan 
                FROM perencanaan_lemburs p 
                LEFT JOIN karyawans k ON p.karyawan_id = k.id 
                WHERE p.created_by = ? 
                ORDER BY p.created_at DESC
            ");
            $stmt->execute([$user_id]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['data' => $history]);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Gagal mengambil riwayat', 'error' => $e->getMessage()]);
        }
    }

    public function update($id, $postData) {
        $tanggal = $postData['tanggal'] ?? null;
        $jam_mulai = $postData['jam_mulai'] ?? null;
        $jam_selesai = $postData['jam_selesai'] ?? null;
        $keterangan = $postData['keterangan'] ?? null;

        if (!$tanggal || !$jam_mulai || !$jam_selesai) {
            http_response_code(400);
            echo json_encode(['message' => 'Semua field harus diisi']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE perencanaan_lemburs SET tanggal = ?, jam_mulai = ?, jam_selesai = ?, keterangan = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$tanggal, $jam_mulai, $jam_selesai, $keterangan, $id]);
            
            // Check if overtime validation needs to be re-run
            $stmtCheck = $pdo->prepare("SELECT karyawan_id, tanggal FROM perencanaan_lemburs WHERE id = ?");
            $stmtCheck->execute([$id]);
            $row = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                require_once __DIR__ . '/../Helpers/OvertimeValidator.php';
                \App\Helpers\OvertimeValidator::checkAndCreateApproval($row['karyawan_id'], $row['tanggal']);
            }

            echo json_encode(['message' => 'Perencanaan lembur berhasil diupdate']);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Gagal mengupdate perencanaan', 'error' => $e->getMessage()]);
        }
    }

    public function destroy($id, $params) {
        $user_id = $params['user_id'] ?? null;
        
        try {
            $pdo = Database::getConnection();
            // Optional: Check if the user owns this record
            if ($user_id) {
                $stmtCheck = $pdo->prepare("SELECT id FROM perencanaan_lemburs WHERE id = ? AND created_by = ?");
                $stmtCheck->execute([$id, $user_id]);
                if (!$stmtCheck->fetch()) {
                    http_response_code(403);
                    echo json_encode(['message' => 'Tidak diizinkan menghapus data ini']);
                    return;
                }
            }

            $stmt = $pdo->prepare("DELETE FROM perencanaan_lemburs WHERE id = ?");
            $stmt->execute([$id]);
            
            echo json_encode(['message' => 'Perencanaan lembur berhasil dihapus']);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Gagal menghapus perencanaan', 'error' => $e->getMessage()]);
        }
    }
}
