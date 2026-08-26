<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';
$pdo = Database::getConnection();

$stmt = $pdo->query("SELECT u.id FROM users u LEFT JOIN karyawans k ON u.karyawan_id = k.id WHERE k.pekerjaan = 'HRD' LIMIT 1");
$hrd = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$hrd) die("No HRD found");

$data = array(
    'id' => 12,
    'tipe' => 'Lembur',
    'status' => 'Disetujui',
    'user_id' => $hrd['id'],
    'jam_mulai' => '17:00',
    'jam_selesai' => '22:00'
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'PUT',
        'content' => json_encode($data)
    )
);
$context  = stream_context_create($options);
$result = file_get_contents('http://localhost:8000/api/hrd/permohonan/status', false, $context);
var_dump($result);

$stmt2 = $pdo->query("SELECT * FROM persetujuan_absensi_lemburs WHERE id = 12");
print_r($stmt2->fetch(PDO::FETCH_ASSOC));
