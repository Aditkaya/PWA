<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=aypsis;charset=utf8mb4', 'root', '');
$q = 'adit';
$like = "%$q%";
$limit = 10;

$stmt = $pdo->prepare("
    SELECT
        k.id,
        k.nik,
        k.nama_lengkap,
        k.status,
        k.user_id             AS karyawan_user_id,
        u.id                  AS user_id_from_users,
        u.username,
        u.is_approved
    FROM karyawans k
    LEFT JOIN users u ON u.karyawan_id = k.id
    WHERE (k.status = 'aktif' OR k.status = 'active')
      AND (k.nama_lengkap LIKE ? OR k.nik LIKE ?)
    ORDER BY k.nama_lengkap ASC
    LIMIT $limit
");
$stmt->execute([$like, $like]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $r) {
    $hasAccount = !empty($r['user_id_from_users']) || !empty($r['karyawan_user_id']);
    echo json_encode([
        'id'          => (int) $r['id'],
        'nik'         => $r['nik'],
        'nama_lengkap'=> $r['nama_lengkap'],
        'has_account' => $hasAccount,
        'username'    => $r['username'],
    ]) . "\n";
}
