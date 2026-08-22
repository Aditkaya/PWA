<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'face_verified_at'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN face_verified_at DATETIME NULL DEFAULT NULL");
        echo "Column 'face_verified_at' added successfully.\n";
    } else {
        echo "Column 'face_verified_at' already exists.\n";
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'face_photo_path'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN face_photo_path VARCHAR(255) NULL DEFAULT NULL");
        echo "Column 'face_photo_path' added successfully.\n";
    } else {
        echo "Column 'face_photo_path' already exists.\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
