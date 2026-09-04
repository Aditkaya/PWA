<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

$sql1 = "
CREATE TABLE IF NOT EXISTS permohonan_amprahans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    kapal_id BIGINT UNSIGNED NOT NULL,
    nomor_voyage VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    keterangan_umum TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

$sql2 = "
CREATE TABLE IF NOT EXISTS permohonan_amprahan_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    permohonan_id BIGINT UNSIGNED NOT NULL,
    nama_barang VARCHAR(255) NOT NULL,
    jumlah DECIMAL(10,2) NOT NULL,
    satuan VARCHAR(50) NOT NULL,
    keterangan TEXT NULL,
    FOREIGN KEY (permohonan_id) REFERENCES permohonan_amprahans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    $pdo->exec($sql1);
    echo "Table permohonan_amprahans created successfully.\n";
    $pdo->exec($sql2);
    echo "Table permohonan_amprahan_items created successfully.\n";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
