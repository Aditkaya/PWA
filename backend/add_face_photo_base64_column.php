<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
    
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'face_photo_base64'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN face_photo_base64 LONGTEXT NULL DEFAULT NULL AFTER face_photo_path");
        echo "Column 'face_photo_base64' added successfully.\n";
    } else {
        echo "Column 'face_photo_base64' already exists.\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
