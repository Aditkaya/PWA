<?php
namespace App\Services;

use PDO;

class AssetReturnSchema
{
    public static function ensure(PDO $pdo): void
    {
        $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        $id = $mysql ? 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $options = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
        $pdo->exec("CREATE TABLE IF NOT EXISTS pengembalian_asset (
            id $id, nomor_dokumen VARCHAR(60) NOT NULL UNIQUE,
            karyawan_id BIGINT NOT NULL, requested_by BIGINT NOT NULL,
            tanggal_pengembalian VARCHAR(10) NOT NULL, alasan VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'menunggu_admin',
            payload TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL
        )$options");
        $pdo->exec("CREATE TABLE IF NOT EXISTS pengembalian_asset_items (
            id $id, pengembalian_id BIGINT NOT NULL, tanda_terima_asset_id BIGINT NOT NULL,
            asset_id BIGINT NOT NULL, karyawan_id BIGINT NOT NULL, released_at TIMESTAMP NULL
        )$options");
        // Portable and idempotent index creation (MySQL does not support IF NOT EXISTS here).
        foreach ([
            ['pengembalian_asset', 'idx_pengembalian_karyawan', 'karyawan_id, id'],
            ['pengembalian_asset_items', 'idx_pengembalian_receipt', 'tanda_terima_asset_id, released_at'],
            ['pengembalian_asset_items', 'idx_pengembalian_asset', 'asset_id, released_at'],
            ['pengembalian_asset_items', 'idx_pengembalian_request', 'pengembalian_id'],
        ] as [$table, $index, $columns]) {
            if ($mysql) {
                $query = $pdo->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');
                $query->execute([$table, $index]);
                if (!$query->fetchColumn()) $pdo->exec("CREATE INDEX $index ON $table ($columns)");
            } else $pdo->exec("CREATE INDEX IF NOT EXISTS $index ON $table ($columns)");
        }
    }
}
