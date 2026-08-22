<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();

// Check if any karyawans have nik_supervisor or supervisor set
$stmt = $pdo->query("SELECT id, nama_lengkap, nik, nik_supervisor, supervisor FROM karyawans WHERE nik_supervisor != '' OR supervisor != ''");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Bawahan:\n";
print_r($rows);

// Now check if there are any karyawans whose NIK or nama_lengkap match the nik_supervisor or supervisor of ANY other karyawan
$stmt = $pdo->query("SELECT id, nama_lengkap, nik FROM karyawans WHERE nik IN (SELECT nik_supervisor FROM karyawans WHERE nik_supervisor != '') OR nama_lengkap IN (SELECT supervisor FROM karyawans WHERE supervisor != '')");
$supervisors = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "\nSupervisors found in karyawans table:\n";
print_r($supervisors);
