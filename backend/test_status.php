<?php
require 'config/database.php';
$pdo = Database::getConnection();
$stmt = $pdo->query("SELECT DISTINCT status FROM absensis");
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
