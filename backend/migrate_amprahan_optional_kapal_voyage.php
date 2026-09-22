<?php

$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

try {
    $pdo->exec("ALTER TABLE permohonan_amprahans MODIFY kapal_id BIGINT UNSIGNED NULL");
    $pdo->exec("ALTER TABLE permohonan_amprahans MODIFY nomor_voyage VARCHAR(255) NULL");
    echo "Migrasi amprahan berhasil: kapal_id dan nomor_voyage sekarang opsional.\n";
} catch (PDOException $e) {
    http_response_code(500);
    echo "Migrasi gagal: " . $e->getMessage() . "\n";
}
