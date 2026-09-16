<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '');

// Sample karyawans with user info
$stmt = $pdo->query("
    SELECT k.id, k.nik, k.nama_lengkap, k.status, k.user_id, u.username, u.is_approved
    FROM karyawans k
    LEFT JOIN users u ON u.id = k.user_id
    LIMIT 10
");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . "\n";
}
