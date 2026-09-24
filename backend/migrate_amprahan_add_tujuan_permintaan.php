<?php

require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

$columnStmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'permohonan_amprahans'
      AND COLUMN_NAME = 'tujuan_permintaan'
");
$columnStmt->execute();

if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec("ALTER TABLE permohonan_amprahans ADD COLUMN tujuan_permintaan VARCHAR(255) NULL AFTER nomor_voyage");
    echo "Kolom tujuan_permintaan berhasil ditambahkan.\n";
} else {
    echo "Kolom tujuan_permintaan sudah tersedia.\n";
}
