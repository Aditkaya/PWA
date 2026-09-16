<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '');

// Cek semua user yang baru dibuat via register
$stmt = $pdo->query("
    SELECT id, username, is_approved, status, role, karyawan_id, created_at
    FROM users
    WHERE status = 'pending' OR is_approved IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
");

foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . "\n";
}
