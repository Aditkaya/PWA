<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class LocationController {
    
    public function getLokasi() {
        try {
            $pdo = Database::getConnection();
            $user_id = $_GET['user_id'] ?? null;
            $karyawan_id = null;

            if ($user_id) {
                $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
                $stmtUser->execute([$user_id]);
                $karyawan_id = $stmtUser->fetchColumn();
            }

            $lokasi = [];
            $hasSpecialAssignment = false;

            if ($karyawan_id) {
                // 1. Cek lokasi khusus yang ditugaskan khusus untuk karyawan ini
                $stmtSpecial = $pdo->prepare("
                    SELECT la.id, la.latitude, la.longitude, la.radius, la.nama_lokasi, la.tipe_penugasan
                    FROM lokasi_absensis la
                    INNER JOIN lokasi_absensi_karyawan lak ON la.id = lak.lokasi_absensi_id
                    WHERE lak.karyawan_id = ? AND la.is_active = 1
                ");
                $stmtSpecial->execute([$karyawan_id]);
                $specialLocs = $stmtSpecial->fetchAll();

                if (!empty($specialLocs)) {
                    $hasSpecialAssignment = true;
                    $lokasi = $specialLocs;
                }
            }

            // 2. Jika tidak ada penugasan khusus, ambil lokasi yang berlaku untuk 'semua'
            if (empty($lokasi)) {
                $stmtSemua = $pdo->query("
                    SELECT id, latitude, longitude, radius, nama_lokasi, tipe_penugasan
                    FROM lokasi_absensis
                    WHERE is_active = 1 AND (tipe_penugasan = 'semua' OR tipe_penugasan IS NULL)
                ");
                $lokasi = $stmtSemua->fetchAll();
            }

            // 3. Fallback jika masih kosong
            if (empty($lokasi)) {
                $stmtFallback = $pdo->query("
                    SELECT id, latitude, longitude, radius, nama_lokasi, tipe_penugasan
                    FROM lokasi_absensis
                    WHERE is_active = 1
                ");
                $lokasi = $stmtFallback->fetchAll();
            }

            // Tandai properti is_assigned
            foreach ($lokasi as &$loc) {
                $loc['is_assigned'] = $hasSpecialAssignment ? true : (($loc['tipe_penugasan'] ?? 'semua') === 'semua');
            }
            unset($loc);
            
            echo json_encode([
                'data' => $lokasi,
                'has_special_assignment' => $hasSpecialAssignment
            ]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
