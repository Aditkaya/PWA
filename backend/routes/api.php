<?php

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

// Serve static files (like uploaded images) with CORS headers
$file_path = __DIR__ . '/..' . $uri;
if (file_exists($file_path) && is_file($file_path)) {
    $mime = mime_content_type($file_path);
    if ($mime === false) {
        $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
        $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];
        $mime = $mimes[$ext] ?? 'application/octet-stream';
    }
    header("Content-Type: $mime");
    readfile($file_path);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$requestData = json_decode(file_get_contents('php://input'), true);

if ($uri === '/api/login' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/Auth/LoginController.php';
    $controller = new \App\Http\Controllers\Auth\LoginController();
    $controller->login($requestData);
    exit();
}

if ($uri === '/api/profile' && $method === 'GET') {
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID diperlukan']);
        exit();
    }
    
    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        $stmt = $pdo->prepare("SELECT k.* FROM karyawans k JOIN users u ON u.karyawan_id = k.id WHERE u.id = ?");
        $stmt->execute([$user_id]);
        $karyawan = $stmt->fetch();
        
        if ($karyawan) {
            $avatar_path = "/uploads/avatars/avatar_{$user_id}.jpg";
            if (file_exists(__DIR__ . '/..' . $avatar_path)) {
                $karyawan['avatar_url'] = 'http://localhost:8000' . $avatar_path . '?v=' . time();
            } else {
                $karyawan['avatar_url'] = null;
            }
            http_response_code(200);
            echo json_encode(['data' => $karyawan]);
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Data karyawan tidak ditemukan']);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/profile/upload' && $method === 'POST') {
    $user_id = $_POST['user_id'] ?? null;
    
    if (!$user_id || !isset($_FILES['avatar'])) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID dan file gambar diperlukan']);
        exit();
    }

    $upload_dir = __DIR__ . '/../uploads/avatars/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
    
    $file = $_FILES['avatar'];
    // Simple validation (can be expanded)
    $allowed_types = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!in_array($file['type'], $allowed_types)) {
        http_response_code(400);
        echo json_encode(['message' => 'Format file tidak didukung']);
        exit();
    }
    
    // Save image with user id pattern
    $filename = 'avatar_' . $user_id . '.jpg';
    $target_path = $upload_dir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $target_path)) {
        http_response_code(200);
        echo json_encode([
            'message' => 'Berhasil mengunggah foto',
            'avatar_url' => 'http://localhost:8000/uploads/avatars/' . $filename . '?v=' . time()
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Gagal menyimpan foto']);
    }
    exit();
}

if ($uri === '/api/profile' && $method === 'GET') {
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID diperlukan']);
        exit();
    }
    
    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        $stmt = $pdo->prepare("
            SELECT u.id, u.username, k.id as karyawan_id, k.nik, k.nama_lengkap, k.divisi, k.grup 
            FROM users u
            LEFT JOIN karyawans k ON u.karyawan_id = k.id
            WHERE u.id = ?
        ");
        $stmt->execute([$user_id]);
        $profile = $stmt->fetch();
        
        if ($profile) {
            $profile['has_full_day_leave'] = false;
            if ($profile['karyawan_id']) {
                $today = date('Y-m-d');
                $stmtLeave = $pdo->prepare("SELECT id FROM permohonan_izins WHERE karyawan_id = ? AND jenis_izin = 'Tidak Masuk' AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
                $stmtLeave->execute([$profile['karyawan_id'], $today]);
                if ($stmtLeave->fetch()) {
                    $profile['has_full_day_leave'] = true;
                }
            }
            echo json_encode(['data' => $profile]);
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'User tidak ditemukan']);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/izin' && $method === 'POST') {
    $karyawan_id = $_POST['karyawan_id'] ?? null;
    $nik = $_POST['nik'] ?? null;
    $nama = $_POST['nama'] ?? null;
    $divisi = $_POST['divisi'] ?? null;
    $jenis_izin = $_POST['jenis_izin'] ?? null;
    $tanggal_mulai = $_POST['tanggal_mulai'] ?? null;
    $tanggal_selesai = $_POST['tanggal_selesai'] ?? null;
    $waktu = $_POST['waktu'] ?? null;
    $alasan = $_POST['alasan'] ?? null;

    if (!$karyawan_id || !$nama || !$jenis_izin || !$tanggal_mulai) {
        http_response_code(400);
        echo json_encode(['message' => 'Data permohonan tidak lengkap']);
        exit();
    }

    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $stmt = $pdo->prepare("INSERT INTO permohonan_izins (karyawan_id, nik, nama, divisi, jenis_izin, tanggal_mulai, tanggal_selesai, waktu, alasan, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())");
        $stmt->execute([$karyawan_id, $nik, $nama, $divisi, $jenis_izin, $tanggal_mulai, $tanggal_selesai, $waktu, $alasan]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Permohonan izin berhasil diajukan']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/lokasi' && $method === 'GET') {
    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        $stmt = $pdo->query("SELECT latitude, longitude, radius, nama_lokasi FROM lokasi_absensis WHERE is_active = 1");
        $lokasi = $stmt->fetchAll();
        
        echo json_encode(['data' => $lokasi]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/history' && $method === 'GET') {
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID diperlukan']);
        exit();
    }
    
    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        $stmt = $pdo->prepare("
        SELECT a.id, DATE(a.waktu) as date, a.tipe as type, TIME_FORMAT(a.waktu, '%H:%i') as time, IFNULL(a.status, 'Selesai') as status, a.foto, a.detail_lokasi as location, a.latitude as lat, a.longitude as lng
        FROM absensis a
        JOIN users u ON a.karyawan_id = u.karyawan_id
        WHERE u.id = ?
        ORDER BY a.waktu DESC
        LIMIT 50
    ");
        $stmt->execute([$user_id]);
        $history = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['data' => $history]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/attendance/break' && $method === 'POST') {
    $user_id = $_POST['user_id'] ?? null;
    $tipe = $_POST['tipe'] ?? null;
    $foto_base64 = $_POST['foto_base64'] ?? null;
    $latitude = $_POST['latitude'] ?? null;
    $longitude = $_POST['longitude'] ?? null;
    $detail_lokasi = $_POST['detail_lokasi'] ?? null;

    if (!$user_id || !$tipe || !$foto_base64) {
        http_response_code(400);
        echo json_encode(['message' => 'Data tidak lengkap']);
        exit();
    }

    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'root';
    $pass = '';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        // Save image
        $upload_dir = __DIR__ . '/../uploads/attendance/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        
        $image_parts = explode(";base64,", $foto_base64);
        if (count($image_parts) == 2) {
            $image_base64 = base64_decode($image_parts[1]);
            $filename = 'break_' . $user_id . '_' . time() . '.jpg';
            $file_path = $upload_dir . $filename;
            file_put_contents($file_path, $image_base64);
            $db_photo_path = 'uploads/attendance/' . $filename;
        } else {
            $db_photo_path = null;
        }

        // Get karyawan_id and nik
        $stmtUser = $pdo->prepare("SELECT u.karyawan_id, k.nik FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE u.id = ?");
        $stmtUser->execute([$user_id]);
        $userData = $stmtUser->fetch();
        if (!$userData) {
            http_response_code(404);
            echo json_encode(['message' => 'User tidak ditemukan']);
            exit();
        }
        $karyawan_id = $userData['karyawan_id'];
        $nik = $userData['nik'] ?? '-'; // Fallback if missing

        // Insert into absensis
        $stmt = $pdo->prepare("INSERT INTO absensis (karyawan_id, nik, waktu, tipe, status, foto, latitude, longitude, detail_lokasi) VALUES (?, ?, NOW(), ?, 'Selesai', ?, ?, ?, ?)");
        $stmt->execute([$karyawan_id, $nik, $tipe, $db_photo_path, $latitude, $longitude, $detail_lokasi]);

        http_response_code(200);
        echo json_encode(['message' => 'Absensi berhasil']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

http_response_code(404);
echo json_encode(['message' => 'Endpoint tidak ditemukan']);
