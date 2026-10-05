<?php

date_default_timezone_set('Asia/Jakarta');

require_once __DIR__ . '/../config/database.php';

// Load .env file jika ada (simple key=value parser, tanpa dependency)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            [$key, $val] = explode('=', $line, 2);
            $key = trim($key); $val = trim($val);
            if ($key !== '' && getenv($key) === false) {
                putenv("$key=$val");
            }
        }
    }
}

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
    define('UPLOAD_BASE_DIR', getenv('UPLOAD_BASE_DIR') ?: (file_exists('C:/kerjaan/aypsis/aypsis/aypsis/public') ? 'C:/kerjaan/aypsis/aypsis/aypsis/public' : 'D:/kerjaan/aypsis/aypsis/aypsis/public'));
    define('AYPSIS_PUBLIC_DIR', getenv('AYPSIS_PUBLIC_DIR') ?: UPLOAD_BASE_DIR);
    // Folder uploads/ lokal PWA backend (gambar disync dari AYPSIS via PWA_UPLOAD_DIR)
    define('PWA_BACKEND_UPLOADS_DIR', getenv('PWA_BACKEND_UPLOADS_DIR') ?: __DIR__ . '/../uploads');
} else {
    define('UPLOAD_BASE_DIR', getenv('UPLOAD_BASE_DIR') ?: '/var/www/pwa/backend');
    define('AYPSIS_PUBLIC_DIR', getenv('AYPSIS_PUBLIC_DIR') ?: '/var/www/aypsis/public');
    // Folder uploads/ lokal PWA backend (gambar disync dari AYPSIS via PWA_UPLOAD_DIR)
    define('PWA_BACKEND_UPLOADS_DIR', getenv('PWA_BACKEND_UPLOADS_DIR') ?: __DIR__ . '/../uploads');
}

// ── FRONTEND STATIC FILE HANDLER ──────────────────────────────────────────
// Serve file-file statis frontend (JS, CSS, images, manifest, dll) dari
// folder frontend/dist/ yang berada di sebelah folder backend/
// Struktur: /var/www/pwa/backend/routes/api.php  → __DIR__ = /var/www/pwa/backend/routes
//           /var/www/pwa/frontend/dist/           ← static files

// Coba berbagai kemungkinan path (routes/ naik 2 level, atau backend/ naik 1 level)
$_distCandidates = [
    realpath(__DIR__ . '/../../frontend/dist'),         // dari routes/ naik 2
    realpath(__DIR__ . '/../../../frontend/dist'),      // dari routes/ naik 3
    realpath(__DIR__ . '/../frontend/dist'),            // dari backend/ naik 1
];
$frontendDistDir = null;
foreach ($_distCandidates as $_dc) {
    if ($_dc !== false && is_dir($_dc)) {
        $frontendDistDir = $_dc;
        break;
    }
}
// Fallback tanpa realpath jika semua gagal (untuk path yang belum exist)
if (!$frontendDistDir) {
    $frontendDistDir = __DIR__ . '/../../frontend/dist';
}

$staticExtensions = ['js', 'mjs', 'css', 'html', 'json', 'png', 'jpg', 'jpeg',
                     'webp', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'webmanifest', 'map'];
$staticMimes = [
    'js'          => 'application/javascript',
    'mjs'         => 'application/javascript',
    'css'         => 'text/css',
    'html'        => 'text/html; charset=UTF-8',
    'json'        => 'application/json',
    'webmanifest' => 'application/manifest+json',
    'png'         => 'image/png',
    'jpg'         => 'image/jpeg',
    'jpeg'        => 'image/jpeg',
    'webp'        => 'image/webp',
    'gif'         => 'image/gif',
    'svg'         => 'image/svg+xml',
    'ico'         => 'image/x-icon',
    'woff'        => 'font/woff',
    'woff2'       => 'font/woff2',
    'ttf'         => 'font/ttf',
    'map'         => 'application/json',
];

// Cek apakah URI adalah file statis frontend (bukan API /api/...)
$uriExt = strtolower(pathinfo($uri, PATHINFO_EXTENSION));
$isStaticFrontend = in_array($uriExt, $staticExtensions)
    && strpos($uri, '/api/') !== 0
    && strpos($uri, '/uploads/') !== 0
    && strpos($uri, '/storage/') !== 0;

