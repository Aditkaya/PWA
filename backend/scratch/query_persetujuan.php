<?php
$_SERVER['SERVER_NAME']='localhost';
require 'config/database.php';
$pdo = Database::getConnection();
echo json_encode($pdo->query("SELECT * FROM persetujuan_absensi_lemburs WHERE tanggal = '2026-08-24'")->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
