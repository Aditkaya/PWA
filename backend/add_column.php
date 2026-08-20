<?php
require 'config/database.php';
$_SERVER['SERVER_NAME'] = 'localhost'; // To mock local connection
$pdo = Database::getConnection();
try {
    $pdo->exec('ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMP NULL');
    echo 'success';
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo 'already exists';
    } else {
        echo $e->getMessage();
    }
}
