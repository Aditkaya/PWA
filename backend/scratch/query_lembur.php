<?php
$_SERVER['SERVER_NAME']='localhost';
require_once dirname(__DIR__) . '/config/database.php';
$pdo = Database::getConnection();
echo "== PERSETUJUAN ABSENSI LEMBURS ==\n";
print_r($pdo->query('SHOW COLUMNS FROM persetujuan_absensi_lemburs')->fetchAll(PDO::FETCH_ASSOC));
echo "== PERENCANAAN LEMBURS ==\n";
print_r($pdo->query('SHOW COLUMNS FROM perencanaan_lemburs')->fetchAll(PDO::FETCH_ASSOC));