if ($isStaticFrontend && $frontendDistDir) {
    $candidate = realpath($frontendDistDir . $uri);
    // Security: pastikan path tidak keluar dari dist directory
    if ($candidate && is_file($candidate)) {
        $distReal = realpath($frontendDistDir);
        if ($distReal && strpos($candidate, $distReal . DIRECTORY_SEPARATOR) === 0) {
            $ext  = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
            $mime = $staticMimes[$ext] ?? 'application/octet-stream';
            header("Content-Type: $mime");
            header("Cache-Control: public, max-age=31536000, immutable");
            readfile($candidate);
            exit();
        }
    }
    // File statis tidak ditemukan di dist → 404
    http_response_code(404);
    exit();
}

// Serve index.html untuk semua route SPA (bukan API, bukan file statis dengan ekstensi)
// agar React Router bisa menangani navigasi langsung ke URL seperti /tire-tread-pattern
$isSpaRoute = strpos($uri, '/api/') !== 0
    && strpos($uri, '/uploads/') !== 0
    && strpos($uri, '/storage/') !== 0
    && $uriExt === '';  // tidak punya ekstensi → route SPA

if ($isSpaRoute && $frontendDistDir) {
    $indexHtml = realpath($frontendDistDir . '/index.html');
    if ($indexHtml && is_file($indexHtml)) {
        header("Content-Type: text/html; charset=UTF-8");
        header("Cache-Control: no-cache, no-store, must-revalidate");
        readfile($indexHtml);
        exit();
    }
}
// ── END FRONTEND STATIC FILE HANDLER ──────────────────────────────────────

// Only uploaded and storage files are public. Configuration, service tokens and AI models
// must never be exposed through this PHP router's static-file handler.
$file_path = null;
if (strpos($uri, '/uploads/') === 0 || strpos($uri, '/storage/') === 0) {
    // Cek di PWA_BACKEND_UPLOADS_DIR (uploads/ lokal) -- hilangkan prefix /uploads dari URI
    if ($file_path === null && defined('PWA_BACKEND_UPLOADS_DIR') && strpos($uri, '/uploads/') === 0) {
        $subPath = substr($uri, strlen('/uploads'));
        $candidate = realpath(PWA_BACKEND_UPLOADS_DIR . $subPath);
        if ($candidate && is_file($candidate)) {
            $baseReal = realpath(PWA_BACKEND_UPLOADS_DIR);
            if ($baseReal && strpos($candidate, $baseReal . DIRECTORY_SEPARATOR) === 0) {
                $file_path = $candidate;
            }
        }
    }
    foreach ([UPLOAD_BASE_DIR, AYPSIS_PUBLIC_DIR] as $base) {
        $candidate = realpath($base . $uri);
        if ($candidate && is_file($candidate)) {
            $baseReal = realpath($base);
            if ($baseReal && strpos($candidate, $baseReal . DIRECTORY_SEPARATOR) === 0) {
                $file_path = $candidate;
                break;
            }
        }
    }
    // Jika tidak ditemukan langsung di public/storage, coba cek di storage/app/public/...
    if ($file_path === null && strpos($uri, '/storage/') === 0) {
        $sub = substr($uri, strlen('/storage'));
        $appStorageBase = dirname(AYPSIS_PUBLIC_DIR) . '/storage/app/public';
        $candidate = realpath($appStorageBase . $sub);
        if ($candidate && is_file($candidate)) {
            $file_path = $candidate;
        }
    }

    // ── LAZY MIRROR ────────────────────────────────────────────────────────────
    // Jika file tidak ada di lokal, coba salin dari server AYPSIS.
    // Prioritas: (1) copy langsung dari filesystem AYPSIS_PUBLIC_DIR (jika server sama)
    //            (2) fetch via HTTP dari AYPSIS_BASE_URL (jika server berbeda)
    // Setelah berhasil, file tersimpan di PWA_BACKEND_UPLOADS_DIR untuk request berikutnya.
    if ($file_path === null
        && strpos($uri, '/uploads/') === 0
        && defined('PWA_BACKEND_UPLOADS_DIR')
    ) {
        $mirrorAllowed = in_array(
            strtolower(pathinfo($uri, PATHINFO_EXTENSION)),
            ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
        );

        if ($mirrorAllowed) {
            $subPath   = substr($uri, strlen('/uploads/'));   // path relatif dari uploads/
            $localDir  = rtrim(PWA_BACKEND_UPLOADS_DIR, '/\\') . DIRECTORY_SEPARATOR
                         . str_replace('/', DIRECTORY_SEPARATOR, dirname($subPath));
            $localFile = rtrim(PWA_BACKEND_UPLOADS_DIR, '/\\') . DIRECTORY_SEPARATOR
                         . str_replace('/', DIRECTORY_SEPARATOR, $subPath);

            // Buat direktori tujuan jika belum ada
            if (!is_dir($localDir)) {
                @mkdir($localDir, 0775, true);
            }

            $mirrorOk = false;

            // ── Prioritas 1: copy langsung dari filesystem AYPSIS_PUBLIC_DIR ──
            $aypsisSrcFile = rtrim(AYPSIS_PUBLIC_DIR, '/\\') . DIRECTORY_SEPARATOR
                             . str_replace('/', DIRECTORY_SEPARATOR, 'uploads/' . $subPath);
            if (!$mirrorOk && file_exists($aypsisSrcFile)) {
                if (@copy($aypsisSrcFile, $localFile)) {
                    error_log("[PWA mirror] Copied $aypsisSrcFile → $localFile");
                    $mirrorOk  = true;
                    $file_path = $localFile;
                }
            }

            // ── Prioritas 2: fetch via HTTP dari AYPSIS_BASE_URL ──────────────
            if (!$mirrorOk) {
                $aypsisBaseUrl = rtrim(getenv('AYPSIS_BASE_URL') ?: '', '/');
                if ($aypsisBaseUrl) {
                    $remoteUrl = $aypsisBaseUrl . $uri;
                    $ctx = stream_context_create(['http' => [
                        'timeout'         => 10,
                        'follow_location' => true,
                        'ignore_errors'   => true,
                    ]]);
                    $imageData = @file_get_contents($remoteUrl, false, $ctx);
                    $httpOk = false;
                    if ($imageData !== false && isset($http_response_header)) {
                        foreach ($http_response_header as $h) {
                            if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m) && (int)$m[1] === 200) {
                                $httpOk = true;
                                break;
                            }
                        }
                    }
                    if ($httpOk && $imageData !== false) {
                        file_put_contents($localFile, $imageData);
                        error_log("[PWA mirror] Fetched $remoteUrl → $localFile");
                        $mirrorOk  = true;
                        $file_path = $localFile;
                    } else {
                        error_log("[PWA mirror] HTTP fetch failed for $remoteUrl");
                    }
                }
            }
        }
    }
    // ── END LAZY MIRROR ────────────────────────────────────────────────────────

}

