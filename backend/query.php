<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$stmt = $pdo->query("DESCRIBE master_nama_barang_amprahans");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

$stmt = $pdo->query("DESCRIBE stock_amprahan_usages");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

$stmt = $pdo->query("DESCRIBE belanja_amprahans");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
