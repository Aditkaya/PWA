<?php
// In-memory integration checks; never changes the configured MySQL database.
require_once __DIR__ . '/../app/Http/Controllers/TandaTerimaAssetController.php';

use App\Http\Controllers\TandaTerimaAssetController;
use App\Services\PwaSession;

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, karyawan_id INTEGER)');
$pdo->exec('INSERT INTO users VALUES (1, 1752), (2, 1753), (3, NULL), (4, 1754)');
$pdo->exec('CREATE TABLE karyawans (id INTEGER PRIMARY KEY, nik TEXT, nama_lengkap TEXT)');
$pdo->exec("INSERT INTO karyawans VALUES (1752, '1595', 'ADIT'), (1753, '1596', 'BUDI'), (1754, '', '')");
$pdo->exec('CREATE TABLE user_feature_permissions (user_id INTEGER, feature_key TEXT, is_enabled INTEGER)');
$pdo->exec('CREATE TABLE assets (id INTEGER PRIMARY KEY, karyawan_id INTEGER, foto TEXT, updated_by INTEGER, updated_at TEXT, deleted_at TEXT)');
$pdo->exec('INSERT INTO assets (id,karyawan_id) VALUES (1,1752)');
$pdo->exec("INSERT INTO user_feature_permissions VALUES (1, 'tanda_terima_asset', 1)");
$pdo->exec('CREATE TABLE tanda_terima_asset (id INTEGER PRIMARY KEY, asset_id INTEGER, karyawan_id INTEGER, kode_asset TEXT, nama_asset TEXT, nama_merk TEXT, kategori TEXT, nomor_seri TEXT, kondisi TEXT, status TEXT, lokasi TEXT, nama_pemegang TEXT, nik_pemegang TEXT, departemen_pemegang TEXT, tanggal_tanda_terima TEXT, keterangan TEXT)');
$pdo->exec('CREATE TABLE tanda_terima_asset_fotos (id INTEGER PRIMARY KEY, tanda_terima_asset_id INTEGER, karyawan_id INTEGER, nik_pemegang TEXT, nama_pemegang TEXT, uploaded_by INTEGER, file_name TEXT, created_at TEXT)');
$insert = $pdo->prepare("INSERT INTO tanda_terima_asset (id, asset_id, kode_asset, nama_asset, tanggal_tanda_terima, karyawan_id, nik_pemegang, nama_pemegang) VALUES (?, ?, ?, ?, '2026-10-22', 1752, '1595', ' adit ')");
for ($i = 1; $i <= 26; $i++) $insert->execute([$i, $i, 'AST-' . $i, $i === 1 ? 'Laptop Khusus' : 'Monitor']);
// Other employees, partial matches and unassigned assets must never leak.
$pdo->exec("INSERT INTO tanda_terima_asset (id, kode_asset, nama_asset, karyawan_id, nik_pemegang, nama_pemegang) VALUES
    (27, 'OTHER', 'Rahasia Budi', 1753, '1596', 'BUDI'),
    (28, 'WRONG-ID', 'Monitor', 1753, '1595', 'ADIT'),
    (29, 'WRONG-NIK', 'Monitor', 1752, '1596', 'ADIT'),
    (30, 'WRONG-NAME', 'Monitor', 1752, '1595', 'BUDI'),
    (31, 'UNASSIGNED', 'Monitor', NULL, NULL, NULL),
    (32, 'INCOMPLETE', 'Monitor', 1754, '', '')");
$property = new ReflectionProperty(Database::class, 'pdo');
$property->setAccessible(true);
$property->setValue(null, $pdo);

function requestAssets(array $params, int $expectedStatus): array {
    http_response_code(200);
    ob_start();
    (new TandaTerimaAssetController())->index($params);
    $result = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (http_response_code() !== $expectedStatus) throw new RuntimeException('Unexpected response status');
    return $result;
}
function verifyAsset(bool $condition): void {
    if (!$condition) throw new RuntimeException('Asset receipt assertion failed');
}

$tokens = [];
try {
    requestAssets(['user_id' => 1], 401); // Query parameters cannot impersonate a session.
    $token = $tokens[] = PwaSession::issue(1);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    $result = requestAssets([], 200);
    verifyAsset(count($result['data']) === 25 && $result['meta']['total'] === 26 && $result['data'][0]['id'] === 26);
    $result = requestAssets(['page' => 2], 200);
    verifyAsset(count($result['data']) === 1 && $result['data'][0]['id'] === 1);
    $result = requestAssets(['search' => 'Laptop'], 200);
    verifyAsset($result['meta']['total'] === 1 && $result['data'][0]['kode_asset'] === 'AST-1');
    $result = requestAssets(['search' => "' OR 1=1 --"], 200);
    verifyAsset($result['meta']['total'] === 0 && $result['data'] === []);
    $result = requestAssets(['page' => 999], 200);
    verifyAsset($result['meta']['current_page'] === 2 && count($result['data']) === 1);
    $result = requestAssets(['search' => 'Rahasia Budi'], 200);
    verifyAsset($result['meta']['total'] === 0 && $result['data'] === []);
    $result = requestAssets(['user_id' => 2, 'karyawan_id' => 1753, 'nik' => '1596', 'nama' => 'BUDI'], 200);
    verifyAsset($result['meta']['total'] === 26 && $result['data'][0]['id'] === 26);
    $tokens[] = $secondToken = PwaSession::issue(2);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $secondToken;
    $result = requestAssets([], 200);
    verifyAsset($result['meta']['total'] === 1 && $result['data'][0]['id'] === 27);
    foreach ([3, 4] as $emptyUserId) {
        $tokens[] = $emptyToken = PwaSession::issue($emptyUserId);
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $emptyToken;
        $result = requestAssets([], 200);
        verifyAsset($result['meta']['total'] === 0 && $result['data'] === []);
    }
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    // Every action must enforce the same owner restriction as the list.
    foreach (['showPhoto', 'letter', 'uploadPhoto'] as $action) {
        http_response_code(200);
        ob_start();
        if ($action === 'uploadPhoto') (new TandaTerimaAssetController())->uploadPhoto(27, []);
        else (new TandaTerimaAssetController())->$action(27);
        $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
        verifyAsset(http_response_code() === 404 && !empty($body['message']));
    }
    http_response_code(200);
    ob_start();
    (new TandaTerimaAssetController())->uploadPhoto(1, []);
    $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    verifyAsset(http_response_code() === 422 && !empty($body['message']));
    $pdo->exec("INSERT INTO tanda_terima_asset_fotos VALUES (1, 1, 1753, '1596', 'BUDI', 2, 'old.jpg', NULL)");
    $result = requestAssets(['search' => 'Laptop'], 200);
    verifyAsset(!(bool) $result['data'][0]['has_foto']);
    http_response_code(200);
    ob_start();
    (new TandaTerimaAssetController())->letter(1);
    $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    verifyAsset(http_response_code() === 409 && !empty($body['message']));
    $pdo->exec("INSERT INTO tanda_terima_asset_fotos VALUES (2, 1, 1752, '1595', 'ADIT', 1, 'new.jpg', NULL)");
    $result = requestAssets(['search' => 'Laptop'], 200);
    verifyAsset((bool) $result['data'][0]['has_foto']);
    $pdo->exec("UPDATE tanda_terima_asset SET nama_asset = '<script>alert(1)</script>' WHERE id = 1");
    http_response_code(200);
    ob_start();
    (new TandaTerimaAssetController())->letter(1);
    $letter = ob_get_clean();
    verifyAsset(http_response_code() === 200 && strpos($letter, '&lt;script&gt;') !== false && strpos($letter, '<script>alert(1)</script>') === false);
    $pdo->exec('UPDATE user_feature_permissions SET is_enabled = 0');
    requestAssets([], 403);
} finally {
    foreach ($tokens as $token) {
        $path = (session_save_path() ?: sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'sess_' . $token;
        if (is_file($path)) unlink($path);
    }
}
echo "20 asset receipt integration checks passed.\n";