if ($file_path !== null) {
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
        'gif' => 'image/gif',
        'webp' => 'image/webp',
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

// Debug endpoint – cek path server dan status file dist
if ($uri === '/api/debug-paths' && $method === 'GET') {
    $indexExists  = $frontendDistDir && file_exists($frontendDistDir . '/index.html');
    $assetsDir    = $frontendDistDir ? $frontendDistDir . '/assets' : null;
    $assetFiles   = ($assetsDir && is_dir($assetsDir)) ? array_slice(scandir($assetsDir), 2, 10) : [];
    echo json_encode([
        '__DIR__'           => __DIR__,
        'frontendDistDir'   => $frontendDistDir,
        'index_html_exists' => $indexExists,
        'assets_files'      => $assetFiles,
        'server_name'       => $_SERVER['SERVER_NAME'] ?? '-',
        'document_root'     => $_SERVER['DOCUMENT_ROOT'] ?? '-',
    ], JSON_PRETTY_PRINT);
    exit();
}

if ($uri === '/api/denah-gudang/layout' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/DenahGudangController.php';
    (new \App\Http\Controllers\DenahGudangController())->saveLayout(is_array($requestData) ? $requestData : []);
    exit();
}

if ($uri === '/api/denah-gudang' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/DenahGudangController.php';
    (new \App\Http\Controllers\DenahGudangController())->handle($_GET);
    exit();
}

$stowageRoutes = [
    'GET /api/stowage-plan/ships' => 'ships',
    'GET /api/stowage-plan/voyages' => 'voyages',
    'GET /api/stowage-plan' => 'show',
    'POST /api/stowage-plan' => 'save',
    'POST /api/stowage-plan/cancel' => 'cancel',
];
if (isset($stowageRoutes[$method . ' ' . $uri])) {
    require_once __DIR__ . '/../app/Http/Controllers/StowagePlanController.php';
    (new \App\Http\Controllers\StowagePlanController())->handle(
        $stowageRoutes[$method . ' ' . $uri],
        $method === 'GET' ? $_GET : (is_array($requestData) ? $requestData : [])
    );
    exit();
}

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

if ($uri === '/api/register' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/Auth/RegisterController.php';
    $controller = new \App\Http\Controllers\Auth\RegisterController();
    $controller->register($requestData);
    exit();
}

if ($uri === '/api/karyawans/search' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/KaryawanController.php';
    $controller = new \App\Http\Controllers\KaryawanController();
    $controller->search($_GET);
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

// Gerak Voyage — Tanggal Pergerakan Kapal
if ($uri === '/api/gerak-voyage/ships' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/GerakVoyageController.php';
    (new \App\Http\Controllers\GerakVoyageController())->getShips();
    exit();
}

if ($uri === '/api/gerak-voyage/voyages' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/GerakVoyageController.php';
    (new \App\Http\Controllers\GerakVoyageController())->getVoyages($_GET);
    exit();
}

if ($uri === '/api/gerak-voyage' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/GerakVoyageController.php';
    (new \App\Http\Controllers\GerakVoyageController())->getData($_GET);
    exit();
}

if ($uri === '/api/gerak-voyage' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/GerakVoyageController.php';
    (new \App\Http\Controllers\GerakVoyageController())->save(is_array($requestData) ? $requestData : []);
    exit();
}
if ($uri === '/api/kapal' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/KapalController.php';
    $controller = new \App\Http\Controllers\KapalController();
    $controller->getKapal();
    exit();
}

if ($uri === '/api/kapal/voyages' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/KapalController.php';
    $controller = new \App\Http\Controllers\KapalController();
    $controller->getVoyages($_GET);
    exit();
}

if ($uri === '/api/amprahan/request' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';
    $controller = new \App\Http\Controllers\AmprahanController();
    $controller->submitRequest($requestData);
    exit();
}

if ($uri === '/api/amprahan/mobils' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';
    $controller = new \App\Http\Controllers\AmprahanController();
    $controller->getMobils();
    exit();
}

if ($uri === '/api/amprahan/alat-berats' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';
    $controller = new \App\Http\Controllers\AmprahanController();
    $controller->getAlatBerats();
    exit();
}

if ($uri === '/api/amprahan/approved' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';
    $controller = new \App\Http\Controllers\AmprahanController();
    $controller->getApprovedRequests($_GET);
    exit();
}

if ($uri === '/api/amprahan/receive' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';
    $controller = new \App\Http\Controllers\AmprahanController();
    $controller->submitTandaTerima($requestData);
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

// =====================================================================
// IT Admin – Feature Permission Routes
// =====================================================================
if ($uri === '/api/it/users' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/FeaturePermissionController.php';
    $controller = new \App\Http\Controllers\FeaturePermissionController();
    $controller->getUsers($_GET);
    exit();
}

if ($uri === '/api/it/feature-permissions' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/FeaturePermissionController.php';
    $controller = new \App\Http\Controllers\FeaturePermissionController();
    $controller->updatePermission(is_array($requestData) ? $requestData : []);
    exit();
}

if ($uri === '/api/it/feature-permissions/bulk' && $method === 'PUT') {
    require_once __DIR__ . '/../app/Http/Controllers/FeaturePermissionController.php';
    $controller = new \App\Http\Controllers\FeaturePermissionController();
    $controller->bulkUpdatePermissions(is_array($requestData) ? $requestData : []);
    exit();
}

if ($uri === '/api/it/feature-permissions/all' && ($method === 'POST' || $method === 'PUT')) {
    require_once __DIR__ . '/../app/Http/Controllers/FeaturePermissionController.php';
    $controller = new \App\Http\Controllers\FeaturePermissionController();
    $controller->bulkUpdateAllUsers(is_array($requestData) ? $requestData : []);
    exit();
}


// =====================================================================
// Berita & Pamflet – Konten PWA
// =====================================================================
if ($uri === '/api/berita' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/BeritaController.php';
    $controller = new \App\Http\Controllers\BeritaController();
    $controller->index($_GET);
    exit();
}

if (preg_match('#^/api/berita/(\d+)$#', $uri, $matches) && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/BeritaController.php';
    $controller = new \App\Http\Controllers\BeritaController();
    $controller->show((int)$matches[1]);
    exit();
}

// =====================================================================
// Tire Tread Pattern – Kendaraan & Alat Berat
// =====================================================================
if ($uri === '/api/tire-tread/units' && $method === 'GET') {
    require_once __DIR__ . '/../app/Http/Controllers/TireTreadPatternController.php';
    $controller = new \App\Http\Controllers\TireTreadPatternController();
    $controller->getUnits($_GET);
    exit();
}

http_response_code(404);
echo json_encode(['message' => 'Endpoint tidak ditemukan']);


