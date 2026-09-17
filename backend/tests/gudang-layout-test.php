<?php
require_once __DIR__.'/../app/Services/GudangLayout.php';
use App\Services\GudangLayout;

$layout = ['blocks' => [['code' => 'A', 'bays' => 4, 'rows' => 2, 'tiers' => 3, 'disabled' => []]]];
$position = ['block' => 'A', 'bay' => 3, 'row' => 1, 'tier' => 1, 'span' => 2, 'container_number' => 'TEST1234567'];
$count = 0;
function check($name, $layout, $positions, $valid) {
    global $count;
    try {
        GudangLayout::validate($layout, $positions);
        if (!$valid) throw new RuntimeException($name.' unexpectedly accepted');
    } catch (InvalidArgumentException $e) {
        if ($valid) throw new RuntimeException($name.': '.$e->getMessage());
    }
    $count++;
}
check('Valid 40-foot footprint', $layout, [$position], true);
$changed = $layout; $changed['blocks'][0]['bays'] = 3;
check('Shrink clips second slot', $changed, [$position], false);
$changed = $layout; $changed['blocks'][0]['disabled'] = [['bay' => 4, 'row' => 1]];
check('Block second slot of 40-foot container', $changed, [$position], false);
$changed = $layout; $changed['blocks'][0]['code'] = 'B';
check('Rename occupied area', $changed, [$position], false);
$changed = $layout; $changed['blocks'][] = $changed['blocks'][0];
check('Duplicate area', $changed, [], false);
$changed = $layout; $changed['blocks'][0]['disabled'] = [['bay' => 5, 'row' => 1]];
check('Disabled cell out of bounds', $changed, [], false);
$changed = $layout; $changed['blocks'][0]['tiers'] = 7;
check('Tier limit', $changed, [], false);
$changed = $layout; $changed['blocks'] = [];
check('Empty layout', $changed, [], false);
$changed = $layout; $changed['blocks'][0]['bays'] = 2.5;
check('Fractional dimension', $changed, [], false);
$changed = ['blocks' => []];
foreach (['A', 'B', 'C'] as $code) $changed['blocks'][] = ['code' => $code, 'bays' => 40, 'rows' => 20, 'tiers' => 1, 'disabled' => []];
check('Total area limit', $changed, [], false);
$top = $position; $top['tier'] = 2; $top['container_number'] = 'TOP1234567';
check('Unsupported stack', $layout, [$top], false);
check('Supported stack', $layout, [$position, $top], true);
$changed = $layout; $changed['blocks'][0]['tiers'] = 1;
check('Shrink occupied tier', $changed, [$position, $top], false);
check('Overlap', $layout, [$position, array_merge($position, ['container_number' => 'OTHER123'])], false);
echo "$count layout validation checks passed.\n";
