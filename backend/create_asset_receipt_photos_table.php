<?php
// Run once on each environment: php backend/create_asset_receipt_photos_table.php
require_once __DIR__ . '/config/database.php';
try {
    $pdo = Database::getConnection();
    $column = $pdo->query("SHOW COLUMNS FROM tanda_terima_asset LIKE 'foto'")->fetch();
    if (!$column) $pdo->exec('ALTER TABLE tanda_terima_asset ADD COLUMN foto VARCHAR(255) NULL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS tanda_terima_asset_fotos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tanda_terima_asset_id BIGINT UNSIGNED NOT NULL,
        karyawan_id BIGINT UNSIGNED NOT NULL,
        nik_pemegang VARCHAR(255) NOT NULL,
        nama_pemegang VARCHAR(255) NOT NULL,
        uploaded_by BIGINT UNSIGNED NOT NULL,
        file_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_asset_receipt_holder (tanda_terima_asset_id, karyawan_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    echo "Kolom tanda_terima_asset.foto dan tabel riwayat foto siap digunakan.\n";
} catch (Throwable $e) {
    fwrite(STDERR, "Gagal menyiapkan tabel foto asset: " . $e->getMessage() . "\n");
    exit(1);
}
