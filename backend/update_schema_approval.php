<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

$tables = [
    'permohonan_izins',
    'cutis',
    'persetujuan_absensi_lupas',
    'persetujuan_absensi_lemburs'
];

foreach ($tables as $table) {
    try {
        // Check if columns exist
        $stmtCols = $pdo->query("SHOW COLUMNS FROM $table LIKE 'approved_by_spv'");
        if (!$stmtCols->fetch()) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN approved_by_spv BIGINT UNSIGNED NULL");
            echo "Added approved_by_spv to $table\n";
        }
        
        $stmtCols2 = $pdo->query("SHOW COLUMNS FROM $table LIKE 'approved_by_hrd'");
        if (!$stmtCols2->fetch()) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN approved_by_hrd BIGINT UNSIGNED NULL");
            echo "Added approved_by_hrd to $table\n";
        }

        // Change any existing 'Pending' to 'Pending HRD' to avoid breaking existing pending items
        $pdo->exec("UPDATE $table SET status = 'Pending HRD' WHERE status = 'Pending' OR status = 'PENDING'");
        echo "Updated existing Pending status to Pending HRD in $table\n";

    } catch (Exception $e) {
        echo "Error on $table: " . $e->getMessage() . "\n";
    }
}

echo "Done.\n";
