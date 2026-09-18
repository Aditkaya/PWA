<?php
/**
 * Migration: create_feature_permissions_table.php
 * Jalankan sekali: php create_feature_permissions_table.php
 */

require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

$defaultFeatures = [
    'izin_sakit',
    'izin_setengah_hari',
    'cuti_tahunan',
    'lupa_absen',
    'perencanaan_lembur',
    'approval_karyawan',
    'stowage_plan',
    'denah_gudang',
    'amprahan',
];

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_feature_permissions (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      INT NOT NULL,
            feature_key  VARCHAR(100) NOT NULL,
            is_enabled   TINYINT(1) NOT NULL DEFAULT 1,
            updated_by   INT NULL,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_feature (user_id, feature_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo 'Tabel user_feature_permissions berhasil dibuat.' . PHP_EOL;

    $stmtUsers = $pdo->query("SELECT id FROM users");
    $users = $stmtUsers->fetchAll(PDO::FETCH_COLUMN);

    $inserted = 0;
    foreach ($users as $userId) {
        foreach ($defaultFeatures as $featureKey) {
            $stmt = $pdo->prepare("INSERT IGNORE INTO user_feature_permissions (user_id, feature_key, is_enabled) VALUES (?, ?, 1)");
            $stmt->execute([$userId, $featureKey]);
            $inserted += $stmt->rowCount();
        }
    }

    echo 'Seed selesai: ' . $inserted . ' baris untuk ' . count($users) . ' user.' . PHP_EOL;
    echo 'Migrasi selesai!' . PHP_EOL;

} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . PHP_EOL;
}
