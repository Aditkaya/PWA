<?php
require __DIR__ . '/../config/Database.php';
$pdo = Database::getConnection();

$stmt = $pdo->query("SELECT id, judul, tipe, gambar FROM beritas ORDER BY id DESC LIMIT 10");
echo "Beritas (gambar field):\n";
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
