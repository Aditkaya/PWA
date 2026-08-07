<?php
$pdo = new PDO("mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4", "root", "");
$stmt = $pdo->query("SHOW COLUMNS FROM permohonan_izins");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
