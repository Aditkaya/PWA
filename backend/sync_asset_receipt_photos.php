<?php
// Backfill existing PWA photos into tanda_terima_asset.foto without replacing receipt photos.
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/app/Services/AssetPhotoStorage.php';
use App\Services\AssetPhotoStorage;

if (is_file(__DIR__ . '/.env') && getenv('AYPSIS_PUBLIC_DIR') === false) {
    foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*AYPSIS_PUBLIC_DIR\s*=(.*)$/', $line, $match)) {
            putenv('AYPSIS_PUBLIC_DIR=' . trim($match[1], " \t\n\r\0\x0B\"'"));
            break;
        }
    }
}

try {
    $pdo = Database::getConnection();
    $rows = $pdo->query("SELECT t.id, t.asset_id, t.karyawan_id, t.nik_pemegang, t.nama_pemegang,
        k.nik, k.nama_lengkap FROM tanda_terima_asset t
        JOIN assets a ON a.id = t.asset_id AND a.karyawan_id = t.karyawan_id
        JOIN karyawans k ON k.id = t.karyawan_id
        WHERE a.deleted_at IS NULL AND (t.foto IS NULL OR t.foto = '')")->fetchAll(PDO::FETCH_ASSOC);
    $synced = 0;
    $skipped = 0;
    $normalize = static fn ($value) => function_exists('mb_strtolower')
        ? mb_strtolower(trim((string) $value), 'UTF-8') : strtolower(trim((string) $value));
    foreach ($rows as $row) {
        if (trim((string) $row['nik']) === '' || trim((string) $row['nama_lengkap']) === '' ||
            trim((string) $row['nik']) !== trim((string) $row['nik_pemegang']) ||
            $normalize($row['nama_lengkap']) !== $normalize($row['nama_pemegang'])) {
            $skipped++;
            continue;
        }
        $photos = $pdo->prepare('SELECT file_name, uploaded_by FROM tanda_terima_asset_fotos
            WHERE tanda_terima_asset_id = ? AND karyawan_id = ? AND TRIM(nik_pemegang) = ?
            AND LOWER(TRIM(nama_pemegang)) = LOWER(?) ORDER BY id DESC LIMIT 1');
        $photos->execute([$row['id'], $row['karyawan_id'], trim($row['nik']), trim($row['nama_lengkap'])]);
        $photo = $photos->fetch(PDO::FETCH_ASSOC);
        $source = $photo ? AssetPhotoStorage::path($photo['file_name']) : null;
        if (!$source) { $skipped++; continue; }
        $directory = AssetPhotoStorage::directory();
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new RuntimeException('Folder foto tanda terima asset tidak dapat dibuat.');
        }
        $destination = $directory . '/' . $photo['file_name'];
        if (!is_file($destination) && !copy($source, $destination)) throw new RuntimeException('Foto lama gagal disalin.');
        $update = $pdo->prepare("UPDATE tanda_terima_asset SET foto = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND asset_id = ? AND karyawan_id = ? AND (foto IS NULL OR foto = '')
            AND TRIM(nik_pemegang) = ? AND LOWER(TRIM(nama_pemegang)) = LOWER(?)
            AND EXISTS (SELECT 1 FROM assets a WHERE a.id = tanda_terima_asset.asset_id
                AND a.karyawan_id = tanda_terima_asset.karyawan_id AND a.deleted_at IS NULL)");
        $update->execute([$photo['file_name'], $row['id'], $row['asset_id'], $row['karyawan_id'],
            trim($row['nik']), trim($row['nama_lengkap'])]);
        $synced += $update->rowCount();
    }
    echo "Foto dihubungkan ke tanda_terima_asset.foto: $synced. Dilewati: $skipped.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Sinkronisasi foto asset gagal: ' . $e->getMessage() . "\n");
    exit(1);
}
