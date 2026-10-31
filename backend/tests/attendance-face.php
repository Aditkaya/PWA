<?php
// Isolated SQLite controller test. Never connects to the configured MySQL DB.
$_SERVER['SERVER_NAME'] = 'localhost';
define('UPLOAD_BASE_DIR', $argv[1]);
define('AYPSIS_PUBLIC_DIR', $argv[1]);
require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
class FaceTestPDO extends PDO {
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        if ($query === "SHOW COLUMNS FROM users LIKE 'face_photo_base64'") {
            return parent::query('SELECT NULL WHERE 0');
        }
        return $fetchMode === null ? parent::query($query) : parent::query($query, $fetchMode, ...$fetchModeArgs);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $query = str_replace(
            ['DATE_SUB(?, INTERVAL 2 MINUTE)', 'DATE_ADD(?, INTERVAL 2 MINUTE)'],
            ["datetime(?, '-2 minutes')", "datetime(?, '+2 minutes')"], $query
        );
        return parent::prepare($query, $options);
    }
}
$pdo = new FaceTestPDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->sqliteCreateFunction('NOW', function () { return date('Y-m-d H:i:s'); });
$pdo->exec('CREATE TABLE users (id INTEGER, karyawan_id INTEGER, face_photo_path TEXT, face_verified_at TEXT)');
$pdo->exec('CREATE TABLE karyawans (id INTEGER, nik TEXT)');
$pdo->exec('CREATE TABLE permohonan_izins (id INTEGER, karyawan_id INTEGER, jenis_izin TEXT, status TEXT, tanggal_mulai TEXT, tanggal_selesai TEXT)');
$pdo->exec('CREATE TABLE cutis (id INTEGER, karyawan_id INTEGER, status TEXT, tanggal_mulai TEXT, tanggal_selesai TEXT)');
$pdo->exec('CREATE TABLE absensis (id INTEGER PRIMARY KEY AUTOINCREMENT, karyawan_id INTEGER, nik TEXT, waktu TEXT, tipe TEXT, status TEXT, foto TEXT, latitude TEXT, longitude TEXT, detail_lokasi TEXT, keterangan TEXT)');
$pdo->exec('CREATE TABLE lokasi_absensis (id INTEGER, latitude REAL, longitude REAL, radius REAL, max_accuracy REAL, nama_lokasi TEXT, tipe_penugasan TEXT, is_active INTEGER)');
$pdo->exec('CREATE TABLE lokasi_absensi_karyawan (karyawan_id INTEGER, lokasi_absensi_id INTEGER)');
$pdo->exec("INSERT INTO users VALUES (1,1,'uploads/face_verifications/reference.jpg','2026-09-11')");
$pdo->exec("INSERT INTO karyawans VALUES (1,'TEST')");
$property = new ReflectionProperty(Database::class, 'pdo');
$property->setAccessible(true);
$property->setValue(null, $pdo);
mkdir(UPLOAD_BASE_DIR . '/uploads/face_verifications', 0700, true);
$image = imagecreatetruecolor(64, 64);
imagejpeg($image, UPLOAD_BASE_DIR . '/uploads/face_verifications/reference.jpg');
imagedestroy($image);
$photo = 'data:image/jpeg;base64,' . base64_encode(file_get_contents(UPLOAD_BASE_DIR . '/uploads/face_verifications/reference.jpg'));
if (($argv[2] ?? '') === 'missing') $photo = null;
ob_start();
$data = ['user_id' => 1, 'tipe' => 'Masuk', 'foto_base64' => $photo, 'latitude' => -6.2, 'longitude' => 106.8, 'gps_accuracy' => 11, 'location_age_ms' => 0];
if (($argv[2] ?? '') === 'offline') {
    $data['is_offline'] = 1;
    $data['waktu_offline'] = '2026-10-30 21:00:00';
}
(new \App\Http\Controllers\AttendanceController())->submitBreak($data);
$response = ob_get_clean();
echo json_encode(['status' => http_response_code(), 'count' => (int) $pdo->query('SELECT COUNT(*) FROM absensis')->fetchColumn(), 'body' => json_decode($response, true), 'record' => $pdo->query('SELECT * FROM absensis LIMIT 1')->fetch()]);
