<?php
require __DIR__ . '/../config/Database.php';
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
