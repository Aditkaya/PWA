<?php

namespace App\Http\Controllers;

use PDO;
use Database;

require_once __DIR__ . '/../../../config/database.php';

class TireTreadPatternController {
    /**
     * Mengambil daftar kendaraan atau alat berat berdasarkan kategori:
     * - tractor-head: dari tabel mobils dengan jenis TRACTOR HEAD / TRACKTOR HEAD
     * - chassis-container: dari tabel mobils dengan jenis BUNTUT (20 FEET / 40 FEET)
     * - forklift: dari tabel alat_berats dengan jenis FORKLIFT
     */
    public function getUnits($params = []) {
        $category = strtolower(trim($params['category'] ?? ''));

        if (!$category) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter category diperlukan (tractor-head, chassis-container, atau forklift)'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            if ($category === 'tractor-head' || $category === 'tractor') {
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, tahun_pembuatan, lokasi 
                        FROM mobils 
                        WHERE UPPER(jenis) LIKE '%TRACTOR HEAD%' OR UPPER(jenis) LIKE '%TRACKTOR HEAD%'
                        ORDER BY nomor_polisi ASC, kode_no ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'tractor-head',
                    'category_label' => 'Tracktor Head',
                    'source_table' => 'mobils',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            if ($category === 'chassis-container' || $category === 'chassis' || $category === 'buntut') {
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, tahun_pembuatan, lokasi 
                        FROM mobils 
                        WHERE UPPER(jenis) LIKE '%BUNTUT%'
                        ORDER BY kode_no ASC, nomor_polisi ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'chassis-container',
                    'category_label' => 'Chassis Kontainer',
                    'source_table' => 'mobils',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            if ($category === 'forklift') {
                $sql = "SELECT id, kode_alat, nama, nickname, merk, jenis, kapasitas, tipe, lokasi, status 
                        FROM alat_berats 
                        WHERE UPPER(jenis) LIKE '%FORKLIFT%'
                        ORDER BY kode_alat ASC, nama ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'forklift',
                    'category_label' => 'Forklift',
                    'source_table' => 'alat_berats',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => "Kategori '$category' tidak dikenal. Pilihan: tractor-head, chassis-container, forklift"
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('TireTreadPatternController error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data dari database: ' . $e->getMessage()
            ]);
        }
    }
}
