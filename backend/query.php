<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';
$pdo = Database::getConnection();
try {
    $pdo->exec("ALTER TABLE permohonan_amprahans ADD COLUMN tanggal_diterima TIMESTAMP NULL DEFAULT NULL AFTER status;");
    echo "Column added.";
} catch (Exception $e) {
    echo $e->getMessage();
}
