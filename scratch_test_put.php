<?php
$data = array(
    'id' => 12, // The ID of the lembur from scratch_check_lembur.php
    'tipe' => 'Lembur',
    'status' => 'Disetujui',
    'user_id' => 1, // Suppose user 1 is HRD
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
if ($result === FALSE) { /* Handle error */ }

var_dump($result);
