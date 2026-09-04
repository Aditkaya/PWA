<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class AmprahanController {
    
    public function submitRequest($postData) {
        $user_id = $postData['user_id'] ?? null;
        $kapal_id = $postData['kapal_id'] ?? null;
        $nomor_voyage = $postData['nomor_voyage'] ?? null;
        $keterangan_umum = $postData['keterangan_umum'] ?? null;
        $items = $postData['items'] ?? [];

        if (!$user_id || !$kapal_id || !$nomor_voyage || empty($items)) {
            http_response_code(400);
            echo json_encode(['message' => 'Data tidak lengkap (user_id, kapal_id, nomor_voyage, items)']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO permohonan_amprahans (user_id, kapal_id, nomor_voyage, keterangan_umum, status)
                VALUES (?, ?, ?, ?, 'pending')
            ");
            $stmt->execute([$user_id, $kapal_id, $nomor_voyage, $keterangan_umum]);
            
            $permohonan_id = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("
                INSERT INTO permohonan_amprahan_items (permohonan_id, nama_barang, jumlah, satuan, keterangan)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($items as $item) {
                if (empty($item['nama_barang']) || empty($item['jumlah']) || empty($item['satuan'])) {
                    throw new Exception('Data item tidak valid');
                }
                
                $stmtItem->execute([
                    $permohonan_id,
                    $item['nama_barang'],
                    $item['jumlah'],
                    $item['satuan'],
                    $item['keterangan'] ?? null
                ]);
            }

            $pdo->commit();
            http_response_code(200);
            echo json_encode(['message' => 'Permintaan amprahan berhasil diajukan']);
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
