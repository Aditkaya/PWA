<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();
$stmt = $pdo->query('DESCRIBE notifications');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
