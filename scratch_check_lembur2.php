<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();
$stmt = $pdo->query("SELECT jam_mulai, jam_selesai FROM persetujuan_absensi_lemburs WHERE id = 12");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
