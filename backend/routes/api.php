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
    
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        // Combine data from users and karyawans
        $stmt = $pdo->prepare("
            SELECT u.id as user_id, u.username, k.*, k.id as karyawan_id 
            FROM users u 
            LEFT JOIN karyawans k ON u.karyawan_id = k.id 
            WHERE u.id = ?
        ");
        $stmt->execute([$user_id]);
        $profile = $stmt->fetch();
        
        if ($profile) {
            // Setup avatar url
            $avatar_path = "/uploads/avatars/avatar_{$user_id}.jpg";
            if (file_exists(__DIR__ . '/..' . $avatar_path)) {
                $profile['avatar_url'] = 'http://localhost:8000' . $avatar_path . '?v=' . time();
            } else {
                $profile['avatar_url'] = null;
            }

            // Check full day leave
            $profile['has_full_day_leave'] = false;
            if ($profile['karyawan_id']) {
                $today = date('Y-m-d');
                $stmtLeave = $pdo->prepare("SELECT id FROM permohonan_izins WHERE karyawan_id = ? AND jenis_izin = 'Tidak Masuk' AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
                $stmtLeave->execute([$profile['karyawan_id'], $today]);
                if ($stmtLeave->fetch()) {
                    $profile['has_full_day_leave'] = true;
                }
            }
            
            // To ensure compatibility with frontend components that expect 'id' to be user_id or karyawan_id,
            // we will explicitly return id as user_id to fix IzinModal passing wrong user_id
            $profile['id'] = $profile['user_id'];

            http_response_code(200);
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



if ($uri === '/api/izin' && $method === 'POST') {
    $karyawan_id = !empty($_POST['karyawan_id']) ? $_POST['karyawan_id'] : null;
    $nik = !empty($_POST['nik']) ? $_POST['nik'] : '-';
    $nama = !empty($_POST['nama']) ? $_POST['nama'] : 'Tanpa Nama';
    $divisi = !empty($_POST['divisi']) ? $_POST['divisi'] : '-';
    $jenis_izin = $_POST['jenis_izin'] ?? null;
    $tanggal_mulai = $_POST['tanggal_mulai'] ?? null;
    $tanggal_selesai = $_POST['tanggal_selesai'] ?? null;
    $waktu = !empty($_POST['waktu']) ? $_POST['waktu'] : null;
    $alasan = $_POST['alasan'] ?? '';

    if (!$jenis_izin || !$tanggal_mulai) {
        http_response_code(400);
        echo json_encode(['message' => 'Data jenis izin dan tanggal mulai harus diisi']);
        exit();
    }

    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $user_id = $_POST['user_id'] ?? null;
        if (!$karyawan_id && $user_id) {
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if ($userData && $userData['karyawan_id']) {
                $karyawan_id = $userData['karyawan_id'];
            }
        }

        $lampiran_path = null;
        if (isset($_FILES['lampiran']) && $_FILES['lampiran']['error'] === UPLOAD_ERR_OK) {
            $upload_dir = __DIR__ . '/../uploads/surat_sakit/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            $file = $_FILES['lampiran'];
            if ($file['size'] <= 5242880) {
                $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
                $filename = 'surat_sakit_' . $karyawan_id . '_' . time() . '.' . $ext;
                if (move_uploaded_file($file['tmp_name'], $upload_dir . $filename)) {
                    $lampiran_path = 'uploads/surat_sakit/' . $filename;
                }
            }
        }

        $stmt = $pdo->prepare("INSERT INTO permohonan_izins (karyawan_id, nik, nama, divisi, jenis_izin, tanggal_mulai, tanggal_selesai, waktu, alasan, lampiran, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())");
        $stmt->execute([$karyawan_id, $nik, $nama, $divisi, $jenis_izin, $tanggal_mulai, $tanggal_selesai, $waktu, $alasan, $lampiran_path]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Permohonan izin berhasil diajukan']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/cuti' && $method === 'POST') {
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $karyawan_id = !empty($_POST['karyawan_id']) ? $_POST['karyawan_id'] : null;
        $user_id = $_POST['user_id'] ?? null;
        if (!$karyawan_id && $user_id) {
            $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmtUser->execute([$user_id]);
            $userData = $stmtUser->fetch();
            if ($userData && $userData['karyawan_id']) {
                $karyawan_id = $userData['karyawan_id'];
            }
        }
        $tanggal_mulai = $_POST['tanggal_mulai'] ?? '';
        $tanggal_selesai = $_POST['tanggal_selesai'] ?? '';
        $jenis_cuti = $_POST['jenis_cuti'] ?? '';
        $keterangan = $_POST['keterangan'] ?? '';

        if (empty($tanggal_mulai) || empty($tanggal_selesai) || empty($jenis_cuti) || empty($keterangan)) {
            http_response_code(400);
            echo json_encode(['message' => 'Lengkapi semua field tanggal, jenis, dan keterangan!']);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO cutis (karyawan_id, tanggal_mulai, tanggal_selesai, jenis_cuti, keterangan, status, created_at, updated_at) 
            VALUES (:karyawan_id, :tanggal_mulai, :tanggal_selesai, :jenis_cuti, :keterangan, 'Pending', NOW(), NOW())
        ");
        $stmt->execute([
            'karyawan_id' => $karyawan_id,
            'tanggal_mulai' => $tanggal_mulai,
            'tanggal_selesai' => $tanggal_selesai,
            'jenis_cuti' => $jenis_cuti,
            'keterangan' => $keterangan
        ]);

        echo json_encode(['message' => 'Success']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/permohonan' && $method === 'GET') {
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID diperlukan']);
        exit();
    }
    
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
        $stmtUser->execute([$user_id]);
        $userData = $stmtUser->fetch();
        $karyawan_id = $userData ? $userData['karyawan_id'] : null;

        if (!$karyawan_id) {
            echo json_encode(['data' => []]);
            exit;
        }

        $stmtIzin = $pdo->prepare("SELECT id, 'Izin' as tipe, jenis_izin as jenis, tanggal_mulai, tanggal_selesai, alasan as keterangan, status, created_at FROM permohonan_izins WHERE karyawan_id = ? ORDER BY created_at DESC");
        $stmtIzin->execute([$karyawan_id]);
        $izin = $stmtIzin->fetchAll();

        $stmtCuti = $pdo->prepare("SELECT id, 'Cuti' as tipe, jenis_cuti as jenis, tanggal_mulai, tanggal_selesai, keterangan, status, created_at FROM cutis WHERE karyawan_id = ? ORDER BY created_at DESC");
        $stmtCuti->execute([$karyawan_id]);
        $cuti = $stmtCuti->fetchAll();

        $stmtLupa = $pdo->prepare("SELECT id, 'Lupa Absen' as tipe, tipe_absen as jenis, tanggal as tanggal_mulai, tanggal as tanggal_selesai, alasan as keterangan, status, created_at FROM persetujuan_absensi_lupas WHERE karyawan_id = ? ORDER BY created_at DESC");
        $stmtLupa->execute([$karyawan_id]);
        $lupa = $stmtLupa->fetchAll();

        $stmtLembur = $pdo->prepare("SELECT id, 'Lembur' as tipe, 'Pengajuan Lembur' as jenis, tanggal as tanggal_mulai, tanggal as tanggal_selesai, keterangan, status, created_at FROM persetujuan_absensi_lemburs WHERE karyawan_id = ? ORDER BY created_at DESC");
        $stmtLembur->execute([$karyawan_id]);
        $lembur = $stmtLembur->fetchAll();

        $allData = array_merge($izin, $cuti, $lupa, $lembur);
        usort($allData, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        echo json_encode(['data' => $allData]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/lokasi' && $method === 'GET') {
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
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
    
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
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
        SELECT a.id, DATE(a.waktu) as date, a.tipe as type, TIME_FORMAT(a.waktu, '%H:%i') as time, IFNULL(a.status, 'Selesai') as status, a.foto, a.detail_lokasi as location, a.latitude as lat, a.longitude as lng, a.keterangan
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
    $keterangan = $_POST['keterangan'] ?? null;

    if (!$user_id || !$tipe) {
        http_response_code(400);
        echo json_encode(['message' => 'Data user_id dan tipe diperlukan']);
        exit();
    }

    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
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
        
        if ($foto_base64) {
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
        $stmt = $pdo->prepare("INSERT INTO absensis (karyawan_id, nik, waktu, tipe, status, foto, latitude, longitude, detail_lokasi, keterangan) VALUES (?, ?, NOW(), ?, 'Selesai', ?, ?, ?, ?, ?)");
        $stmt->execute([$karyawan_id, $nik, $tipe, $db_photo_path, $latitude, $longitude, $detail_lokasi, $keterangan]);

        http_response_code(200);
        echo json_encode(['message' => 'Absensi berhasil']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/attendance/lupa' && $method === 'POST') {
    $user_id = $_POST['user_id'] ?? null;
    $tanggal = $_POST['tanggal'] ?? null;
    $tipe_absen = $_POST['tipe_absen'] ?? null;
    $waktu = $_POST['waktu'] ?? null;
    $alasan = $_POST['alasan'] ?? null;

    if ($user_id === null || $user_id === '' || 
        $tanggal === null || $tanggal === '' || 
        $tipe_absen === null || $tipe_absen === '' || 
        $waktu === null || $waktu === '' || 
        $alasan === null || $alasan === '') {
        http_response_code(400);
        echo json_encode(['message' => 'Lengkapi semua form! Data yang diterima: ' . json_encode($_POST)]);
        exit();
    }

    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
        $stmtUser->execute([$user_id]);
        $userData = $stmtUser->fetch();
        if (!$userData || !$userData['karyawan_id']) {
            http_response_code(404);
            echo json_encode(['message' => 'Karyawan tidak ditemukan']);
            exit();
        }
        $karyawan_id = $userData['karyawan_id'];

        $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lupas (karyawan_id, tanggal, tipe_absen, waktu, alasan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
        $stmt->execute([$karyawan_id, $tanggal, $tipe_absen, $waktu, $alasan]);

        http_response_code(200);
        echo json_encode(['message' => 'Pengajuan Lupa Absen berhasil dikirim']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/attendance/lembur' && $method === 'POST') {
    $user_id = $_POST['user_id'] ?? null;
    $tanggal = $_POST['tanggal'] ?? null;
    $jam_mulai = $_POST['jam_mulai'] ?? null;
    $jam_selesai = $_POST['jam_selesai'] ?? null;
    $keterangan = $_POST['keterangan'] ?? null;
    $foto_base64 = $_POST['foto_base64'] ?? null;
    $latitude = $_POST['latitude'] ?? null;
    $longitude = $_POST['longitude'] ?? null;
    $detail_lokasi = $_POST['detail_lokasi'] ?? null;

    if ($user_id === null || $user_id === '' || 
        $tanggal === null || $tanggal === '' || 
        $jam_mulai === null || $jam_mulai === '' || 
        $jam_selesai === null || $jam_selesai === '' || 
        $keterangan === null || $keterangan === '') {
        http_response_code(400);
        echo json_encode(['message' => 'Lengkapi semua form! Data yang diterima: ' . json_encode($_POST)]);
        exit();
    }

    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        $stmtUser = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
        $stmtUser->execute([$user_id]);
        $userData = $stmtUser->fetch();
        if (!$userData || !$userData['karyawan_id']) {
            http_response_code(404);
            echo json_encode(['message' => 'Karyawan tidak ditemukan']);
            exit();
        }
        $karyawan_id = $userData['karyawan_id'];

        $db_photo_path = null;
        if ($foto_base64) {
            $upload_dir = __DIR__ . '/../uploads/attendance/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            $image_parts = explode(";base64,", $foto_base64);
            if (count($image_parts) == 2) {
                $image_base64 = base64_decode($image_parts[1]);
                $filename = 'lembur_' . $user_id . '_' . time() . '.jpg';
                $file_path = $upload_dir . $filename;
                file_put_contents($file_path, $image_base64);
                $db_photo_path = 'uploads/attendance/' . $filename;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO persetujuan_absensi_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, foto, detail_lokasi, latitude, longitude, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
        $stmt->execute([$karyawan_id, $tanggal, $jam_mulai, $jam_selesai, $keterangan, $db_photo_path, $detail_lokasi, $latitude, $longitude]);

        http_response_code(200);
        echo json_encode(['message' => 'Pengajuan Lembur berhasil dikirim']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($uri === '/api/health' && $method === 'GET') {
    $host = 'localhost';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $charset = 'utf8mb4';
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        // Test query
        $stmt = $pdo->query("SELECT 1");
        http_response_code(200);
        echo json_encode(['status' => 'connected', 'message' => 'Database connection successful']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Database connection failed: ' . $e->getMessage()]);
    }
    exit();
}

http_response_code(404);
echo json_encode(['message' => 'Endpoint tidak ditemukan']);
