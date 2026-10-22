<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/app/Services/AssetReturnSchema.php';
try {
    \App\Services\AssetReturnSchema::ensure(Database::getConnection());
    echo "Tabel pengembalian_asset dan pengembalian_asset_items siap digunakan.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Gagal menyiapkan pengembalian asset: ' . $e->getMessage() . "\n");
    exit(1);
}
