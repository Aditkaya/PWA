<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../config/database.php';

use PDO;

class BeritaController
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = \Database::getConnection();
    }

    /**
     * GET /api/berita — Daftar berita & pamflet aktif yang sudah dipublish
     */
    public function index(array $params = []): void
    {
        try {
            $tipe   = isset($params['tipe']) && in_array($params['tipe'], ['berita', 'pamflet']) ? $params['tipe'] : null;
            $limit  = min((int)($params['limit']  ?? 20), 50);
            $offset = max((int)($params['offset'] ?? 0), 0);

            $where = "b.is_active = 1 AND (b.published_at IS NULL OR b.published_at <= NOW())";
            $bindings = [];
            if ($tipe) {
                $where .= " AND b.tipe = :tipe";
                $bindings[':tipe'] = $tipe;
            }

            $sql = "SELECT b.id, b.judul, b.konten, b.tipe, b.gambar, b.pinned,
                           b.published_at, b.created_at, u.name AS created_by_name
                    FROM beritas b
                    LEFT JOIN users u ON b.created_by = u.id
                    WHERE {$where}
                    ORDER BY b.pinned DESC, b.published_at DESC, b.created_at DESC
                    LIMIT :limit OFFSET :offset";

            $stmt = $this->pdo->prepare($sql);
            foreach ($bindings as $k => $v) { $stmt->bindValue($k, $v); }
            $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $beritas = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($beritas as &$item) {
                $item['gambar_url'] = $item['gambar'] ? $this->buildImageUrl($item['gambar']) : null;
                $item['konten_singkat'] = mb_substr(strip_tags((string)$item['konten']), 0, 120);
            }
            unset($item);

            $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM beritas b WHERE {$where}");
            foreach ($bindings as $k => $v) { $countStmt->bindValue($k, $v); }
            $countStmt->execute();
            $total = (int)$countStmt->fetchColumn();

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $beritas,
                'meta' => ['total' => $total, 'limit' => $limit, 'offset' => $offset]]);
        } catch (\Exception $e) {
            error_log('BeritaController::index ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan pada server']);
        }
    }

    /**
     * GET /api/berita/{id} — Detail satu berita
     */
    public function show(int $id): void
    {
        try {
            $stmt = $this->pdo->prepare(
                "SELECT b.id, b.judul, b.konten, b.tipe, b.gambar, b.pinned,
                        b.published_at, b.created_at, u.name AS created_by_name
                 FROM beritas b
                 LEFT JOIN users u ON b.created_by = u.id
                 WHERE b.id = :id AND b.is_active = 1
                   AND (b.published_at IS NULL OR b.published_at <= NOW())"
            );
            $stmt->execute([':id' => $id]);
            $berita = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$berita) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Berita tidak ditemukan']);
                return;
            }

            $berita['gambar_url'] = $berita['gambar'] ? $this->buildImageUrl($berita['gambar']) : null;

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $berita]);
        } catch (\Exception $e) {
            error_log('BeritaController::show ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan pada server']);
        }
    }

    private function buildImageUrl(string $path): string
    {
        $isLocal = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1']);
        if ($isLocal) {
            // Pakai URL AYPSIS lokal
            return 'http://127.0.0.1:8000/' . ltrim($path, '/');
        }
        $baseUrl = getenv('AYPSIS_BASE_URL') ?: '';
        return rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
    }
}