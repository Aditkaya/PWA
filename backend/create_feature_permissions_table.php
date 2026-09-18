<?php
/**
 * Migration: create_feature_permissions_table.php
 * Jalankan di server: php create_feature_permissions_table.php
 */

require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
} catch (Exception $e) {
    // Fallback direct PDO connection for server CLI
    $host = '127.0.0.1';
    $db   = 'aypsis';
    $user = 'aypsis_web';
    $pass = 'WebPass2025#!';
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

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
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id      BIGINT UNSIGNED NOT NULL,
            feature_key  VARCHAR(100) NOT NULL,
            is_enabled   TINYINT(1) NOT NULL DEFAULT 1,
            updated_by   BIGINT UNSIGNED NULL,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_feature (user_id, feature_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "Tabel user_feature_permissions berhasil dibuat.\n";

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

    echo "Seed selesai: {$inserted} baris untuk " . count($users) . " user.\n";
    echo "Migrasi sukses!\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
