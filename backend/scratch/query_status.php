<?php
$_SERVER['SERVER_NAME']='localhost';
require 'config/database.php';
$pdo = Database::getConnection();
print_r($pdo->query("SELECT status FROM persetujuan_absensi_lemburs LIMIT 5")->fetchAll(PDO::FETCH_ASSOC));
