<?php

require_once __DIR__ . '/../config/database.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: OPTIONS,GET,POST,PUT,DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$isLocalServer = ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_NAME'] === '127.0.0.1');
if ($isLocalServer) {
    define('UPLOAD_BASE_DIR', 'D:/kerjaan/aypsis/aypsis/aypsis/public');
    define('AYPSIS_PUBLIC_DIR', 'D:/kerjaan/aypsis/aypsis/aypsis/public');
} else {
    define('UPLOAD_BASE_DIR', '/var/www/pwa/backend');
    define('AYPSIS_PUBLIC_DIR', '/var/www/aypsis/public');
}

// Serve static files (like uploaded images) with CORS headers
$file_path = UPLOAD_BASE_DIR . $uri;
if (!file_exists($file_path) && defined('AYPSIS_PUBLIC_DIR')) {
    $fallback_path = AYPSIS_PUBLIC_DIR . $uri;
    if (file_exists($fallback_path) && is_file($fallback_path)) {
        $file_path = $fallback_path;
    }
}

if (file_exists($file_path) && is_file($file_path)) {
    $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
    $mimes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'mjs' => 'application/javascript',
        'json' => 'application/json',
        'html' => 'text/html',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'webmanifest' => 'application/manifest+json'
    ];
    
    if (isset($mimes[$ext])) {
        $mime = $mimes[$ext];
    } else {
        $mime = mime_content_type($file_path);
        if ($mime === false) {
            $mime = 'application/octet-stream';
        }
    }
    header("Content-Type: $mime");
    readfile($file_path);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$requestData = json_decode(file_get_contents('php://input'), true);

if ($uri === '/api/debug_lembur' && $method === 'GET') {
    $pdo = Database::getConnection();

    $stmt = $pdo->query("SELECT id, karyawan_id, nik, tipe, waktu FROM absensis WHERE DATE(waktu) >= '2026-08-24' ORDER BY id DESC LIMIT 10");
    echo "Absensis:\n";
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

    $stmtPlan = $pdo->query("SELECT id, karyawan_id, tanggal, jam_mulai, jam_selesai FROM perencanaan_lemburs WHERE tanggal >= '2026-08-24' ORDER BY id DESC LIMIT 5");
    echo "\nPerencanaan Lemburs:\n";
    print_r($stmtPlan->fetchAll(PDO::FETCH_ASSOC));

    $stmtApprove = $pdo->query("SELECT id, karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, status FROM persetujuan_absensi_lemburs WHERE tanggal >= '2026-08-24' ORDER BY id DESC LIMIT 5");
    echo "\nPersetujuan Absensi Lemburs:\n";
    print_r($stmtApprove->fetchAll(PDO::FETCH_ASSOC));
    exit();
}

if ($uri === '/api/login' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/Auth/LoginController.php';
    $controller = new \App\Http\Controllers\Auth\LoginController();
    $controller->login($requestData);
    exit();
}

if ($uri === '/api/profile' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->getProfile($_GET);
    exit();
}

if ($uri === '/api/profile/upload' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->uploadAvatar($_POST, $_FILES);
    exit();
}

if ($uri === '/api/profile/avatar' && $method === 'DELETE') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->deleteAvatar($requestData);
    exit();
}

if ($uri === '/api/face-registration' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->registerFace($requestData);
    exit();
}

if ($uri === '/api/profile' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->updateProfile($requestData);
    exit();
}

if ($uri === '/api/profile/password' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/ProfileController.php';
    $controller = new \App\Http\Controllers\ProfileController();
    $controller->changePassword($requestData);
    exit();
}

if ($uri === '/api/izin' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->submitIzin($_POST, $_FILES);
    exit();
}

if ($uri === '/api/cuti' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->submitCuti($_POST);
    exit();
}

if ($uri === '/api/attendance/lupa' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->submitLupaAbsen($_POST);
    exit();
}

