<?php
require_once __DIR__ . '/../config/database.php';
$pdo = \Database::getConnection();
$rows = $pdo->query("SELECT id, judul, tipe, gambar FROM beritas WHERE is_active=1 ORDER BY id DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    echo "ID: {$r['id']} | Tipe: {$r['tipe']} | Gambar: {$r['gambar']} | Judul: {$r['judul']}\n";
}
