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
            $stmt = $pdo->query("SELECT latitude, longitude, radius, nama_lokasi FROM lokasi_absensis WHERE is_active = 1");
            $lokasi = $stmt->fetchAll();
            
            echo json_encode(['data' => $lokasi]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
