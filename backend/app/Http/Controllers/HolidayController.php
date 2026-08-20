<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;

class HolidayController {
    public function getHolidays() {
        try {
            $db = Database::getConnection();
            
            $stmt = $db->prepare("SELECT tanggal, keterangan FROM hari_liburs ORDER BY tanggal ASC");
            $stmt->execute();
            
            $holidays = $stmt->fetchAll();
            
            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'data' => $holidays
            ]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error in HolidayController: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Terjadi kesalahan pada server saat mengambil data hari libur'
            ]);
        }
    }
}
