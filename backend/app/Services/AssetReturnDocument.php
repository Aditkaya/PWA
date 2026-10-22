<?php
namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMXPath;
use ZipArchive;

class AssetReturnDocument
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private static function text(DOMXPath $xpath, DOMElement $element, string $value): void
    {
        $nodes = $xpath->query('.//w:t', $element);
        if (!$nodes->length) {
            $paragraph = $element->localName === 'p' ? $element : $xpath->query('.//w:p', $element)->item(0);
            if (!$paragraph) { $paragraph = $element->ownerDocument->createElementNS(self::W, 'w:p'); $element->appendChild($paragraph); }
            $run = $xpath->query('.//w:r[w:rPr]', $element)->item(0);
            if (!$run) {
                $run = $element->ownerDocument->createElementNS(self::W, 'w:r');
                $paragraph->appendChild($run);
            }
            $run->appendChild($element->ownerDocument->createElementNS(self::W, 'w:t'));
            $nodes = $xpath->query('.//w:t', $element);
        }
        $first = $nodes->item(0);
        foreach ($nodes as $node) $node->nodeValue = '';
        // DOM creates escaped text nodes, including employee-supplied &, <, and >.
        $first->appendChild($first->ownerDocument->createTextNode($value));
        $first->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }

    public static function create(array $form): string
    {
        $template = __DIR__ . '/../../templates/pengembalian-asset.docx';
        $temporary = tempnam(sys_get_temp_dir(), 'asset-return-');
        if ($temporary === false) throw new \RuntimeException('Folder sementara dokumen tidak dapat ditulis.');
        $zip = new ZipArchive();
        $opened = false;
        try {
            if (!copy($template, $temporary) || $zip->open($temporary) !== true) throw new \RuntimeException('Template pengembalian asset tidak dapat dibuka.');
            $opened = true;
            $xml = $zip->getFromName('word/document.xml');
            $doc = new DOMDocument();
            if ($xml === false || !$doc->loadXML($xml, LIBXML_NONET)) throw new \RuntimeException('Isi template pengembalian tidak valid.');
            $xpath = new DOMXPath($doc);
            $xpath->registerNamespace('w', self::W);
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $form['tanggal_pengembalian'])->format('d / m / Y');
            $notesFilled = false;
            foreach ($xpath->query('/w:document/w:body/w:p') as $paragraph) {
                $text = '';
                foreach ($xpath->query('.//w:t', $paragraph) as $node) $text .= $node->textContent;
                if (strpos($text, 'Nomor Dokumen :') === 0) self::text($xpath, $paragraph, 'Nomor Dokumen : ' . $form['nomor_dokumen']);
                elseif (strpos($text, 'Tanggal Pengembalian :') === 0) self::text($xpath, $paragraph, 'Tanggal Pengembalian : ' . $date);
                elseif (preg_match('/^_{10,}$/D', $text)) {
                    self::text($xpath, $paragraph, !$notesFilled ? ($form['catatan'] ?: '____________________________________________________________________________________________') : '');
                    $notesFilled = true;
                }
            }
            $tables = $xpath->query('/w:document/w:body/w:tbl');
            if ($tables->length !== 3) throw new \RuntimeException('Struktur template pengembalian telah berubah.');
            $identity = [$form['nama_karyawan'], $form['nik'], $form['departemen'],
                $form['alasan'] . ($form['alasan_lainnya'] !== '' ? ' - ' . $form['alasan_lainnya'] : '')];
            foreach ($xpath->query('w:tr', $tables->item(0)) as $index => $row) {
                self::text($xpath, $xpath->query('w:tc', $row)->item(1), $identity[$index]);
            }
            foreach ($xpath->query('w:tr', $tables->item(1)) as $index => $row) {
                if ($index === 0) continue;
                $item = $form['items'][$index - 1] ?? null;
                $values = $item ? [(string) $index, $item['nama_asset'], $item['nama_merk'] ?? '', $item['nomor_seri'] ?? '',
                    $item['kondisi'], $item['kelengkapan'], $item['keterangan']] : ['', '', '', '', '', '', ''];
                foreach ($xpath->query('w:tc', $row) as $column => $cell) self::text($xpath, $cell, $values[$column]);
            }
            $signatures = $xpath->query('w:tr', $tables->item(2));
            $names = [$form['nama_karyawan'], $form['nama_pic'], $form['nama_hrd']];
            foreach ($xpath->query('w:tc', $signatures->item(2)) as $index => $cell) {
                self::text($xpath, $cell, '(' . ($names[$index] ?: '________________________') . ')');
            }
            if (!$zip->addFromString('word/document.xml', $doc->saveXML())) throw new \RuntimeException('Dokumen pengembalian gagal dibuat.');
            if (!$zip->close()) throw new \RuntimeException('Dokumen pengembalian gagal disimpan.');
            $opened = false;
            return $temporary;
        } catch (\Throwable $e) {
            if ($opened) $zip->close();
            if (is_file($temporary)) unlink($temporary);
            throw $e;
        }
    }
}
