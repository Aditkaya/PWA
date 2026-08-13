<?php
$pdo = new PDO('mysql:host=localhost;dbname=aypsis;charset=utf8mb4', 'root', '');
$stmt = $pdo->query('SELECT id, waktu, tipe, status FROM absensis ORDER BY waktu DESC LIMIT 10');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$stmt2 = $pdo->query('SELECT id, tanggal, jam_mulai, status FROM persetujuan_absensi_lemburs ORDER BY created_at DESC LIMIT 5');
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));