if ($uri === '/api/permohonan' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->getPermohonan($_GET);
    exit();
}

if ($uri === '/api/permohonan' && $method === 'DELETE') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->deletePermohonan($requestData);
    exit();
}

if ($uri === '/api/permohonan/keterangan' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/PermohonanController.php';
    $controller = new \App\Http\Controllers\PermohonanController();
    $controller->updateKeteranganKaryawan($requestData);
    exit();
}

if ($uri === '/api/hrd/bawahan' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/PerencanaanLemburController.php';
    $controller = new \App\Http\Controllers\PerencanaanLemburController();
    $controller->getBawahan($_GET);
    exit();
}

if ($uri === '/api/hrd/perencanaan-lembur' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/PerencanaanLemburController.php';
    $controller = new \App\Http\Controllers\PerencanaanLemburController();
    $controller->store($requestData);
    exit();
}

if ($uri === '/api/hrd/perencanaan-lembur/history' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/PerencanaanLemburController.php';
    $controller = new \App\Http\Controllers\PerencanaanLemburController();
    $controller->getHistory($_GET);
    exit();
}

if (preg_match('#^/api/hrd/perencanaan-lembur/(\d+)$#', $uri, $matches)) {
    require_once __DIR__ . '/../app/Http/Controllers/PerencanaanLemburController.php';
    $controller = new \App\Http\Controllers\PerencanaanLemburController();
    $id = $matches[1];
    if ($method === 'PUT' || $method === 'PATCH') {
        $controller->update($id, $requestData);
    } else if ($method === 'DELETE') {
        $controller->destroy($id, $_GET);
    }
    exit();
}

if ($uri === '/api/hrd/permohonan' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/ApprovalController.php';
    $controller = new \App\Http\Controllers\ApprovalController();
    $controller->getAllPermohonan($_GET);
    exit();
}

if (preg_match('#^/api/hrd/permohonan/(\d+)$#', $uri, $matches) && $method === 'DELETE') {
    require_once __DIR__ . '/../app/Http/Controllers/ApprovalController.php';
    $controller = new \App\Http\Controllers\ApprovalController();
    $controller->destroy($matches[1], $_GET);
    exit();
}

if ($uri === '/api/hrd/permohonan/status' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/ApprovalController.php';
    $controller = new \App\Http\Controllers\ApprovalController();
    $controller->updateStatus($requestData);
    exit();
}

if ($uri === '/api/lokasi' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/LocationController.php';
    $controller = new \App\Http\Controllers\LocationController();
    $controller->getLokasi();
    exit();
}

if ($uri === '/api/holidays' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/HolidayController.php';
    $controller = new \App\Http\Controllers\HolidayController();
    $controller->getHolidays();
    exit();
}

if ($uri === '/api/history' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/HistoryController.php';
    $controller = new \App\Http\Controllers\HistoryController();
    $controller->getHistory($_GET);
    exit();
}

if ($uri === '/api/attendance/break' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
    $controller = new \App\Http\Controllers\AttendanceController();
    $controller->submitBreak($_POST);
    exit();
}

if ($uri === '/api/attendance/lupa' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
    $controller = new \App\Http\Controllers\AttendanceController();
    $controller->submitLupaAbsen($_POST);
    exit();
}

if ($uri === '/api/attendance/lembur' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
    $controller = new \App\Http\Controllers\AttendanceController();
    $controller->submitLembur($_POST);
    exit();
}

if ($uri === '/api/health' && $method === 'GET') {
    try {
        $pdo = Database::getConnection();
        // Test query
        $stmt = $pdo->query("SELECT 1");
        http_response_code(200);
        echo json_encode(['status' => 'connected', 'message' => 'Database connection successful']);
    } catch (\PDOException $e) {
        http_response_code(500);
        error_log('Database error: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => 'Terjadi kesalahan pada server']);
    }
    exit();
}

http_response_code(404);
echo json_encode(['message' => 'Endpoint tidak ditemukan']);
