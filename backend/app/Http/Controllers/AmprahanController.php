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

    public function getApprovedRequests($requestData) {
        $kapal_id = $requestData['kapal_id'] ?? null;
        $nomor_voyage = $requestData['nomor_voyage'] ?? null;

        if (!$kapal_id || !$nomor_voyage) {
            http_response_code(400);
            echo json_encode(['message' => 'Kapal ID dan Nomor Voyage diperlukan']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            // Get all approved requests for this kapal and voyage
            $stmt = $pdo->prepare("
                SELECT p.id, p.user_id, p.status, p.keterangan_umum, p.created_at, 
                       u.nama as user_nama
                FROM permohonan_amprahans p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.kapal_id = ? AND p.nomor_voyage = ? AND p.status = 'approved'
                ORDER BY p.created_at DESC
            ");
            $stmt->execute([$kapal_id, $nomor_voyage]);
            $permohonans = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // For each request, get its items
            $permohonanIds = array_column($permohonans, 'id');
            if (!empty($permohonanIds)) {
                $inQuery = implode(',', array_fill(0, count($permohonanIds), '?'));
                $stmtItems = $pdo->prepare("
                    SELECT id, permohonan_id, nama_barang, jumlah, satuan, keterangan
                    FROM permohonan_amprahan_items
                    WHERE permohonan_id IN ($inQuery)
                ");
                $stmtItems->execute($permohonanIds);
                $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

                // Group items by permohonan_id
                $itemsGrouped = [];
                foreach ($items as $item) {
                    $itemsGrouped[$item['permohonan_id']][] = $item;
                }

                // Attach items to permohonans
                foreach ($permohonans as &$permohonan) {
                    $permohonan['items'] = $itemsGrouped[$permohonan['id']] ?? [];
                }
            }

            http_response_code(200);
            echo json_encode(['data' => $permohonans]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        }
    }

    public function submitTandaTerima($postData) {
        $permohonan_id = $postData['permohonan_id'] ?? null;
        $user_id = $postData['user_id'] ?? null;

        if (!$permohonan_id || !$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'Data tidak lengkap (permohonan_id, user_id)']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            // Check if it exists and is approved
            $stmt = $pdo->prepare("SELECT id, status FROM permohonan_amprahans WHERE id = ?");
            $stmt->execute([$permohonan_id]);
            $permohonan = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$permohonan) {
                http_response_code(404);
                echo json_encode(['message' => 'Permohonan tidak ditemukan']);
                return;
            }

            if ($permohonan['status'] !== 'approved') {
                http_response_code(400);
                echo json_encode(['message' => 'Status permohonan bukan approved (status saat ini: ' . $permohonan['status'] . ')']);
                return;
            }

            $stmtUpdate = $pdo->prepare("
                UPDATE permohonan_amprahans 
                SET status = 'received', tanggal_diterima = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $stmtUpdate->execute([$permohonan_id]);

            http_response_code(200);
            echo json_encode(['message' => 'Tanda terima berhasil dikonfirmasi']);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        }
    }
}
