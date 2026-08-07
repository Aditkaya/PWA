<?php
$host = '127.0.0.1';
$db   = 'aypsis';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, k.id as karyawan_id, k.nik, k.nama_lengkap, k.divisi, k.grup 
        FROM users u
        LEFT JOIN karyawans k ON u.karyawan_id = k.id
        WHERE u.id = ?
    ");
    $stmt->execute([331]);
    print_r($stmt->fetch(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo $e->getMessage();
}
