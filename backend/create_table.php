<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
    
    $sql = "CREATE TABLE IF NOT EXISTS `perencanaan_lemburs` (
        `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        `karyawan_id` bigint(20) unsigned NOT NULL,
        `tanggal` date NOT NULL,
        `jam_mulai` varchar(10) DEFAULT NULL,
        `jam_selesai` varchar(10) DEFAULT NULL,
        `keterangan` text DEFAULT NULL,
        `created_by` bigint(20) unsigned DEFAULT NULL,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    
    $pdo->exec($sql);
    echo "Table perencanaan_lemburs created successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
