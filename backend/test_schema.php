<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '');
$stmt = $pdo->query('SHOW COLUMNS FROM users');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$stmt2 = $pdo->query('SHOW COLUMNS FROM karyawans');
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));
