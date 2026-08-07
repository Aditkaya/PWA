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
    
    $karyawan_id = 10;
    $nik = '';
    $nama = 'Sakti';
    $divisi = '';
    $jenis_izin = 'Sakit';
    $tanggal_mulai = '2026-08-07';
    $tanggal_selesai = '2026-08-08';
    $waktu = '';
    $alasan = 'Sakit';

    $stmt = $pdo->prepare("INSERT INTO permohonan_izins (karyawan_id, nik, nama, divisi, jenis_izin, tanggal_mulai, tanggal_selesai, waktu, alasan, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())");
    $stmt->execute([$karyawan_id, $nik, $nama, $divisi, $jenis_izin, $tanggal_mulai, $tanggal_selesai, $waktu, $alasan]);
    echo "Success";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
