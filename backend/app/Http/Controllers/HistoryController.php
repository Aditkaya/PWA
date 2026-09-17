<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../Helpers/AttendanceWorkDate.php';

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
            $workDate = \App\Helpers\AttendanceWorkDate::sql('mysql', 'a', 0);
            $stmt = $pdo->prepare("
            SELECT a.id, $workDate as date, DATE(a.waktu) as actual_date, a.waktu as occurred_at, a.tipe as type, TIME_FORMAT(a.waktu, '%H:%i') as time, IFNULL(a.status, 'Selesai') as status, a.foto, a.detail_lokasi as location, a.latitude as lat, a.longitude as lng, a.keterangan
            FROM absensis a
            JOIN users u ON a.karyawan_id = u.karyawan_id
            WHERE u.id = ?
            ORDER BY a.waktu DESC
            LIMIT 50
        ");
            $stmt->execute([$user_id]);
            $history = $stmt->fetchAll();

            // Pair against all stored logs before LIMIT, retaining the actual date for display.
            foreach ($history as &$record) {
                $record['is_overnight'] = $record['date'] !== $record['actual_date'];
            }
            unset($record);

            http_response_code(200);
            echo json_encode(['data' => $history]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
