<?php
// Temporary tables shadow real tables on this connection only. No real records change.
require_once __DIR__ . '/../app/Http/Controllers/TandaTerimaAssetController.php';
use App\Http\Controllers\TandaTerimaAssetController;
use App\Services\PwaSession;

$pdo = Database::getConnection();
$pdo->exec('CREATE TEMPORARY TABLE users (id BIGINT PRIMARY KEY, karyawan_id BIGINT)');
$pdo->exec('INSERT INTO users VALUES (1,1752)');
$pdo->exec('CREATE TEMPORARY TABLE karyawans (id BIGINT PRIMARY KEY, nik VARCHAR(255), nama_lengkap VARCHAR(255))');
$pdo->exec("INSERT INTO karyawans VALUES (1752,'1595','ADIT')");
$pdo->exec('CREATE TEMPORARY TABLE user_feature_permissions (user_id BIGINT, feature_key VARCHAR(100), is_enabled INT)');
$pdo->exec('CREATE TEMPORARY TABLE tanda_terima_asset (
    id BIGINT PRIMARY KEY, asset_id BIGINT, karyawan_id BIGINT, kode_asset VARCHAR(255), nama_asset VARCHAR(255),
    nama_merk VARCHAR(255), kategori VARCHAR(255), nomor_seri VARCHAR(255), kondisi VARCHAR(255), status VARCHAR(255),
    lokasi VARCHAR(255), nama_pemegang VARCHAR(255), nik_pemegang VARCHAR(255), departemen_pemegang VARCHAR(255),
    tanggal_tanda_terima DATE, keterangan TEXT, foto VARCHAR(255)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
// Reproduce tables with different collations (works on MySQL and MariaDB).
$pdo->exec('CREATE TEMPORARY TABLE tanda_terima_asset_fotos (
    id BIGINT PRIMARY KEY, tanda_terima_asset_id BIGINT, karyawan_id BIGINT, nik_pemegang VARCHAR(255),
    nama_pemegang VARCHAR(255), file_name VARCHAR(100)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci');
$pdo->exec("INSERT INTO tanda_terima_asset (id,asset_id,karyawan_id,kode_asset,nama_asset,nik_pemegang,nama_pemegang)
    VALUES (1,1,1752,'AST-1','Laptop','1595','ADIT'), (2,2,1753,'AST-2','Monitor','1596','BUDI')");
$pdo->exec("INSERT INTO tanda_terima_asset_fotos VALUES (1,1,1753,'1596','BUDI','other.jpg')");
$token = null;
function checkMysqlAssets(array $params, bool $hasPhoto): void {
    http_response_code(200);
    ob_start();
    (new TandaTerimaAssetController())->index($params);
    $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (http_response_code() !== 200 || $body['meta']['total'] !== 1 ||
        $body['data'][0]['id'] !== 1 || $body['data'][0]['has_foto'] !== $hasPhoto) {
        throw new RuntimeException('MySQL holder/collation regression: ' . json_encode($body));
    }
}
try {
    $token = PwaSession::issue(1);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    checkMysqlAssets([], false);
    $pdo->exec("INSERT INTO tanda_terima_asset_fotos VALUES (2,1,1752,'1595','ADIT','own.jpg')");
    checkMysqlAssets([], true);
    checkMysqlAssets(['search' => 'Laptop'], true);
    $pdo->exec("UPDATE tanda_terima_asset SET foto='AypsisExternalPhoto.jpeg' WHERE id=1");
    checkMysqlAssets([], true);
} finally {
    if ($token) {
        $path = (session_save_path() ?: sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'sess_' . $token;
        if (is_file($path)) unlink($path);
    }
}
echo "3 native MySQL collation and ownership checks passed.\n";
