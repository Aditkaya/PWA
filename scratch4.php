<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();

// Cari user Aditya
$stmt = $pdo->query("SELECT id, nama_lengkap, nik FROM karyawans WHERE nama_lengkap LIKE '%ADITYA%'");
$adityas = $stmt->fetchAll(PDO::FETCH_ASSOC);

print_r($adityas);
