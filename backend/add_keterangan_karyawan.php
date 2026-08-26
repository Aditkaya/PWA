<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require __DIR__ . '/config/database.php';
$pdo = Database::getConnection();

try {
    $stmtCols = $pdo->query("SHOW COLUMNS FROM persetujuan_absensi_lemburs LIKE 'keterangan_karyawan'");
    if (!$stmtCols->fetch()) {
        $pdo->exec("ALTER TABLE persetujuan_absensi_lemburs ADD COLUMN keterangan_karyawan TEXT NULL");
        echo "Added keterangan_karyawan to persetujuan_absensi_lemburs\n";
    } else {
        echo "Column keterangan_karyawan already exists.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
echo "Done.\n";
