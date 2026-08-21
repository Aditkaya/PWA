<?php
$_SERVER['SERVER_NAME'] = 'production';
require __DIR__ . '/config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    $sql = "CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY(endpoint(191)),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    
    $conn->exec($sql);
    echo "Tabel push_subscriptions berhasil dibuat atau sudah ada.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
