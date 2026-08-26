<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();
$stmt = $pdo->query("SELECT DISTINCT tipe FROM absensis");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
