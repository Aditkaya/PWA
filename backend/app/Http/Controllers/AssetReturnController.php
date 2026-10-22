<?php
namespace App\Http\Controllers;

require_once __DIR__ . '/TandaTerimaAssetController.php';
require_once __DIR__ . '/../../Services/AssetReturnDocument.php';

use Database;
use PDO;
use App\Services\AssetReturnDocument;

class AssetReturnController extends TandaTerimaAssetController
{
    private function reconcile(PDO $pdo, int $employee): void
    {
        // Only an observed release/reassignment in Master Asset completes an item.
        // Submission never changes assets or tanda_terima_asset ownership/status.
        $query = $pdo->prepare('SELECT i.id FROM pengembalian_asset_items i
            JOIN pengembalian_asset p ON p.id = i.pengembalian_id
            JOIN assets a ON a.id = i.asset_id
            WHERE p.karyawan_id = ? AND p.status = ? AND i.released_at IS NULL
            AND (a.karyawan_id IS NULL OR a.karyawan_id <> i.karyawan_id)');
        $query->execute([$employee, 'menunggu_admin']);
        $update = $pdo->prepare('UPDATE pengembalian_asset_items SET released_at = CURRENT_TIMESTAMP WHERE id = ? AND released_at IS NULL');
        foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $id) $update->execute([$id]);
        $complete = $pdo->prepare("UPDATE pengembalian_asset SET status = 'dikembalikan', completed_at = CURRENT_TIMESTAMP
            WHERE karyawan_id = ? AND status = 'menunggu_admin'
            AND id IN (SELECT pengembalian_id FROM pengembalian_asset_items GROUP BY pengembalian_id
                HAVING COUNT(*) > 0 AND SUM(CASE WHEN released_at IS NULL THEN 1 ELSE 0 END) = 0)");
        $complete->execute([$employee]);
    }

    private function respondError(\Throwable $e, ?PDO $pdo = null): void
    {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        $invalid = $e instanceof \InvalidArgumentException;
        $conflict = $e instanceof \DomainException;
        http_response_code($invalid ? 422 : ($conflict ? 409 : 500));
        if (!$invalid && !$conflict) error_log('Asset return: ' . $e->getMessage());
        $missing = $e instanceof \PDOException &&
            (strpos($e->getMessage(), "doesn't exist") !== false || strpos($e->getMessage(), 'no such table') !== false);
        echo json_encode(['message' => $invalid || $conflict ? $e->getMessage() : ($missing
            ? 'Fitur pengembalian belum disiapkan. Hubungi admin untuk mengaktifkan fitur ini.'
            : 'Proses pengembalian asset gagal. Silakan coba kembali.')]);
    }

    public function returns(): void
    {
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $employee = (int) ($identity['karyawan_id'] ?? 0);
            $this->reconcile($pdo, $employee);
            $query = $pdo->prepare('SELECT id, nomor_dokumen, tanggal_pengembalian, alasan, status, payload, created_at, completed_at
                FROM pengembalian_asset WHERE karyawan_id = ? ORDER BY id DESC LIMIT 100');
            $query->execute([$employee]);
            $rows = $query->fetchAll(PDO::FETCH_ASSOC);
            $items = $pdo->prepare('SELECT tanda_terima_asset_id, asset_id, released_at FROM pengembalian_asset_items WHERE pengembalian_id = ? ORDER BY id');
            foreach ($rows as &$row) {
                $items->execute([$row['id']]);
                $row['items'] = $items->fetchAll(PDO::FETCH_ASSOC);
                $row['form'] = json_decode($row['payload'], true, 512, JSON_THROW_ON_ERROR);
                unset($row['payload']);
            }
            unset($row);
            header('Cache-Control: no-store');
            echo json_encode(['data' => $rows]);
        } catch (\Throwable $e) { $this->respondError($e); }
    }

    public function options(): void
    {
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $this->reconcile($pdo, (int) ($identity['karyawan_id'] ?? 0));
            [$where, $bindings] = $this->scope($identity);
            $query = $pdo->prepare('SELECT id, asset_id, kode_asset, nama_asset, nama_merk, nomor_seri, kondisi,
                nama_pemegang, nik_pemegang, departemen_pemegang FROM tanda_terima_asset' . $where . '
                AND EXISTS (SELECT 1 FROM assets a WHERE a.id = tanda_terima_asset.asset_id
                    AND a.karyawan_id = tanda_terima_asset.karyawan_id AND a.deleted_at IS NULL)
                AND NOT EXISTS (SELECT 1 FROM pengembalian_asset_items i JOIN pengembalian_asset p ON p.id = i.pengembalian_id
                    WHERE i.asset_id = tanda_terima_asset.asset_id AND i.released_at IS NULL AND p.status = ?)
                ORDER BY kode_asset, id');
            $query->execute(array_merge($bindings, ['menunggu_admin']));
            header('Cache-Control: no-store');
            echo json_encode(['data' => $query->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (\Throwable $e) { $this->respondError($e); }
    }

    private function text(array $data, string $key, int $max, bool $required = false): string
    {
        $value = $data[$key] ?? '';
        if (!is_string($value) || mb_strlen(trim($value)) > $max ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $value)) throw new \InvalidArgumentException('Isian ' . str_replace('_', ' ', $key) . ' tidak valid atau terlalu panjang.');
        $value = trim($value);
        if ($required && $value === '') throw new \InvalidArgumentException('Isian ' . str_replace('_', ' ', $key) . ' wajib diisi.');
        return $value;
    }

    public function submit(array $data): void
    {
        $pdo = null;
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $date = $this->text($data, 'tanggal_pengembalian', 10, true);
            $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new \InvalidArgumentException('Tanggal pengembalian tidak valid.');
            $reason = $this->text($data, 'alasan', 30, true);
            if (!in_array($reason, ['Resign', 'PHK', 'Habis Kontrak', 'Mutasi', 'Penggantian', 'Lainnya'], true)) throw new \InvalidArgumentException('Alasan pengembalian tidak valid.');
            $details = $this->text($data, 'alasan_lainnya', 200, $reason === 'Lainnya');
            $notes = $this->text($data, 'catatan', 600);
            $pic = $this->text($data, 'nama_pic', 100);
            $hrd = $this->text($data, 'nama_hrd', 100);
            $items = $data['items'] ?? null;
            if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 6) throw new \InvalidArgumentException('Pilih 1 sampai 6 asset untuk satu formulir.');
            $ids = [];
            foreach ($items as $item) {
                if (!is_array($item) || !isset($item['id']) || filter_var($item['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) throw new \InvalidArgumentException('Pilihan asset tidak valid.');
                $id = (int) $item['id'];
                if (isset($ids[$id])) throw new \InvalidArgumentException('Asset yang sama tidak boleh dipilih dua kali.');
                if (!in_array($item['kondisi'] ?? null, ['Baik', 'Rusak'], true) ||
                    !in_array($item['kelengkapan'] ?? null, ['Lengkap', 'Tidak Lengkap'], true)) throw new \InvalidArgumentException('Isi kondisi dan kelengkapan setiap asset.');
                $ids[$id] = ['kondisi' => $item['kondisi'], 'kelengkapan' => $item['kelengkapan'], 'keterangan' => $this->text($item, 'keterangan', 200)];
            }
            ksort($ids); // All submissions take locks in the same order.
            $pdo->beginTransaction();
            $this->reconcile($pdo, (int) $identity['karyawan_id']);
            $snapshots = [];
            $assetIds = [];
            foreach ($ids as $id => $item) {
                $row = $this->owned($pdo, $identity, $id, true);
                if (!$row) { $pdo->rollBack(); return; }
                if (isset($assetIds[$row['asset_id']])) throw new \InvalidArgumentException('Asset yang sama tidak boleh dipilih dua kali.');
                $assetIds[$row['asset_id']] = true;
                $asset = $pdo->prepare('SELECT id FROM assets WHERE id = ? AND karyawan_id = ? AND deleted_at IS NULL' .
                    ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''));
                $asset->execute([$row['asset_id'], $identity['karyawan_id']]);
                if (!$asset->fetchColumn()) throw new \DomainException('Pemegang asset sudah berubah. Muat ulang daftar asset.');
                $pending = $pdo->prepare("SELECT i.id FROM pengembalian_asset_items i JOIN pengembalian_asset p ON p.id = i.pengembalian_id
                    WHERE i.asset_id = ? AND i.released_at IS NULL AND p.status = 'menunggu_admin'" .
                    ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''));
                $pending->execute([$row['asset_id']]);
                if ($pending->fetchColumn()) throw new \DomainException('Asset ' . $row['kode_asset'] . ' sudah diajukan dan menunggu pelepasan admin.');
                $snapshots[] = array_merge($item, array_intersect_key($row, array_flip([
                    'id', 'asset_id', 'kode_asset', 'nama_asset', 'nama_merk', 'nomor_seri',
                    'nama_pemegang', 'nik_pemegang', 'departemen_pemegang',
                ])));
            }
            $number = 'PBA-' . str_replace('-', '', $date) . '-' . strtoupper(bin2hex(random_bytes(4)));
            $form = ['nomor_dokumen' => $number, 'tanggal_pengembalian' => $date, 'alasan' => $reason,
                'alasan_lainnya' => $reason === 'Lainnya' ? $details : '', 'catatan' => $notes,
                'nama_pic' => $pic, 'nama_hrd' => $hrd, 'items' => $snapshots,
                'nama_karyawan' => $identity['nama_lengkap'], 'nik' => $identity['nik'],
                'departemen' => $snapshots[0]['departemen_pemegang'] ?? ''];
            $insert = $pdo->prepare('INSERT INTO pengembalian_asset
                (nomor_dokumen, karyawan_id, requested_by, tanggal_pengembalian, alasan, payload) VALUES (?, ?, ?, ?, ?, ?)');
            $insert->execute([$number, $identity['karyawan_id'], $identity['id'], $date, $reason, json_encode($form, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
            $requestId = (int) $pdo->lastInsertId();
            $insertItem = $pdo->prepare('INSERT INTO pengembalian_asset_items
                (pengembalian_id, tanda_terima_asset_id, asset_id, karyawan_id) VALUES (?, ?, ?, ?)');
            foreach ($snapshots as $item) $insertItem->execute([$requestId, $item['id'], $item['asset_id'], $identity['karyawan_id']]);
            $pdo->commit();
            http_response_code(201);
            header('Cache-Control: no-store');
            echo json_encode(['message' => 'Pengajuan tersimpan. Pengembalian selesai setelah admin melepas asset.', 'id' => $requestId]);
        } catch (\Throwable $e) { $this->respondError($e, $pdo); }
    }

    public function document(int $id): void
    {
        $path = null;
        try {
            $pdo = Database::getConnection();
            $identity = $this->identity($pdo);
            if (!$identity) return;
            $query = $pdo->prepare('SELECT nomor_dokumen, payload FROM pengembalian_asset WHERE id = ? AND karyawan_id = ?');
            $query->execute([$id, (int) ($identity['karyawan_id'] ?? 0)]);
            $row = $query->fetch(PDO::FETCH_ASSOC);
            if (!$row) { http_response_code(404); echo json_encode(['message' => 'Formulir pengembalian tidak ditemukan.']); return; }
            $path = AssetReturnDocument::create(json_decode($row['payload'], true, 512, JSON_THROW_ON_ERROR));
            header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            header('Content-Disposition: attachment; filename="' . $row['nomor_dokumen'] . '.docx"');
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
            header('Content-Length: ' . filesize($path));
            readfile($path);
        } catch (\Throwable $e) { $this->respondError($e); }
        finally { if ($path && is_file($path)) unlink($path); }
    }
}
