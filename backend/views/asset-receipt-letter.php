<?php
// Uses the holder snapshot from tanda_terima_asset and the AYPSIS letter format.
$escape = static fn ($value) => htmlspecialchars((string) ($value ?: '........................'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
$date = !empty($asset['tanggal_tanda_terima']) && $asset['tanggal_tanda_terima'] !== '0000-00-00'
    ? new DateTimeImmutable($asset['tanggal_tanda_terima']) : null;
$dateLabel = $date ? $date->format('d') . ' ' . $months[(int) $date->format('n') - 1] . ' ' . $date->format('Y') : null;
$city = in_array($asset['lokasi'], ['Jakarta', 'Batam'], true) ? $asset['lokasi'] : null;
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Surat Tanda Terima Asset - <?= $escape($asset['kode_asset']) ?></title>
  <style>
    @page { size: letter portrait; margin: 25.4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #eee; color: #000; font: 12pt/1.15 "Times New Roman", Times, serif; }
    main { width: 215.9mm; max-width: 100%; padding: 25.4mm; margin: auto; background: #fff; }
    .letterhead { width: 100%; height: auto; margin-bottom: 8pt; }
    h1 { font-size: 12pt; text-align: center; text-decoration: underline; margin: 0 0 20pt; }
    p { margin: 0 0 8pt; }
    ul, ol { padding-left: 30pt; }
    li { margin-bottom: 8pt; }
    .identity li { margin: 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 16pt 0; }
    th, td { border: .5pt solid #000; padding: 4pt; vertical-align: top; overflow-wrap: anywhere; }
    th { text-align: center; }
    .terms, .closing { text-align: justify; }
    .signature { break-inside: avoid; margin-top: 16pt; }
    .signature-space { height: 36pt; }
    @media (max-width: 600px) { body { padding: 8px; } main { padding: 20px; } }
    @media print { body { background: #fff; padding: 0; } main { width: auto; max-width: none; padding: 0; } }
  </style>
</head>
<body>
<main>
  <img class="letterhead" src="/asset-handover-letterhead.png" alt="Kop surat PT. Alexindo Yakinprima">
  <h1>SURAT PERNYATAAN SERAH TERIMA DAN PENGEMBALIAN ASET</h1>
  <p>Yang bertanda tangan di bawah ini:</p>
  <ul class="identity">
    <li>Nama Lengkap : <?= $escape($asset['nama_pemegang']) ?></li>
    <li>NIK / NIP : <?= $escape($asset['nik_pemegang']) ?></li>
    <li>Departemen : <?= $escape($asset['departemen_pemegang']) ?></li>
  </ul>
  <p>Dengan ini menyatakan bahwa saya telah menerima aset milik <strong>PT. ALEXINDO YAKINPRIMA</strong> berupa fasilitas kerja dengan rincian sebagai berikut:</p>
  <table>
    <thead><tr><th style="width: 7%">No.</th><th>Nama/Jenis Aset</th><th>Merk &amp; Tipe</th><th>Nomor Serial / Pelat Nomor</th><th>Kondisi Aset</th></tr></thead>
    <tbody><tr><td>1.</td><td><?= $escape($asset['nama_asset']) ?><br><?= $escape($asset['kode_asset']) ?></td><td>Merk: <?= $escape($asset['nama_merk']) ?><br>Tipe: <?= $escape($asset['kategori']) ?></td><td><?= $escape($asset['nomor_seri']) ?></td><td><?= $escape($asset['kondisi']) ?></td></tr></tbody>
  </table>
  <p>Sehubungan dengan penerimaan aset tersebut, saya menyatakan tunduk dan menyetujui ketentuan di bawah ini:</p>
  <ol class="terms">
    <li><strong>Tanggung Jawab Pemeliharaan:</strong> Saya akan menjaga, merawat, dan mempergunakan aset tersebut hanya untuk kepentingan operasional dan kelancaran pekerjaan perusahaan.</li>
    <li><strong>Pengembalian Aset:</strong> Saya bersedia dan wajib mengembalikan seluruh aset tersebut dalam kondisi baik dan lengkap kepada perusahaan apabila:
      <ul><li>Hubungan kerja saya berakhir (baik karena mengundurkan diri, PHK, habis masa kontrak, atau pensiun), paling lambat pada hari terakhir saya bekerja (last day).</li>
      <li>Diminta kembali sewaktu-waktu oleh manajemen perusahaan untuk kebutuhan rotasi, audit, pembaruan (upgrade), atau alasan operasional lainnya.</li></ul>
    </li>
    <li><strong>Sanksi dan Ganti Rugi:</strong> Apabila terjadi kerusakan yang disebabkan oleh kelalaian (bukan karena aus pemakaian wajar) atau kehilangan selama aset berada di bawah pengawasan saya, saya bersedia bertanggung jawab mengganti biaya perbaikan atau penggantian aset sesuai dengan kebijakan perusahaan.</li>
    <li><strong>Tindakan Hukum:</strong> Jika saya lalai atau sengaja tidak mengembalikan aset tersebut setelah hubungan kerja berakhir atau setelah diminta kembali, perusahaan berhak melakukan tindakan hukum dan menahan hak-hak finansial saya (seperti gaji terakhir atau pesangon) sebagai jaminan.</li>
  </ol>
  <p class="closing">Demikian surat pernyataan ini saya buat dengan sadar, sukarela, dan tanpa paksaan dari pihak mana pun untuk dipergunakan sebagaimana mestinya.</p>
  <div class="signature">
    <p><?= $escape($city) ?>, <?= $escape($dateLabel) ?></p><p>Yang Menyatakan,</p><p>Materai 10.000</p>
    <div class="signature-space" aria-label="Ruang tanda tangan"></div><p>(Tanda Tangan)</p><p>(<?= $escape($asset['nama_pemegang']) ?>)</p>
  </div>
</main>
</body>
</html>
