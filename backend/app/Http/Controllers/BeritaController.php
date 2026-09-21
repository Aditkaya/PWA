<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

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
            $rawTipe = isset($params['tipe']) ? strtolower(trim($params['tipe'])) : null;
            $tipe    = in_array($rawTipe, ['berita', 'pamflet']) ? $rawTipe : null;
            $limit   = min((int)($params['limit']  ?? 20), 50);
            $offset  = max((int)($params['offset'] ?? 0), 0);

            $where = "(b.is_active = 1 OR b.is_active IS NULL) AND (b.published_at IS NULL OR b.published_at <= NOW())";
            $bindings = [];
            if ($tipe) {
                $where .= " AND LOWER(TRIM(b.tipe)) = :tipe";
                $bindings[':tipe'] = $tipe;
            }

            $sql = "SELECT b.id, b.judul, b.konten, b.tipe, b.gambar, b.pinned,
                           b.published_at, b.created_at, u.username AS created_by_name
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

            // Fallback: Jika mencari pamflet dan hasilnya kosong, ambil berita apa saja yang memiliki gambar
            if ($tipe === 'pamflet' && empty($beritas)) {
                $fallbackSql = "SELECT b.id, b.judul, b.konten, b.tipe, b.gambar, b.pinned,
                                       b.published_at, b.created_at, u.username AS created_by_name
                                FROM beritas b
                                LEFT JOIN users u ON b.created_by = u.id
                                WHERE (b.is_active = 1 OR b.is_active IS NULL)
                                  AND (b.published_at IS NULL OR b.published_at <= NOW())
                                  AND b.gambar IS NOT NULL AND b.gambar != ''
                                ORDER BY b.pinned DESC, b.published_at DESC, b.created_at DESC
                                LIMIT :limit OFFSET :offset";
                $fallbackStmt = $this->pdo->prepare($fallbackSql);
                $fallbackStmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
                $fallbackStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $fallbackStmt->execute();
                $beritas = $fallbackStmt->fetchAll(PDO::FETCH_ASSOC);
            }

            foreach ($beritas as &$item) {
                $item['gambar_url'] = !empty($item['gambar']) ? $this->buildImageUrl($item['gambar']) : null;
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
                        b.published_at, b.created_at, u.username AS created_by_name
                 FROM beritas b
                 LEFT JOIN users u ON b.created_by = u.id
                 WHERE b.id = :id AND (b.is_active = 1 OR b.is_active IS NULL)
                   AND (b.published_at IS NULL OR b.published_at <= NOW())"
            );
            $stmt->execute([':id' => $id]);
            $berita = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$berita) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Berita tidak ditemukan']);
                return;
            }

            $berita['gambar_url'] = !empty($berita['gambar']) ? $this->buildImageUrl($berita['gambar']) : null;

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
        $path = trim($path);
        if (empty($path)) {
            return '';
        }
        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }

        // Standardize path: remove leading slashes
        $cleanPath = ltrim($path, '/');

        // If path doesn't begin with storage/ or uploads/, prepend storage/
        // (Filament/Laravel default storage path in storage/app/public/)
        if (!str_starts_with($cleanPath, 'storage/') && !str_starts_with($cleanPath, 'uploads/')) {
            $cleanPath = 'storage/' . $cleanPath;
        }

        return '/' . $cleanPath;
    }
}