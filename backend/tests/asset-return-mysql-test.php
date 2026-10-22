<?php
// Temporary tables shadow the real tables on this connection; real records stay untouched.
require_once __DIR__ . '/../app/Http/Controllers/AssetReturnController.php';

use App\Http\Controllers\AssetReturnController;
use App\Services\PwaSession;

$pdo = Database::getConnection();
foreach (['pengembalian_asset', 'pengembalian_asset_items'] as $table) {
    $ddl = $pdo->query('SHOW CREATE TABLE ' . $table)->fetch(PDO::FETCH_NUM)[1];
    $pdo->exec(preg_replace('/^CREATE TABLE /', 'CREATE TEMPORARY TABLE ', $ddl, 1));
}
$pdo->exec('CREATE TEMPORARY TABLE users (id BIGINT PRIMARY KEY, karyawan_id BIGINT)');
$pdo->exec('INSERT INTO users VALUES (1,1752)');
$pdo->exec('CREATE TEMPORARY TABLE karyawans (id BIGINT PRIMARY KEY, nik VARCHAR(255), nama_lengkap VARCHAR(255))');
$pdo->exec("INSERT INTO karyawans VALUES (1752,'1595','ADIT')");
$pdo->exec('CREATE TEMPORARY TABLE user_feature_permissions (user_id BIGINT, feature_key VARCHAR(100), is_enabled INT)');
$pdo->exec('CREATE TEMPORARY TABLE assets (id BIGINT PRIMARY KEY, karyawan_id BIGINT NULL, deleted_at TIMESTAMP NULL) ENGINE=InnoDB');
$pdo->exec('INSERT INTO assets (id,karyawan_id) VALUES (1,1752),(2,1752)');
$pdo->exec('CREATE TEMPORARY TABLE tanda_terima_asset (
    id BIGINT PRIMARY KEY, asset_id BIGINT, karyawan_id BIGINT, kode_asset VARCHAR(255), nama_asset VARCHAR(255),
    nama_merk VARCHAR(255), nomor_seri VARCHAR(255), kondisi VARCHAR(255),
    nama_pemegang VARCHAR(255), nik_pemegang VARCHAR(255), departemen_pemegang VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
$pdo->exec("INSERT INTO tanda_terima_asset (id,asset_id,karyawan_id,kode_asset,nama_asset,nik_pemegang,nama_pemegang)
    VALUES (1,1,1752,'AST-1','Laptop','1595','ADIT'), (2,2,1752,'AST-2','Monitor','1595','ADIT')");
function callReturns(string $action, int $status = 200, array $data = []): array {
    http_response_code(200);
    ob_start();
    if ($action === 'submit') (new AssetReturnController())->submit($data);
    else (new AssetReturnController())->$action();
    $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (http_response_code() !== $status) throw new RuntimeException('Unexpected MySQL response: ' . json_encode($body));
    return $body;
}
$token = PwaSession::issue(1);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
try {
    if (count(callReturns('options')['data']) !== 2) throw new RuntimeException('Missing options');
    $data = ['tanggal_pengembalian' => '2026-10-22', 'alasan' => 'Mutasi', 'items' => [
        ['id' => 1, 'kondisi' => 'Baik', 'kelengkapan' => 'Lengkap'],
        ['id' => 2, 'kondisi' => 'Rusak', 'kelengkapan' => 'Tidak Lengkap'],
    ]];
    callReturns('submit', 201, $data);
    callReturns('submit', 409, $data);
    if (callReturns('options')['data'] !== []) throw new RuntimeException('Pending duplicates allowed');
    if ((int) $pdo->query('SELECT karyawan_id FROM assets WHERE id=1')->fetchColumn() !== 1752) throw new RuntimeException('Premature release');
    $pdo->exec('UPDATE assets SET karyawan_id=NULL WHERE id=1');
    if (callReturns('returns')['data'][0]['status'] !== 'menunggu_admin') throw new RuntimeException('Partial return completed');
    $pdo->exec('UPDATE assets SET karyawan_id=NULL WHERE id=2');
    if (callReturns('returns')['data'][0]['status'] !== 'dikembalikan') throw new RuntimeException('Admin release not detected');
} finally {
    $path = (session_save_path() ?: sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'sess_' . $token;
    if (is_file($path)) unlink($path);
}
echo "Native MySQL return submission, row locks, duplicate prevention, and admin release checks passed.\n";
