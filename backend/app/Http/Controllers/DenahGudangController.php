<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class DenahGudangController
{
    private function query($pdo, $sql, $params = [])
    {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function handle($input)
    {
        try {
            $pdo = Database::getConnection();
            if (!isset($input['gudang_id'])) {
                $data = $this->query($pdo, 'SELECT id, nama_gudang, lokasi, status FROM gudangs ORDER BY nama_gudang');
            } else {
                $id = filter_var($input['gudang_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if (!$id) {
                    http_response_code(422);
                    echo json_encode(['message' => 'Pilih gudang yang valid.']);
                    return;
                }
                $gudangs = $this->query($pdo, 'SELECT id, nama_gudang, lokasi, status, denah_layout FROM gudangs WHERE id = ?', [$id]);
                if (!$gudangs) {
                    http_response_code(404);
                    echo json_encode(['message' => 'Gudang tidak ditemukan.']);
                    return;
                }
                $gudang = $gudangs[0];
                $layout = json_decode($gudang['denah_layout'] ?? 'null', true, 512, JSON_THROW_ON_ERROR);
                unset($gudang['denah_layout']);
                $containers = [];
                foreach (['sewa' => 'kontainers', 'stock' => 'stock_kontainers'] as $source => $table) {
                    $records = $this->query($pdo, "SELECT id, nomor_seri_gabungan, awalan_kontainer, nomor_seri_kontainer, akhiran_kontainer, ukuran, tipe_kontainer FROM $table WHERE gudangs_id = ? AND status != 'inactive' ORDER BY nomor_seri_gabungan", [$id]);
                    foreach ($records as $record) {
                        $number = $record['nomor_seri_gabungan'] ?: $record['awalan_kontainer'] . $record['nomor_seri_kontainer'] . $record['akhiran_kontainer'];
                        $span = null;
                        if (preg_match('/^\s*(20|40)(?:\s*(?:ft|feet|hc|hq|gp|dc|dry|[\x27\x22]))?\s*$/i', (string) $record['ukuran'], $match)) {
                            $span = $match[1] === '40' ? 2 : 1;
                        }
                        $containers[$source . ':' . $record['id']] = [
                            'key' => $source . ':' . $record['id'], 'number' => $number,
                            'source' => $source, 'size' => $record['ukuran'], 'span' => $span,
                        ];
                    }
                }
                $positions = $this->query($pdo, 'SELECT id, source, container_id, container_number, block, bay, `row`, tier, span FROM gudang_positions WHERE gudang_id = ? ORDER BY id', [$id]);
                foreach ($positions as &$position) {
                    foreach (['id', 'container_id', 'bay', 'row', 'tier', 'span'] as $field) $position[$field] = (int) $position[$field];
                    $position['key'] = $position['source'] . ':' . $position['container_id'];
                    $container = $containers[$position['key']] ?? null;
                    $position['stale'] = !$container || $container['span'] !== $position['span'] || $container['number'] !== $position['container_number'];
                }
                unset($position);
                $data = ['gudang' => $gudang, 'layout' => $layout, 'positions' => $positions, 'containers' => array_values($containers)];
            }
            echo json_encode(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('Denah gudang: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Denah gudang gagal dimuat. Pastikan database dan tabel denah AYPSIS tersedia.']);
        }
    }
}
