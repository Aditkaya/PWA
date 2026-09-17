<?php
namespace App\Services;

use InvalidArgumentException;

class GudangLayout
{
    public static function validate($layout, array $positions): array
    {
        if (!is_array($layout) || !isset($layout['blocks']) || !is_array($layout['blocks']) || !array_is_list($layout['blocks']) || count($layout['blocks']) < 1 || count($layout['blocks']) > 12) {
            throw new InvalidArgumentException('Layout harus memiliki 1 sampai 12 area.');
        }
        $blocks = [];
        $area = 0;
        foreach ($layout['blocks'] as $block) {
            if (!is_array($block) || !is_string($block['code'] ?? null) || !preg_match('/^[A-Z0-9_-]{1,12}$/D', $block['code']) || isset($blocks[$block['code']])) {
                throw new InvalidArgumentException('Kode area harus unik, maksimal 12 karakter huruf besar, angka, garis bawah atau tanda hubung.');
            }
            foreach (['bays' => 40, 'rows' => 20, 'tiers' => 6] as $key => $max) {
                if (!is_int($block[$key] ?? null) || $block[$key] < 1 || $block[$key] > $max) throw new InvalidArgumentException("Ukuran $key harus antara 1 dan $max.");
            }
            if (!isset($block['disabled']) || !is_array($block['disabled']) || !array_is_list($block['disabled']) || count($block['disabled']) > 800) throw new InvalidArgumentException('Daftar petak nonaktif tidak valid.');
            $disabled = [];
            foreach ($block['disabled'] as $cell) {
                if (!is_array($cell) || !is_int($cell['bay'] ?? null) || !is_int($cell['row'] ?? null) || $cell['bay'] < 1 || $cell['bay'] > $block['bays'] || $cell['row'] < 1 || $cell['row'] > $block['rows']) throw new InvalidArgumentException('Petak nonaktif berada di luar area.');
                $disabled[$cell['bay'].':'.$cell['row']] = ['bay' => $cell['bay'], 'row' => $cell['row']];
            }
            $blocks[$block['code']] = ['code' => $block['code'], 'bays' => $block['bays'], 'rows' => $block['rows'], 'tiers' => $block['tiers'], 'disabled' => array_values($disabled)];
            $area += $block['bays'] * $block['rows'];
        }
        if ($area > 2000) throw new InvalidArgumentException('Maksimal 2.000 petak dasar untuk seluruh area.');
        $occupied = [];
        $numbers = [];
        foreach ($positions as $p) {
            $b = $blocks[$p['block']] ?? null;
            $number = preg_replace('/[^A-Z0-9]/', '', strtoupper($p['container_number']));
            if (isset($numbers[$number])) throw new InvalidArgumentException('Nomor kontainer ganda pada denah. Periksa posisi di AYPSIS.');
            $numbers[$number] = true;
            if (!$b || $p['bay'] < 1 || $p['row'] < 1 || $p['tier'] < 1 || !in_array((int) $p['span'], [1, 2], true) || $p['bay'] + $p['span'] - 1 > $b['bays'] || $p['row'] > $b['rows'] || $p['tier'] > $b['tiers']) throw new InvalidArgumentException('Layout akan mengeluarkan kontainer '.$p['container_number'].'. Pindahkan kontainer terlebih dahulu di AYPSIS.');
            for ($bay = $p['bay']; $bay < $p['bay'] + $p['span']; $bay++) {
                foreach ($b['disabled'] as $cell) {
                    if ($cell['bay'] == $bay && $cell['row'] == $p['row']) throw new InvalidArgumentException('Petak berisi kontainer '.$p['container_number'].' tidak boleh dinonaktifkan.');
                }
                $key = $p['block'].':'.$bay.':'.$p['row'].':'.$p['tier'];
                if (isset($occupied[$key])) throw new InvalidArgumentException('Posisi kontainer bertumpuk pada petak yang sama.');
                $occupied[$key] = true;
            }
        }
        foreach ($positions as $p) {
            if ($p['tier'] <= 1) continue;
            for ($bay = $p['bay']; $bay < $p['bay'] + $p['span']; $bay++) {
                if (!isset($occupied[$p['block'].':'.$bay.':'.$p['row'].':'.($p['tier'] - 1)])) throw new InvalidArgumentException('Tingkat di bawah kontainer '.$p['container_number'].' harus terisi.');
            }
        }
        return ['blocks' => array_values($blocks)];
    }
}
