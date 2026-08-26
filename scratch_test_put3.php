<?php
$_SERVER['SERVER_NAME'] = 'localhost';
require 'backend/config/database.php';

require_once 'backend/app/Http/Controllers/ApprovalController.php';
$controller = new \App\Http\Controllers\ApprovalController();
$controller->updateStatus([
    'id' => 12,
    'tipe' => 'Lembur',
    'status' => 'Disetujui',
    'user_id' => 135,
    'jam_mulai' => '17:00',
    'jam_selesai' => '22:00'
]);
