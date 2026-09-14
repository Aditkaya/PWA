<?php

require_once __DIR__ . '/../app/Http/Controllers/StowagePlanController.php';

use App\Http\Controllers\StowagePlanController;

$layout = [
    'bays' => ['01', '03', '05'],
    'rows' => ['00', '01', '02'],
    'tiers' => ['82', '84'],
    'disabled_slots' => ['030184'],
];

function check($condition, $message)
{
    if (!$condition) throw new RuntimeException($message);
}

check(StowagePlanController::coordinates(' 5,01,3,01, ') === ['01', '03', '05'], 'Coordinates must be normalized, unique and sorted.');
check(StowagePlanController::coordinates(null) === [], 'Missing layout must remain empty.');
check(StowagePlanController::footprint($layout, '01', '00', '82', '20') === ['010082'], '20 ft occupies one slot.');
check(StowagePlanController::footprint($layout, '01', '00', '82', '40 HC') === ['010082', '030082'], '40 ft occupies two consecutive configured bays.');

foreach ([
    ['05', '00', '82', '40'], // No second bay.
    ['03', '01', '84', '20'], // Disabled origin.
    ['01', '01', '84', '40'], // Disabled second bay.
    ['07', '00', '82', '20'], // Unknown bay.
    ['01', '03', '82', '20'], // Unknown row.
    ['01', '00', '86', '20'], // Unknown tier.
] as $position) {
    $rejected = false;
    try {
        StowagePlanController::footprint($layout, ...$position);
    } catch (InvalidArgumentException $e) {
        $rejected = true;
    }
    check($rejected, 'Invalid position should be rejected: ' . implode('/', $position));
}

echo "Stowage layout validation: 10 checks passed.\n";
