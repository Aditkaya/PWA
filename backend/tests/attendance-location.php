<?php
// Invalid locations must be rejected before connecting to a database or saving photos.
require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
$valid = ['user_id' => 1, 'tipe' => 'Masuk', 'latitude' => -6.2, 'longitude' => 106.8, 'gps_accuracy' => 11, 'location_age_ms' => 0];
$cases = [
    ['gps_accuracy' => null], ['gps_accuracy' => 0],
    ['gps_accuracy' => -1], ['gps_accuracy' => 'NaN'],
    ['location_age_ms' => 30001], ['location_age_ms' => -1], ['location_age_ms' => null],
    ['latitude' => 91], ['longitude' => 181], ['latitude' => null], ['longitude' => INF],
];
foreach ($cases as $case) {
    http_response_code(200);
    ob_start();
    (new \App\Http\Controllers\AttendanceController())->submitBreak(array_replace($valid, $case));
    $response = json_decode(ob_get_clean(), true);
    if (http_response_code() !== 422 || empty($response['message'])) {
        throw new RuntimeException('Invalid GPS data was not rejected');
    }
}

// In-memory integration checks stop at an approved leave, before face AI or writes.
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->exec('CREATE TABLE users (id INTEGER, karyawan_id INTEGER)');
$pdo->exec('CREATE TABLE karyawans (id INTEGER, nik TEXT)');
$pdo->exec('INSERT INTO users VALUES (1, 1)');
$pdo->exec("INSERT INTO karyawans VALUES (1, 'TEST')");
$pdo->exec('CREATE TABLE lokasi_absensis (id INTEGER, latitude REAL, longitude REAL, radius REAL, max_accuracy REAL, nama_lokasi TEXT, tipe_penugasan TEXT, is_active INTEGER)');
$pdo->exec('CREATE TABLE lokasi_absensi_karyawan (karyawan_id INTEGER, lokasi_absensi_id INTEGER)');
$pdo->exec('CREATE TABLE permohonan_izins (id INTEGER, karyawan_id INTEGER, jenis_izin TEXT, status TEXT, tanggal_mulai TEXT, tanggal_selesai TEXT)');
$pdo->exec('CREATE TABLE cutis (id INTEGER, karyawan_id INTEGER, status TEXT, tanggal_mulai TEXT, tanggal_selesai TEXT)');
$pdo->exec("INSERT INTO permohonan_izins VALUES (1, 1, 'Sakit', 'disetujui', '2000-01-01', '2100-01-01')");
$pdo->exec("INSERT INTO lokasi_absensis VALUES (1, -6.2, 106.8, 50, 10, 'Kantor', 'semua', 1)");
$property = new ReflectionProperty(Database::class, 'pdo');
$property->setAccessible(true);
$property->setValue(null, $pdo);

$check = function (array $data, int $status) use ($valid) {
    http_response_code(200);
    ob_start();
    (new \App\Http\Controllers\AttendanceController())->submitBreak(array_replace($valid, $data));
    $body = json_decode(ob_get_clean(), true);
    if (http_response_code() !== $status) {
        throw new RuntimeException('Unexpected accuracy validation result: ' . json_encode($body));
    }
};
$check(['gps_accuracy' => 11, 'max_accuracy' => 1000], 422); // Cannot override server limit.
$check(['gps_accuracy' => 10], 403); // Exact boundary passes GPS, reaches leave gate.
$pdo->exec('UPDATE lokasi_absensis SET max_accuracy = 100');
$check(['gps_accuracy' => 80], 403);
$check(['gps_accuracy' => 100], 403);
$check(['gps_accuracy' => 101], 422);
$check(['gps_accuracy' => 101, 'is_offline' => 1, 'location_age_ms' => 40000], 422);
$check(['gps_accuracy' => 100, 'is_offline' => 1, 'location_age_ms' => 40000], 403);
$pdo->exec('UPDATE lokasi_absensis SET max_accuracy = NULL');
$check(['gps_accuracy' => 51], 422);
$check(['gps_accuracy' => 50], 403);

// Special assignment takes priority over the public location.
$pdo->exec("INSERT INTO lokasi_absensis VALUES (2, -6.201, 106.8, 200, 100, 'Khusus', 'khusus', 1)");
$pdo->exec('INSERT INTO lokasi_absensi_karyawan VALUES (1, 2)');
$check(['gps_accuracy' => 80], 403);

require_once __DIR__ . '/../app/Http/Controllers/LocationController.php';
$_GET['user_id'] = 1;
ob_start();
(new \App\Http\Controllers\LocationController())->getLokasi();
$locations = json_decode(ob_get_clean(), true);
if (count($locations['data']) !== 1 || (float)$locations['data'][0]['max_accuracy'] !== 100.0) {
    throw new RuntimeException('Assigned location API must expose max_accuracy');
}
echo count($cases) . " location validation cases and 11 max accuracy integration cases passed\n";
