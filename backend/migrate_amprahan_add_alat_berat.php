<?php

require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

$columnStmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'permohonan_amprahans'
      AND COLUMN_NAME = 'alat_berat_id'
");
$columnStmt->execute();

if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec("ALTER TABLE permohonan_amprahans ADD COLUMN alat_berat_id BIGINT UNSIGNED NULL AFTER mobil_id");
    echo "Kolom alat_berat_id berhasil ditambahkan.\n";
} else {
    echo "Kolom alat_berat_id sudah tersedia.\n";
}
