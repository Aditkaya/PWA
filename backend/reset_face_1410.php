<?php
$_SERVER["SERVER_NAME"] = "localhost";
require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
    
    // Find user by NIK
    $stmt = $pdo->prepare("SELECT u.id, k.nik, k.nama_lengkap FROM users u JOIN karyawans k ON u.id = k.user_id WHERE k.nik = '1410'");
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        $userId = $user['id'];
        
        // Delete the physical photo if exists
        $avatar_path = __DIR__ . "/uploads/face_verifications/face_{$userId}.jpg";
        if (file_exists($avatar_path)) {
            unlink($avatar_path);
            echo "File foto fisik terhapus.\n";
        }
        
        // Update database
        $updateStmt = $pdo->prepare("UPDATE users SET face_verified_at = NULL, face_photo_path = NULL WHERE id = ?");
        $updateStmt->execute([$userId]);
        
        echo "✅ SUKSES: Data verifikasi wajah untuk NIK 1410 (" . $user['nama_lengkap'] . ") berhasil dihapus dari server.\n";
    } else {
        echo "❌ GAGAL: Karyawan dengan NIK 1410 tidak ditemukan.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
