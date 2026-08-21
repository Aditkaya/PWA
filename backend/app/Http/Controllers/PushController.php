<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class PushController {
    
    public function subscribe($requestData) {
        $user_id = $requestData['user_id'] ?? null;
        $endpoint = $requestData['endpoint'] ?? null;
        $keys = $requestData['keys'] ?? null;

        if (!$user_id || !$endpoint || !$keys || empty($keys['p256dh']) || empty($keys['auth'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Data langganan tidak lengkap']);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Cek apakah endpoint sudah ada
            $stmtCek = $pdo->prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?");
            $stmtCek->execute([$endpoint]);
            if ($stmtCek->fetch()) {
                http_response_code(200);
                echo json_encode(['message' => 'Sudah berlangganan sebelumnya']);
                return;
            }

            // Simpan subscription baru
            $stmt = $pdo->prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)");
            $stmt->execute([$user_id, $endpoint, $keys['p256dh'], $keys['auth']]);

            http_response_code(200);
            echo json_encode(['message' => 'Berhasil mendaftarkan notifikasi']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server saat menyimpan subscription']);
        }
    }
}
