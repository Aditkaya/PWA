<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class HistoryController {
    
    public function getHistory($getData) {
        $user_id = $getData['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID diperlukan']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
            SELECT a.id, DATE(a.waktu) as date, a.tipe as type, TIME_FORMAT(a.waktu, '%H:%i') as time, IFNULL(a.status, 'Selesai') as status, a.foto, a.detail_lokasi as location, a.latitude as lat, a.longitude as lng, a.keterangan
            FROM absensis a
            JOIN users u ON a.karyawan_id = u.karyawan_id
            WHERE u.id = ?
            ORDER BY a.waktu DESC
            LIMIT 50
        ");
            $stmt->execute([$user_id]);
            $history = $stmt->fetchAll();
            
            http_response_code(200);
            echo json_encode(['data' => $history]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
