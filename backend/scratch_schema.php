<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '');
$stmt = $pdo->query('SHOW COLUMNS FROM karyawan_tidak_tetaps');
if ($stmt) print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
