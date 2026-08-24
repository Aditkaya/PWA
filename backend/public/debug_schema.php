<?php
require __DIR__ . '/../config/Database.php';
$pdo = Database::getConnection();
$stmt = $pdo->query("DESCRIBE karyawans");
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
