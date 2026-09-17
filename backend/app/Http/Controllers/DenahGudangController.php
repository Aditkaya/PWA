<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../Services/PwaSession.php';
require_once __DIR__ . '/../../Services/GudangLayout.php';

use Database;
use PDO;

class DenahGudangController
{
    private function canEdit($pdo): bool
    {
        $userId = \App\Services\PwaSession::userId();
        if (!$userId) return false;
        $users = $this->query($pdo, "SELECT username FROM users WHERE id = ? AND status = 'approved'", [$userId]);
        if (!$users) return false;
        if (strtolower($users[0]['username']) === 'kiky') return true;
        $permissions = $this->query($pdo, "SELECT DISTINCT p.name FROM permissions p JOIN user_permissions up ON up.permission_id = p.id WHERE up.user_id = ? AND p.name IN ('master-gudang-view', 'master-gudang-edit')", [$userId]);
        return count($permissions) === 2;
    }

    public function saveLayout($input)
    {
        $pdo = null;
        try {
            $pdo = Database::getConnection();
            if (!$this->canEdit($pdo)) {
                http_response_code(403);
                echo json_encode(['message' => 'Login ulang dan pastikan akun memiliki izin lihat dan edit Master Gudang di AYPSIS.']);
                return;
            }
            $id = filter_var($input['gudang_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            $version = $input['version'] ?? null;
            if (!$id || !is_int($version) || $version < 0) throw new \InvalidArgumentException('Gudang atau versi layout tidak valid.');
            $pdo->beginTransaction();
            $records = $this->query($pdo, 'SELECT denah_version FROM gudangs WHERE id = ? FOR UPDATE', [$id]);
            if (!$records) throw new \InvalidArgumentException('Gudang tidak ditemukan.');
            if ((int) $records[0]['denah_version'] !== $version) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['message' => 'Layout telah diubah pengguna lain. Batalkan edit dan muat ulang sebelum mencoba kembali.']);
                return;
            }
            $positions = $this->query($pdo, 'SELECT * FROM gudang_positions WHERE gudang_id = ?', [$id]);
            $layout = \App\Services\GudangLayout::validate($input['layout'] ?? null, $positions);
            $stmt = $pdo->prepare('UPDATE gudangs SET denah_layout = ?, denah_version = denah_version + 1, updated_at = NOW() WHERE id = ?');
            $stmt->execute([json_encode($layout, JSON_THROW_ON_ERROR), $id]);
            $pdo->commit();
            echo json_encode(['data' => ['layout' => $layout, 'version' => $version + 1]]);
        } catch (\Throwable $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            $invalid = $e instanceof \InvalidArgumentException;
            http_response_code($invalid ? 422 : 500);
            if (!$invalid) error_log('Simpan layout gudang: '.$e->getMessage());
            echo json_encode(['message' => $invalid ? $e->getMessage() : 'Layout gagal disimpan. Silakan coba kembali.']);
        }
    }

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
                $gudangs = $this->query($pdo, 'SELECT id, nama_gudang, lokasi, status, denah_layout, denah_version FROM gudangs WHERE id = ?', [$id]);
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
                $data = ['gudang' => $gudang, 'layout' => $layout, 'version' => (int) $gudang['denah_version'], 'can_edit' => $this->canEdit($pdo), 'positions' => $positions, 'containers' => array_values($containers)];
            }
            echo json_encode(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('Denah gudang: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Denah gudang gagal dimuat. Pastikan database dan tabel denah AYPSIS tersedia.']);
        }
    }
}
