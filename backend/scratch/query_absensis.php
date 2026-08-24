<?php
$_SERVER['SERVER_NAME']='localhost';
require 'config/database.php';
$pdo = Database::getConnection();
print_r($pdo->query("SELECT * FROM absensis ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC));
print_r($pdo->query("SELECT * FROM persetujuan_absensi_lemburs ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC));
print_r($pdo->query("SELECT * FROM perencanaan_lemburs ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC));
