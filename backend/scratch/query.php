<?php
require_once dirname(__DIR__) . '/config/database.php';
$_SERVER['SERVER_NAME']='localhost';
$pdo = Database::getConnection();
$stmt = $pdo->query("SELECT * FROM absensis WHERE DATE(waktu) = '2026-08-24'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$stmt2 = $pdo->query("SELECT * FROM persetujuan_absensi_lemburs WHERE tanggal = '2026-08-24'");
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));
$stmt3 = $pdo->query("SELECT * FROM perencanaan_lemburs WHERE tanggal = '2026-08-24'");
print_r($stmt3->fetchAll(PDO::FETCH_ASSOC));
