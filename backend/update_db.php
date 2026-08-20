<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require __DIR__ . '/config/database.php';
$db = new Database();
$conn = $db->getConnection();

echo "Memperbarui database...\n";

// Tambah kolom ke permohonan_izins
try {
    $conn->exec("ALTER TABLE permohonan_izins ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER status");
    echo "[OK] Kolom 'approved_by' berhasil ditambahkan ke tabel 'permohonan_izins'.\n";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "[INFO] Kolom 'approved_by' sudah ada di tabel 'permohonan_izins'.\n";
    } else {
        echo "[ERROR] permohonan_izins: " . $e->getMessage() . "\n";
    }
}

// Tambah kolom ke cutis
try {
    $conn->exec("ALTER TABLE cutis ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER status");
    echo "[OK] Kolom 'approved_by' berhasil ditambahkan ke tabel 'cutis'.\n";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "[INFO] Kolom 'approved_by' sudah ada di tabel 'cutis'.\n";
    } else {
        echo "[ERROR] cutis: " . $e->getMessage() . "\n";
    }
}

echo "\nUpdate selesai!\n";
