<?php

$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

try {
    $columnExists = $pdo->prepare("\n        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'permohonan_amprahans'
          AND COLUMN_NAME = 'jenis_amprahan'
    ");
    $columnExists->execute();
    if ((int) $columnExists->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE permohonan_amprahans ADD COLUMN jenis_amprahan VARCHAR(30) NULL AFTER user_id");
    }
    $mobilColumnExists = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM INFORMATION_SCHEMA.COLUMNS\n        WHERE TABLE_SCHEMA = DATABASE()\n          AND TABLE_NAME = 'permohonan_amprahans'\n          AND COLUMN_NAME = 'mobil_id'\n    ");
    $mobilColumnExists->execute();
    if ((int) $mobilColumnExists->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE permohonan_amprahans ADD COLUMN mobil_id BIGINT UNSIGNED NULL AFTER kapal_id");
    }
    $pdo->exec("ALTER TABLE permohonan_amprahans MODIFY kapal_id BIGINT UNSIGNED NULL");
    $pdo->exec("ALTER TABLE permohonan_amprahans MODIFY nomor_voyage VARCHAR(255) NULL");
    echo "Migrasi amprahan berhasil: kategori ditambahkan dan voyage tetap opsional.\n";
} catch (PDOException $e) {
    http_response_code(500);
    echo "Migrasi gagal: " . $e->getMessage() . "\n";
}
