<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/FeaturePermissionController.php';
require_once __DIR__ . '/../../Services/PwaSession.php';
require_once __DIR__ . '/../../Services/AssetPhotoStorage.php';

use Database;
use PDO;
use App\Services\AssetPhotoStorage;

class TandaTerimaAssetController
{
    private function identity(PDO $pdo): ?array
    {
        $userId = \App\Services\PwaSession::userId();
        if (!$userId || $userId < 1) {
            http_response_code(401);
            echo json_encode(['message' => 'Silakan login untuk melihat tanda terima asset.']);
            return null;
        }
        $user = $pdo->prepare('SELECT u.id, k.id AS karyawan_id, k.nik, k.nama_lengkap
            FROM users u LEFT JOIN karyawans k ON k.id = u.karyawan_id WHERE u.id = ?');
        $user->execute([$userId]);
        $identity = $user->fetch(PDO::FETCH_ASSOC);
        if (!$identity) {
            http_response_code(401);
            echo json_encode(['message' => 'Pengguna tidak ditemukan. Silakan login kembali.']);
            return null;
        }
        $permissions = FeaturePermissionController::getPermissionsForUser($pdo, $userId);
        if (empty($permissions['tanda_terima_asset'])) {
            http_response_code(403);
            echo json_encode(['message' => 'Anda tidak memiliki akses ke tanda terima asset.']);
            return null;
        }
        return $identity;
    }

    private function scope(array $identity): array
    {
        $nik = trim((string) ($identity['nik'] ?? ''));
        $name = trim((string) ($identity['nama_lengkap'] ?? ''));
        if (empty($identity['karyawan_id']) || $nik === '' || $name === '') return [' WHERE 1 = 0', []];
        return [' WHERE karyawan_id = ? AND TRIM(nik_pemegang) = ? AND LOWER(TRIM(nama_pemegang)) = LOWER(?)',
            [(int) $identity['karyawan_id'], $nik, $name]];
    }

    private function owned(PDO $pdo, array $identity, int $id, bool $lock = false): ?array
    {
        [$where, $bindings] = $this->scope($identity);
        $bindings[] = $id;
        $statement = $pdo->prepare('SELECT * FROM tanda_terima_asset' . $where . ' AND id = ?' .
            ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''));
        $statement->execute($bindings);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['message' => 'Tanda terima asset tidak ditemukan untuk akun Anda.']);
            return null;
        }
        return $row;
    }

    private function photo(PDO $pdo, array $row): ?array
    {
        $statement = $pdo->prepare('SELECT file_name FROM tanda_terima_asset_fotos
            WHERE tanda_terima_asset_id = ? AND karyawan_id = ? AND TRIM(nik_pemegang) = ?
            AND LOWER(TRIM(nama_pemegang)) = LOWER(?) ORDER BY id DESC LIMIT 1');
        $statement->execute([$row['id'], $row['karyawan_id'], trim($row['nik_pemegang']), trim($row['nama_pemegang'])]);
        return $statement->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function index(array $params): void
    {
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;

            $page = max(1, (int) ($params['page'] ?? 1));
            $perPage = 25;
            $search = trim((string) ($params['search'] ?? ''));
            // Only use the employee identity linked to the authenticated session.
            // All three holder fields must match; incomplete identities see no records.
            [$where, $bindings] = $this->scope($identity);
            if ($search !== '') {
                $fields = ['kode_asset', 'nama_asset', 'nama_merk', 'kategori', 'nomor_seri', 'nama_pemegang', 'nik_pemegang', 'departemen_pemegang', 'lokasi'];
                $where .= ' AND (' . implode(' OR ', array_map(fn ($field) => "`$field` LIKE ?", $fields)) . ')';
                $bindings = array_merge($bindings, array_fill(0, count($fields), '%' . $search . '%'));
            }
            $count = $pdo->prepare('SELECT COUNT(*) FROM tanda_terima_asset' . $where);
            $count->execute($bindings);
            $total = (int) $count->fetchColumn();
            $lastPage = max(1, (int) ceil($total / $perPage));
            $page = min($page, $lastPage);
            $offset = ($page - 1) * $perPage;
            $statement = $pdo->prepare('SELECT id, asset_id, kode_asset, nama_asset, nama_merk, kategori,
                nomor_seri, kondisi, status, lokasi, nama_pemegang, nik_pemegang, departemen_pemegang,
                tanggal_tanda_terima, keterangan,
                EXISTS (SELECT 1 FROM tanda_terima_asset_fotos f WHERE f.tanda_terima_asset_id = tanda_terima_asset.id
                    AND f.karyawan_id = tanda_terima_asset.karyawan_id
                    AND TRIM(f.nik_pemegang) = ?
                    AND LOWER(TRIM(f.nama_pemegang)) = LOWER(?)) AS has_foto
                FROM tanda_terima_asset' . $where .
                " ORDER BY tanggal_tanda_terima DESC, id DESC LIMIT $perPage OFFSET $offset");
            // Bind the authenticated holder instead of comparing text columns across
            // tables: older AYPSIS tables can use a different MySQL collation.
            $statement->execute(array_merge([
                trim((string) ($identity['nik'] ?? '')),
                trim((string) ($identity['nama_lengkap'] ?? '')),
            ], $bindings));
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$row) $row['has_foto'] = (bool) $row['has_foto'];
            unset($row);
            header('Cache-Control: no-store');
            echo json_encode([
                'data' => $rows,
                'meta' => ['current_page' => $page, 'last_page' => $lastPage, 'per_page' => $perPage, 'total' => $total],
            ]);
        } catch (\PDOException $e) {
            error_log('TandaTerimaAssetController: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Gagal memuat data tanda terima asset. Silakan coba kembali.']);
        }
    }

    public function uploadPhoto(int $id, array $files): void
    {
        $destination = null;
        $pdo = null;
        $storageFailure = false;
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $pdo->beginTransaction();
            $row = $this->owned($pdo, $identity, $id, true);
            if (!$row) { $pdo->rollBack(); return; }
            $asset = $pdo->prepare('SELECT id FROM assets WHERE id = ? AND karyawan_id = ? AND deleted_at IS NULL' .
                ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''));
            $asset->execute([$row['asset_id'], $identity['karyawan_id']]);
            if (!$asset->fetchColumn()) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['message' => 'Data pemegang asset telah berubah atau asset tidak tersedia. Muat ulang halaman.']);
                return;
            }
            $file = $files['foto'] ?? null;
            if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new \InvalidArgumentException('Foto asset wajib diambil dan diunggah (maksimal 5 MB).');
            }
            $temporary = $file['tmp_name'] ?? '';
            if (!is_string($temporary) || !is_uploaded_file($temporary) || filesize($temporary) > 5 * 1024 * 1024) {
                throw new \InvalidArgumentException('Foto tidak valid atau melebihi 5 MB.');
            }
            $info = @getimagesize($temporary);
            $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporary);
            if (!$info || !isset($extensions[$mime]) || ($info['mime'] ?? '') !== $mime || $info[0] * $info[1] > 25000000) {
                throw new \InvalidArgumentException('Gunakan foto JPEG, PNG, atau WebP yang valid.');
            }
            $directory = AssetPhotoStorage::directory();
            $storageFailure = true;
            if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
                throw new \RuntimeException('Folder foto tidak dapat dibuat: ' . $directory);
            }
            if (!is_writable($directory)) {
                throw new \RuntimeException('Folder foto tidak dapat ditulis: ' . $directory);
            }
            $fileName = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
            $destination = $directory . '/' . $fileName;
            if (!move_uploaded_file($temporary, $destination)) throw new \RuntimeException('Foto gagal disimpan.');
            if (PHP_OS_FAMILY !== 'Windows' && !chmod($destination, 0644)) {
                throw new \RuntimeException('Izin baca foto tidak dapat diatur.');
            }
            $storageFailure = false;
            $statement = $pdo->prepare('INSERT INTO tanda_terima_asset_fotos
                (tanda_terima_asset_id, karyawan_id, nik_pemegang, nama_pemegang, uploaded_by, file_name)
                VALUES (?, ?, ?, ?, ?, ?)');
            $statement->execute([$id, $row['karyawan_id'], $row['nik_pemegang'], $row['nama_pemegang'], $identity['id'], $fileName]);
            // AYPSIS resolves this filename relative to its tanda_terima_asset disk.
            // Save on the receipt itself; assets.foto belongs to the master asset.
            $update = $pdo->prepare('UPDATE tanda_terima_asset SET foto = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([$fileName, $id]);
            $pdo->commit();
            header('Cache-Control: no-store');
            echo json_encode(['message' => 'Foto asset berhasil disimpan.']);
        } catch (\Throwable $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            if ($destination && is_file($destination)) unlink($destination);
            $invalid = $e instanceof \InvalidArgumentException;
            http_response_code($invalid ? 422 : 500);
            if (!$invalid) error_log('Asset receipt photo upload: ' . $e->getMessage());
            $message = $storageFailure
                ? 'Folder foto asset tidak dapat ditulis. Hubungi admin untuk memeriksa AYPSIS_PUBLIC_DIR dan izin folder uploads/tanda-terima-assets/photos.'
                : 'Gagal menyimpan foto asset. Silakan coba lagi.';
            echo json_encode(['message' => $invalid ? $e->getMessage() : $message]);
        }
    }

    public function showPhoto(int $id): void
    {
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $row = $this->owned($pdo, $identity, $id);
            if (!$row) return;
            $photo = $this->photo($pdo, $row);
            $fileName = $photo['file_name'] ?? '';
            $path = AssetPhotoStorage::path($fileName);
            if (!$photo || !$path) {
                http_response_code(404);
                echo json_encode(['message' => 'Foto asset belum tersedia.']);
                return;
            }
            header('Content-Type: ' . (new \finfo(FILEINFO_MIME_TYPE))->file($path));
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
            readfile($path);
        } catch (\Throwable $e) {
            error_log('Asset receipt photo: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Gagal memuat foto asset.']);
        }
    }

    public function letter(int $id): void
    {
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $asset = $this->owned($pdo, $identity, $id);
            if (!$asset) return;
            if (!$this->photo($pdo, $asset)) {
                http_response_code(409);
                echo json_encode(['message' => 'Ambil dan simpan foto asset terlebih dahulu untuk membuka surat tanda terima.']);
                return;
            }
            header('Content-Type: text/html; charset=UTF-8');
            header('Cache-Control: no-store');
            header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'");
            header('X-Content-Type-Options: nosniff');
            require __DIR__ . '/../../../views/asset-receipt-letter.php';
        } catch (\Throwable $e) {
            error_log('Asset receipt letter: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Gagal memuat surat tanda terima asset.']);
        }
    }
}
