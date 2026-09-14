<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use InvalidArgumentException;

class StowagePlanController
{
    private function query($pdo, $sql, $params = [])
    {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function required($input, $key)
    {
        if (!isset($input[$key]) || !is_string($input[$key]) || trim($input[$key]) === '') {
            throw new InvalidArgumentException('Data ' . $key . ' diperlukan.');
        }
        return trim($input[$key]);
    }

    public static function coordinates($value)
    {
        $values = array_filter(array_map('trim', explode(',', $value ?? '')), 'strlen');
        $values = array_values(array_unique(array_map(function ($v) { return str_pad($v, 2, '0', STR_PAD_LEFT); }, $values)));
        sort($values, SORT_NUMERIC);
        return $values;
    }

    private function layout($ship)
    {
        return [
            'bays' => self::coordinates($ship['stowage_bays'] ?? ''),
            'rows' => self::coordinates($ship['stowage_rows'] ?? ''),
            'tiers' => self::coordinates($ship['stowage_tiers'] ?? ''),
            'disabled_slots' => json_decode($ship['disabled_slots'] ?? '[]', true) ?: [],
        ];
    }

    public static function footprint($layout, $bay, $row, $tier, $size)
    {
        if (!in_array($bay, $layout['bays'], true) || !in_array($row, $layout['rows'], true) || !in_array($tier, $layout['tiers'], true)) {
            throw new InvalidArgumentException('Posisi tidak tersedia pada layout Master Kapal.');
        }
        $bays = [$bay];
        if (strpos((string) $size, '40') !== false) {
            $next = array_search($bay, $layout['bays'], true) + 1;
            if (!isset($layout['bays'][$next])) {
                throw new InvalidArgumentException('Kontainer 40 ft membutuhkan dua bay berurutan.');
            }
            $bays[] = $layout['bays'][$next];
        }
        $slots = array_map(function ($b) use ($row, $tier) { return $b . $row . $tier; }, $bays);
        if (array_intersect($slots, $layout['disabled_slots'])) {
            throw new InvalidArgumentException('Slot dinonaktifkan pada Master Kapal.');
        }
        return $slots;
    }

    public function handle($action, $input)
    {
        $pdo = null;
        try {
            $pdo = Database::getConnection();
            if ($action === 'ships') {
                $data = array_column($this->query($pdo, "SELECT DISTINCT nama_kapal FROM manifests WHERE nama_kapal IS NOT NULL AND nama_kapal <> '' ORDER BY nama_kapal"), 'nama_kapal');
            } else {
                $shipName = $this->required($input, 'nama_kapal');
                if ($action === 'voyages') {
                    $data = array_column($this->query($pdo, "SELECT DISTINCT no_voyage FROM manifests WHERE nama_kapal = ? AND no_voyage IS NOT NULL AND no_voyage <> '' ORDER BY no_voyage DESC", [$shipName]), 'no_voyage');
                } else {
                    $voyage = $this->required($input, 'no_voyage');
                    $writing = in_array($action, ['save', 'cancel'], true);
                    if ($writing) {
                        $pdo->beginTransaction();
                    }
                    // Serialize PWA placements for the same ship to prevent double booking.
                    $ships = $this->query($pdo, 'SELECT * FROM master_kapals WHERE nama_kapal = ?' . ($writing ? ' FOR UPDATE' : ''), [$shipName]);
                    $layout = $this->layout($ships[0] ?? []);
                    $manifests = $this->query($pdo, 'SELECT m.id, m.nomor_kontainer, m.size_kontainer, s.id AS plan_id, s.bay, s.`row`, s.tier FROM manifests m LEFT JOIN stowage_plans s ON s.manifest_id = m.id WHERE m.nama_kapal = ? AND m.no_voyage = ? ORDER BY m.id', [$shipName, $voyage]);
                    if (!$manifests) {
                        throw new InvalidArgumentException('Manifest kapal dan voyage tidak ditemukan.');
                    }
                    if ($writing) {
                        if (!$ships) {
                            throw new InvalidArgumentException('Master Kapal belum tersedia.');
                        }
                        $id = filter_var($input['manifest_id'] ?? null, FILTER_VALIDATE_INT);
                        $selected = null;
                        foreach ($manifests as $manifest) {
                            if ((int) $manifest['id'] === $id) $selected = $manifest;
                        }
                        if (!$selected) throw new InvalidArgumentException('Kontainer tidak termasuk kapal dan voyage ini.');
                        // Several manifests can belong to the same physical container.
                        $group = array_values(array_filter($manifests, function ($m) use ($selected) {
                            return $selected['nomor_kontainer'] ? $m['nomor_kontainer'] === $selected['nomor_kontainer'] : $m['id'] === $selected['id'];
                        }));
                        $ids = array_column($group, 'id');
                        if ($action === 'cancel') {
                            $stmt = $pdo->prepare('DELETE FROM stowage_plans WHERE manifest_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
                            $stmt->execute($ids);
                        } else {
                            $bay = str_pad($this->required($input, 'bay'), 2, '0', STR_PAD_LEFT);
                            $row = str_pad($this->required($input, 'row'), 2, '0', STR_PAD_LEFT);
                            $tier = str_pad($this->required($input, 'tier'), 2, '0', STR_PAD_LEFT);
                            $slots = [];
                            foreach ($group as $m) {
                                $slots = array_merge($slots, self::footprint($layout, $bay, $row, $tier, $m['size_kontainer']));
                            }
                            foreach ($manifests as $m) {
                                if (!$m['plan_id'] || in_array($m['id'], $ids)) continue;
                                $otherBay = str_pad($m['bay'] ?? '', 2, '0', STR_PAD_LEFT);
                                $otherRow = str_pad($m['row'] ?? '', 2, '0', STR_PAD_LEFT);
                                $otherTier = str_pad($m['tier'] ?? '', 2, '0', STR_PAD_LEFT);
                                $occupied = [$otherBay . $otherRow . $otherTier];
                                $index = array_search($otherBay, $layout['bays'], true);
                                if (strpos((string) $m['size_kontainer'], '40') !== false && $index !== false && isset($layout['bays'][$index + 1])) {
                                    $occupied[] = $layout['bays'][$index + 1] . $otherRow . $otherTier;
                                }
                                if (array_intersect($slots, $occupied)) throw new InvalidArgumentException('Slot sudah ditempati kontainer lain.');
                            }
                            foreach ($group as $m) {
                                if ($m['plan_id']) {
                                    $stmt = $pdo->prepare('UPDATE stowage_plans SET bay = ?, `row` = ?, tier = ?, updated_at = NOW() WHERE id = ?');
                                    $stmt->execute([$bay, $row, $tier, $m['plan_id']]);
                                } else {
                                    $stmt = $pdo->prepare('INSERT INTO stowage_plans (manifest_id, bay, `row`, tier, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())');
                                    $stmt->execute([$m['id'], $bay, $row, $tier]);
                                }
                            }
                        }
                        $pdo->commit();
                        $data = ['message' => $action === 'save' ? 'Posisi kontainer berhasil disimpan.' : 'Penempatan kontainer dibatalkan.'];
                    } else {
                        foreach ($manifests as &$m) {
                            foreach (['bay', 'row', 'tier'] as $key) {
                                $m[$key] = $m[$key] === null ? null : str_pad($m[$key], 2, '0', STR_PAD_LEFT);
                            }
                        }
                        unset($m);
                        $data = ['layout' => $layout, 'manifests' => $manifests];
                    }
                }
            }
            echo json_encode(['data' => $data]);
        } catch (\Throwable $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            $invalid = $e instanceof InvalidArgumentException;
            http_response_code($invalid ? 422 : 500);
            if (!$invalid) error_log('Stowage plan: ' . $e->getMessage());
            echo json_encode(['message' => $invalid ? $e->getMessage() : 'Stowage plan gagal dimuat. Pastikan tabel dan layout AYPSIS tersedia.']);
        }
    }
}
