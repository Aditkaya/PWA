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

            // ==============================================================
            // OVERNIGHT OVERTIME HANDLING (Opsi A)
            // Untuk absensi "Selesai Lembur" / "Lembur Pulang" yang terjadi
            // di dini hari (jam 00:00 - 12:00), cek apakah ada "Mulai Lembur"
            // di H-1 milik karyawan yang sama tanpa selesai yang cocok di H-1.
            // Jika iya, pindahkan tanggalnya ke H-1 dan beri flag is_overnight=true.
            // ==============================================================
            $overtimeStartTipes = ['mulai lembur', 'lembur masuk', 'lembur'];
            $overtimeEndTipes   = ['selesai lembur', 'lembur pulang', 'lembur keluar'];

            // Kelompokkan record per karyawan_id untuk efisiensi
            // Dengan hanya 50 record terakhir, cukup proses di PHP
            $processed = [];
            foreach ($history as &$record) {
                $tipeNorm = strtolower(str_replace('_', ' ', $record['type']));
                $record['is_overnight'] = false;

                if (in_array($tipeNorm, $overtimeEndTipes)) {
                    // Ambil jam dari waktu absensi
                    $jamAbsensi = (int) substr($record['time'], 0, 2);

                    // Hanya proses jika terjadi antara jam 00:00 - 12:00
                    if ($jamAbsensi < 12) {
                        // Cari "Mulai Lembur" di H-1 (tanggal sehari sebelum record ini)
                        $tanggalRecord = $record['date'];
                        $tanggalHmin1 = date('Y-m-d', strtotime($tanggalRecord . ' -1 day'));

                        // Cari di array history apakah ada Mulai Lembur di H-1
                        // yang belum memiliki pasangan Selesai Lembur di H-1
                        $mulaiLemburHmin1 = null;
                        foreach ($history as $other) {
                            $otherTipeNorm = strtolower(str_replace('_', ' ', $other['type']));
                            if ($other['date'] === $tanggalHmin1 && in_array($otherTipeNorm, $overtimeStartTipes)) {
                                $mulaiLemburHmin1 = $other;
                                break;
                            }
                        }

                        if ($mulaiLemburHmin1 !== null) {
                            // Pastikan tidak ada "Selesai Lembur" lain di H-1 yang sudah menutup sesi tersebut
                            $selesaiDiHmin1 = false;
                            foreach ($history as $other) {
                                $otherTipeNorm = strtolower(str_replace('_', ' ', $other['type']));
                                if ($other['date'] === $tanggalHmin1 && in_array($otherTipeNorm, $overtimeEndTipes)) {
                                    $selesaiDiHmin1 = true;
                                    break;
                                }
                            }

                            if (!$selesaiDiHmin1) {
                                // Pindahkan tanggal ke H-1 dan tandai sebagai overnight
                                $record['date'] = $tanggalHmin1;
                                $record['is_overnight'] = true;
                            }
                        }
                    }
                }
            }
            unset($record); // putus referensi

            http_response_code(200);
            echo json_encode(['data' => $history]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
