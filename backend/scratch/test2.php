<?php
$pdo = new PDO('mysql:host=localhost;dbname=aypsis;charset=utf8mb4', 'root', '');
$stmt = $pdo->query('SELECT id, waktu, tipe, status FROM absensis WHERE tipe LIKE "%Lembur%" ORDER BY waktu DESC LIMIT 10');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
