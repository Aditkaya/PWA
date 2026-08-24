<?php
$_SERVER['SERVER_NAME']='localhost';
require 'config/database.php';
$pdo = Database::getConnection();
echo json_encode($pdo->query("SELECT id, waktu, tipe, keterangan FROM absensis ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
