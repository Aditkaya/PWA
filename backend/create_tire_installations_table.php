<?php
/**
 * Migration: create_tire_installations_table.php
 * Membuat tabel penyimpanan pemasangan ban pada roda kendaraan & alat berat (3D Studio & Blueprint)
 */

require_once __DIR__ . '/config/database.php';

$_SERVER['SERVER_NAME'] = 'localhost';
$pdo = Database::getConnection();

try {
    echo "Memulai migrasi tabel tire_wheel_installations...\n";

    // 1. Tabel Utama: Penyimpanan Posisi Ban Terpasang per Roda Unit
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tire_wheel_installations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            mobil_id BIGINT UNSIGNED NULL,
            alat_berat_id BIGINT UNSIGNED NULL,
            category VARCHAR(50) NULL,
            wheel_id VARCHAR(50) NOT NULL,
            wheel_code VARCHAR(50) NULL,
            wheel_name VARCHAR(150) NULL,
            stock_ban_id BIGINT UNSIGNED NOT NULL,
            nomor_seri VARCHAR(100) NULL,
            merk VARCHAR(100) NULL,
            ukuran VARCHAR(100) NULL,
            kondisi VARCHAR(50) NULL,
            is_borrowed TINYINT(1) NOT NULL DEFAULT 0,
            donor_unit_id BIGINT UNSIGNED NULL,
            donor_unit_name VARCHAR(150) NULL,
            donor_category VARCHAR(50) NULL,
            borrowed_at DATETIME NULL,
            installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_twi_mobil (mobil_id),
            INDEX idx_twi_alat (alat_berat_id),
            INDEX idx_twi_stock_ban (stock_ban_id),
            INDEX idx_twi_wheel (wheel_id),
            UNIQUE KEY uq_twi_mobil_wheel (mobil_id, wheel_id),
            UNIQUE KEY uq_twi_alat_wheel (alat_berat_id, wheel_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "✓ Tabel 'tire_wheel_installations' berhasil dibuat/siap.\n";

    // 2. Tabel Audit Log & Riwayat Bongkar-Pasang Ban
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tire_installation_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            mobil_id BIGINT UNSIGNED NULL,
            alat_berat_id BIGINT UNSIGNED NULL,
            category VARCHAR(50) NULL,
            wheel_id VARCHAR(50) NOT NULL,
            wheel_code VARCHAR(50) NULL,
            stock_ban_id BIGINT UNSIGNED NOT NULL,
            nomor_seri VARCHAR(100) NULL,
            action ENUM('pasang', 'copot', 'tukar', 'kembalikan_pinjaman', 'lepas_semua') NOT NULL,
            is_borrowed TINYINT(1) NOT NULL DEFAULT 0,
            donor_unit_id BIGINT UNSIGNED NULL,
            donor_unit_name VARCHAR(150) NULL,
            notes TEXT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_til_mobil (mobil_id),
            INDEX idx_til_alat (alat_berat_id),
            INDEX idx_til_stock_ban (stock_ban_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "✓ Tabel 'tire_installation_logs' berhasil dibuat/siap.\n";

    echo "\n=== Migrasi Database Selesai dengan Sukses! ===\n";

} catch (Exception $e) {
    echo "Error migrasi: " . $e->getMessage() . "\n";
    exit(1);
}
