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
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, roda, tahun_pembuatan, lokasi 
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
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, roda, tahun_pembuatan, lokasi 
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

    /**
     * Mengambil daftar ban terpakai (status = 'Terpakai') dari tabel stock_bans
     * berdasarkan mobil_id atau alat_berat_id.
     */
    public function getTires($params = []) {
        $mobilId = isset($params['mobil_id']) && $params['mobil_id'] !== '' ? (int)$params['mobil_id'] : null;
        $alatBeratId = isset($params['alat_berat_id']) && $params['alat_berat_id'] !== '' ? (int)$params['alat_berat_id'] : null;

        if (!$mobilId && !$alatBeratId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter mobil_id atau alat_berat_id diperlukan'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            if ($mobilId) {
                $sql = "SELECT id, nama_stock_ban_id, nomor_seri, nomor_faktur, nomor_bukti, 
                               merk, ukuran, kondisi, status, status_masak, jumlah_masak, 
                               harga_beli, tanggal_masuk, tanggal_keluar, tanggal_digunakan, 
                               tanggal_kembali, lokasi, keterangan, status_ban_luar, 
                               mobil_id, alat_berat_id
                        FROM stock_bans 
                        WHERE mobil_id = :mobil_id AND status = 'Terpakai'
                        ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':mobil_id' => $mobilId]);
            } else {
                $sql = "SELECT id, nama_stock_ban_id, nomor_seri, nomor_faktur, nomor_bukti, 
                               merk, ukuran, kondisi, status, status_masak, jumlah_masak, 
                               harga_beli, tanggal_masuk, tanggal_keluar, tanggal_digunakan, 
                               tanggal_kembali, lokasi, keterangan, status_ban_luar, 
                               mobil_id, alat_berat_id
                        FROM stock_bans 
                        WHERE alat_berat_id = :alat_berat_id AND status = 'Terpakai'
                        ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':alat_berat_id' => $alatBeratId]);
            }

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'mobil_id' => $mobilId,
                'alat_berat_id' => $alatBeratId,
                'total' => count($rows),
                'data' => $rows
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('TireTreadPatternController getTires error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data ban dari database: ' . $e->getMessage()
            ]);
        }
    }
}

