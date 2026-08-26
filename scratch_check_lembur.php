<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();

$stmt = $pdo->query("SELECT * FROM persetujuan_absensi_lemburs ORDER BY id DESC LIMIT 1");
$record = $stmt->fetch(PDO::FETCH_ASSOC);

print_r($record);
