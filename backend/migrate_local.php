<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_feature_permissions (
        id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id      BIGINT UNSIGNED NOT NULL,
        feature_key  VARCHAR(100) NOT NULL,
        is_enabled   TINYINT(1) NOT NULL DEFAULT 1,
        updated_by   BIGINT UNSIGNED NULL,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_feature (user_id, feature_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo 'Table OK' . PHP_EOL;

    $features = ['izin_sakit','izin_setengah_hari','cuti_tahunan','lupa_absen','perencanaan_lembur','approval_karyawan','stowage_plan','denah_gudang','amprahan'];
    $users = $pdo->query('SELECT id FROM users')->fetchAll(PDO::FETCH_COLUMN);
    $c = 0;
    foreach($users as $uid) {
        foreach($features as $f) {
            $s = $pdo->prepare('INSERT IGNORE INTO user_feature_permissions (user_id, feature_key, is_enabled) VALUES (?,?,1)');
            $s->execute([$uid, $f]);
            $c += $s->rowCount();
        }
    }
    echo 'Seeded ' . $c . ' rows for ' . count($users) . ' users' . PHP_EOL;
} catch(Exception $e) { echo 'Error: ' . $e->getMessage() . PHP_EOL; }
