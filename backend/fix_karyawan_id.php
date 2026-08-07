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
    $pdo->query("UPDATE permohonan_izins SET karyawan_id = 1752 WHERE nik = '1593' AND karyawan_id IS NULL");
    echo "Fixed";
} catch (Exception $e) {
    echo $e->getMessage();
}
