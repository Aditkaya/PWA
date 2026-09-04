<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class KapalController {
    public function getKapal() {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT DISTINCT m.id, m.nama_kapal 
                FROM master_kapals m 
                INNER JOIN naik_kapal n ON m.nama_kapal = n.nama_kapal
                WHERE m.status = 'aktif'
                ORDER BY m.nama_kapal ASC
            ");
            $kapals = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            http_response_code(200);
            echo json_encode(['data' => $kapals]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function getVoyages($requestData) {
        $kapal_id = $requestData['kapal_id'] ?? null;
        if (!$kapal_id) {
            http_response_code(400);
            echo json_encode(['message' => 'Kapal ID diperlukan']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT nama_kapal FROM master_kapals WHERE id = ?");
            $stmt->execute([$kapal_id]);
            $kapal = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$kapal) {
                http_response_code(404);
                echo json_encode(['message' => 'Kapal tidak ditemukan']);
                return;
            }

            $nama_kapal = $kapal['nama_kapal'];
            
            $stmt = $pdo->prepare("
                SELECT DISTINCT no_voyage 
                FROM naik_kapal 
                WHERE nama_kapal = ? AND no_voyage IS NOT NULL AND no_voyage != ''
                ORDER BY no_voyage DESC
            ");
            $stmt->execute([$nama_kapal]);
            $voyages = $stmt->fetchAll(PDO::FETCH_COLUMN);

            http_response_code(200);
            echo json_encode(['data' => $voyages]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
