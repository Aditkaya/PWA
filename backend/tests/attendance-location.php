<?php
// Invalid locations must be rejected before connecting to a database or saving photos.
require_once __DIR__ . '/../app/Http/Controllers/AttendanceController.php';
$valid = ['user_id' => 1, 'tipe' => 'Masuk', 'latitude' => -6.2, 'longitude' => 106.8, 'gps_accuracy' => 11, 'location_age_ms' => 0];
$cases = [
    ['gps_accuracy' => 2000], ['gps_accuracy' => null], ['gps_accuracy' => 0],
    ['gps_accuracy' => -1], ['gps_accuracy' => 'NaN'],
    ['location_age_ms' => 30001], ['location_age_ms' => -1], ['location_age_ms' => null],
    ['latitude' => 91], ['longitude' => 181], ['latitude' => null], ['longitude' => INF],
];
foreach ($cases as $case) {
    http_response_code(200);
    ob_start();
    (new \App\Http\Controllers\AttendanceController())->submitBreak(array_replace($valid, $case));
    $response = json_decode(ob_get_clean(), true);
    if (http_response_code() !== 422 || empty($response['message'])) {
        throw new RuntimeException('Invalid GPS data was not rejected');
    }
}
echo count($cases) . " location validation cases passed\n";
