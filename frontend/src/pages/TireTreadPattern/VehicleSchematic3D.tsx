import { useState, useEffect } from 'react';
import './VehicleSchematic3D.css';
import VehicleAnimation3D from './VehicleAnimation3D';

/* ─────────────────────────────────────────────────────────────
   TYPE DEFINITIONS
   ───────────────────────────────────────────────────────────── */
export interface StockBanItem {
  id: number;
  nama_stock_ban_id?: number | null;
  nomor_seri: string;
  nomor_faktur?: string | null;
  nomor_bukti?: string | null;
  merk: string;
  ukuran: string;
  kondisi: string;
  status: string;
  status_masak?: string | null;
  jumlah_masak?: number | null;
  harga_beli?: string | number | null;
  tanggal_masuk?: string | null;
  tanggal_keluar?: string | null;
  tanggal_digunakan?: string | null;
  tanggal_kembali?: string | null;
  lokasi?: string | null;
  keterangan?: string | null;
  status_ban_luar?: string | null;
  mobil_id?: number | null;
  alat_berat_id?: number | null;
}

export interface WheelMeta {
  id: string;
  code: string;
  name: string;
  axle?: string;
  positionType: 'steer' | 'drive' | 'trailer';
  patternName: string;
  description: string;
}

export interface VehicleSchematicProps {
  wheelCount: 6 | 8 | 12 | 4;
  selectedWheelId?: string | null;
  onWheelClick?: (wheelId: string, tireData?: StockBanItem | null) => void;
  mobil_id?: number | string | null;
  mobilId?: number | string | null;
  alat_berat_id?: number | string | null;
  alatBeratId?: number | string | null;
  category?: string;
  wheelConfig?: {
    wheels: WheelMeta[];
    axleSummary?: string;
    treadPatternSummary?: string;
  } | null;
}

/* ─────────────────────────────────────────────────────────────
   COLOR PALETTE
   ───────────────────────────────────────────────────────────── */
const DS = {
  steer:   { fill: '#0c243c', rim: '#38bdf8', tread: '#14385a', glow: '#38bdf8', label: '#e0f2fe' },
  drive:   { fill: '#2d1800', rim: '#f59e0b', tread: '#452500', glow: '#f59e0b', label: '#fef3c7' },
  trailer: { fill: '#062615', rim: '#10b981', tread: '#0c3e23', glow: '#10b981', label: '#d1fae5' },
};

/* ─────────────────────────────────────────────────────────────
   SVG DEFS (Gradients & Filters)
   ───────────────────────────────────────────────────────────── */
function SvgDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}_axle`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#334155" />
        <stop offset="50%"  stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <linearGradient id={`${id}_rail`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#0f2035" />
        <stop offset="50%"  stopColor="#1e3a5f" />
        <stop offset="100%" stopColor="#0f2035" />
      </linearGradient>
      <filter id={`${id}_glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.5" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <pattern id={`${id}_grid`} width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56,189,248,0.05)" strokeWidth="0.5" />
      </pattern>
    </defs>
  );
}

// Global fallback agar ID ban yang ditarik (dragged) tidak hilang saat transisi event DOM
export let globalActiveDraggedBanId: number | null = null;

/* ─────────────────────────────────────────────────────────────
   TIRE COMPONENT (High Contrast, Staggered Pill Offset, Drag & Drop Support)
   ───────────────────────────────────────────────────────────── */
interface TireProps {
  cx: number;
  cy: number;
  id: string;
  type: 'steer' | 'drive' | 'trailer';
  label: string;
  isActive?: boolean;
  onClick?: (id: string) => void;
  onDropTire?: (wheelId: string, banId: number) => void;
  W?: number;
  H?: number;
  svgId: string;
  tireData?: StockBanItem | null;
  pillOffsetY?: number;
}

function Tire({
  cx,
  cy,
  id,
  type,
  label,
  isActive,
  onClick,
  onDropTire,
  W = 30,
  H = 54,
  svgId,
  tireData,
  pillOffsetY = 4
}: TireProps) {
  const c = DS[type];
  const rx = W / 2, ry = H / 2;
  const isAssigned = Boolean(tireData);
  const [isDndOver, setIsDndOver] = useState(false);

  const pillY = cy + ry + pillOffsetY;

  return (
    <g
      className={`vs-tire${isActive ? ' vs-tire--active' : ''}${!isAssigned ? ' vs-tire--unassigned' : ''}`}
      onClick={() => onClick?.(id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDndOver) setIsDndOver(true);
      }}
      onDragLeave={() => setIsDndOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDndOver(false);
        const rawData = e.dataTransfer.getData('text/plain');
        const banId = Number(rawData) || globalActiveDraggedBanId;
        if (banId) {
          onDropTire?.(id, Number(banId));
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Active Glowing Ring atau Drag-Over Highlight */}
      {(isActive || isDndOver) && (
        <rect
          x={cx - rx - 5} y={cy - ry - 5}
          width={W + 10} height={H + 10}
          rx={8} ry={8}
          fill={isDndOver ? 'rgba(16, 185, 129, 0.25)' : 'none'}
          stroke={isDndOver ? '#10b981' : c.glow}
          strokeWidth={isDndOver ? 3.0 : 2.5}
          opacity={0.9}
          filter={`url(#${svgId}_glow)`}
        />
      )}

      {/* Main Tire Body (Hanya tampil jika ban sudah terpasang) */}
      {isAssigned ? (
        <>
          <rect
            x={cx - rx} y={cy - ry}
            width={W} height={H}
            rx={6} ry={6}
            fill={isActive ? c.tread : c.fill}
            stroke={c.rim}
            strokeWidth={isActive ? 2.5 : 1.8}
          />
          {/* Tread Ribs */}
          {[-14, -7, 7, 14].map((offsetY, i) => (
            <line
              key={i}
              x1={cx - rx + 4} y1={cy + offsetY}
              x2={cx + rx - 4} y2={cy + offsetY}
              stroke={isActive ? c.rim : 'rgba(255,255,255,0.22)'}
              strokeWidth={1.2}
            />
          ))}
          {/* Center Tread Stripe */}
          <rect
            x={cx - 1.5} y={cy - ry + 4}
            width={3} height={H - 8}
            rx={1.5}
            fill={c.rim}
            opacity={isActive ? 0.9 : 0.5}
          />
        </>
      ) : (
        /* Slot Posisi Roda Kosong (Belum Dipasang Ban) */
        <rect
          x={cx - rx} y={cy - ry}
          width={W} height={H}
          rx={6} ry={6}
          fill="rgba(4, 14, 30, 0.45)"
          stroke={isActive ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)'}
          strokeWidth={isActive ? 2.0 : 1.2}
          strokeDasharray="4,4"
        />
      )}

      {/* Hub Ellipse */}
      <ellipse
        cx={cx} cy={cy}
        rx={rx * 0.45} ry={ry * 0.28}
        fill={isActive ? c.rim : '#071626'}
        stroke={c.rim}
        strokeWidth={1.2}
      />

      {/* Position Code Label (Big & High Contrast) */}
      <text
        x={cx} y={cy + 3.5}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={800}
        fontFamily="ui-monospace, monospace"
        fill="#ffffff"
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>

      {/* Status Pill Tag Below Tire (Staggered Y to avoid overlap) */}
      {tireData ? (
        <g>
          <rect
            x={cx - 28} y={pillY}
            width={56} height={13}
            rx={3}
            fill="#042013"
            stroke="#10b981"
            strokeWidth={0.8}
          />
          <text
            x={cx} y={pillY + 9.5}
            textAnchor="middle"
            fontSize={7.4}
            fontWeight={700}
            fontFamily="ui-monospace, monospace"
            fill="#34d399"
          >
            #{tireData.nomor_seri.length > 8 ? tireData.nomor_seri.slice(0, 7) + '…' : tireData.nomor_seri}
          </text>
        </g>
      ) : (
        <g>
          <rect
            x={cx - 24} y={pillY}
            width={48} height={12}
            rx={3}
            fill="rgba(15,23,42,0.85)"
            stroke="rgba(56,189,248,0.4)"
            strokeWidth={0.8}
            strokeDasharray="2,2"
          />
          <text
            x={cx} y={pillY + 8.5}
            textAnchor="middle"
            fontSize={6.8}
            fontWeight={700}
            fontFamily="ui-monospace, monospace"
            fill="#38bdf8"
          >
            + PASANG
          </text>
        </g>
      )}
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHARED STRUCTURAL ELEMENTS
   ───────────────────────────────────────────────────────────── */
function AxleBar({ x1, y, x2, svgId }: { x1: number; y: number; x2: number; svgId: string }) {
  return (
    <rect
      x={x1} y={y - 4}
      width={x2 - x1} height={8}
      rx={4}
      fill={`url(#${svgId}_axle)`}
      stroke="rgba(255,255,255,0.2)"
      strokeWidth={0.8}
    />
  );
}

function DirectionBadge({ cx, y }: { cx: number; y: number }) {
  return (
    <g opacity={0.7}>
      <rect
        x={cx - 45} y={y - 10}
        width={90} height={18}
        rx={4}
        fill="rgba(2,10,24,0.8)"
        stroke="rgba(56,189,248,0.3)"
        strokeWidth={0.8}
      />
      <text
        x={cx} y={y + 3}
        textAnchor="middle"
        fontSize={8}
        fontWeight={700}
        fill="#38bdf8"
        fontFamily="ui-monospace, monospace"
        letterSpacing={1.2}
      >
        ▲ DEPAN
      </text>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6-RODA — Tractor Head
   ═══════════════════════════════════════════════════════════════ */
function Schema6Roda({
  selectedWheelId,
  onWheelClick,
  getTire,
  onDropTire
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
}) {
  const ID = 's6';
  const VW = 380, VH = 460;
  const cX = VW / 2;

  const steerY = 110;
  const driveY = 320;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="vs-svg" xmlns="http://www.w3.org/2000/svg">
      <SvgDefs id={ID} />
      <rect width={VW} height={VH} fill={`url(#${ID}_grid)`} opacity={0.6} />

      <DirectionBadge cx={cX} y={24} />

      <rect x={cX - 38} y={50} width={14} height={320} rx={3} fill={`url(#${ID}_rail)`} />
      <rect x={cX + 24} y={50} width={14} height={320} rx={3} fill={`url(#${ID}_rail)`} />
      {[90, 170, 250, 310].map((cy, i) => (
        <rect key={i} x={cX - 24} y={cy} width={48} height={8} rx={2} fill="#162d4a" />
      ))}

      <rect x={cX - 54} y={50} width={108} height={82} rx={10}
        fill="#112d56" stroke="rgba(56,189,248,0.4)" strokeWidth={1.5} />
      <rect x={cX - 42} y={58} width={84} height={42} rx={6}
        fill="rgba(56,189,248,0.18)" stroke="rgba(56,189,248,0.6)" strokeWidth={1.2} />
      <rect x={cX - 50} y={62} width={10} height={7} rx={2} fill="#fbbf24" />
      <rect x={cX + 40} y={62} width={10} height={7} rx={2} fill="#fbbf24" />

      <ellipse cx={cX} cy={230} rx={24} ry={13} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} />
      <circle cx={cX} cy={230} r={6} fill="#0f172a" stroke="#94a3b8" strokeWidth={1} />

      <AxleBar x1={85} y={steerY} x2={295} svgId={ID} />
      <AxleBar x1={56} y={driveY} x2={324} svgId={ID} />

      <text x={cX} y={steerY - 26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#38bdf8" fontFamily="monospace">
        GANDAR 1 (KEMUDI / STEER)
      </text>
      <text x={cX} y={driveY - 26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#f59e0b" fontFamily="monospace">
        GANDAR 2 (PENGGERAK GANDA / DRIVE)
      </text>

      <Tire cx={85}  cy={steerY} id="w1" type="steer" label="FL"
        isActive={selectedWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={4} />
      <Tire cx={295} cy={steerY} id="w2" type="steer" label="FR"
        isActive={selectedWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={4} />

      <Tire cx={56}  cy={driveY} id="w3" type="drive" label="RL-O"
        isActive={selectedWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={3} />
      <Tire cx={96}  cy={driveY} id="w4" type="drive" label="RL-I"
        isActive={selectedWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={17} />
      <Tire cx={284} cy={driveY} id="w5" type="drive" label="RR-I"
        isActive={selectedWheelId === 'w5'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w5')} pillOffsetY={17} />
      <Tire cx={324} cy={driveY} id="w6" type="drive" label="RR-O"
        isActive={selectedWheelId === 'w6'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w6')} pillOffsetY={3} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8-RODA — Chassis Kontainer 20ft
   ═══════════════════════════════════════════════════════════════ */
function Schema8Roda({
  selectedWheelId,
  onWheelClick,
  getTire,
  onDropTire
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
}) {
  const ID = 's8';
  const VW = 380, VH = 490;
  const cX = VW / 2;

  const a1Y = 200;
  const a2Y = 350;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="vs-svg" xmlns="http://www.w3.org/2000/svg">
      <SvgDefs id={ID} />
      <rect width={VW} height={VH} fill={`url(#${ID}_grid)`} opacity={0.6} />

      <DirectionBadge cx={cX} y={24} />

      <rect x={cX - 48} y={50} width={96} height={350} rx={6}
        fill="#0d233a" stroke="rgba(16,185,129,0.35)" strokeWidth={1.5} />
      <text x={cX} y={115} textAnchor="middle" fontSize={16} fontWeight={900} fill="rgba(16,185,129,0.2)" letterSpacing={3}>
        20 FT
      </text>

      <circle cx={cX} cy={75} r={8} fill="#1e293b" stroke="#10b981" strokeWidth={1.2} />

      <AxleBar x1={56} y={a1Y} x2={324} svgId={ID} />
      <AxleBar x1={56} y={a2Y} x2={324} svgId={ID} />

      <text x={cX} y={a1Y - 26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" fontFamily="monospace">
        GANDAR 1 (TANDEM DEPAN)
      </text>
      <text x={cX} y={a2Y - 26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" fontFamily="monospace">
        GANDAR 2 (TANDEM BELAKANG)
      </text>

      <Tire cx={56}  cy={a1Y} id="w1" type="trailer" label="A1-LO"
        isActive={selectedWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={3} />
      <Tire cx={96}  cy={a1Y} id="w2" type="trailer" label="A1-LI"
        isActive={selectedWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={17} />
      <Tire cx={284} cy={a1Y} id="w3" type="trailer" label="A1-RI"
        isActive={selectedWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={17} />
      <Tire cx={324} cy={a1Y} id="w4" type="trailer" label="A1-RO"
        isActive={selectedWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={3} />

      <Tire cx={56}  cy={a2Y} id="w5" type="trailer" label="A2-LO"
        isActive={selectedWheelId === 'w5'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w5')} pillOffsetY={3} />
      <Tire cx={96}  cy={a2Y} id="w6" type="trailer" label="A2-LI"
        isActive={selectedWheelId === 'w6'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w6')} pillOffsetY={17} />
      <Tire cx={284} cy={a2Y} id="w7" type="trailer" label="A2-RI"
        isActive={selectedWheelId === 'w7'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w7')} pillOffsetY={17} />
      <Tire cx={324} cy={a2Y} id="w8" type="trailer" label="A2-RO"
        isActive={selectedWheelId === 'w8'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w8')} pillOffsetY={3} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   12-RODA — Chassis Kontainer 40ft (Tri-Axle)
   ═══════════════════════════════════════════════════════════════ */
function Schema12Roda({
  selectedWheelId,
  onWheelClick,
  getTire,
  onDropTire
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
}) {
  const ID = 's12';
  const VW = 380, VH = 580;
  const cX = VW / 2;

  const a1Y = 190;
  const a2Y = 320;
  const a3Y = 450;

  function AxleRow({ ay, prefix, startIdx }: { ay: number; prefix: string; startIdx: number }) {
    return (
      <>
        <AxleBar x1={56} y={ay} x2={324} svgId={ID} />
        <Tire cx={56}  cy={ay} id={`w${startIdx}`}   type="trailer" label={`${prefix}-LO`}
          isActive={selectedWheelId === `w${startIdx}`}   onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx}`)} pillOffsetY={3} />
        <Tire cx={96}  cy={ay} id={`w${startIdx+1}`} type="trailer" label={`${prefix}-LI`}
          isActive={selectedWheelId === `w${startIdx+1}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+1}`)} pillOffsetY={17} />
        <Tire cx={284} cy={ay} id={`w${startIdx+2}`} type="trailer" label={`${prefix}-RI`}
          isActive={selectedWheelId === `w${startIdx+2}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+2}`)} pillOffsetY={17} />
        <Tire cx={324} cy={ay} id={`w${startIdx+3}`} type="trailer" label={`${prefix}-RO`}
          isActive={selectedWheelId === `w${startIdx+3}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+3}`)} pillOffsetY={3} />
      </>
    );
  }

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="vs-svg" xmlns="http://www.w3.org/2000/svg">
      <SvgDefs id={ID} />
      <rect width={VW} height={VH} fill={`url(#${ID}_grid)`} opacity={0.6} />

      <DirectionBadge cx={cX} y={24} />

      <rect x={cX - 46} y={50} width={92} height={460} rx={6}
        fill="#0d233a" stroke="rgba(16,185,129,0.35)" strokeWidth={1.5} />
      <text x={cX} y={115} textAnchor="middle" fontSize={16} fontWeight={900} fill="rgba(16,185,129,0.2)" letterSpacing={3}>
        40 FT
      </text>

      <circle cx={cX} cy={72} r={8} fill="#1e293b" stroke="#10b981" strokeWidth={1.2} />

      <text x={cX} y={a1Y - 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" fontFamily="monospace">
        GANDAR 1 (DEPAN)
      </text>
      <AxleRow ay={a1Y} prefix="A1" startIdx={1} />

      <text x={cX} y={a2Y - 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" fontFamily="monospace">
        GANDAR 2 (TENGAH)
      </text>
      <AxleRow ay={a2Y} prefix="A2" startIdx={5} />

      <text x={cX} y={a3Y - 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" fontFamily="monospace">
        GANDAR 3 (BELAKANG)
      </text>
      <AxleRow ay={a3Y} prefix="A3" startIdx={9} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4-RODA — Forklift
   ═══════════════════════════════════════════════════════════════ */
function Schema4Roda({
  selectedWheelId,
  onWheelClick,
  getTire,
  onDropTire
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
}) {
  const ID = 's4';
  const VW = 380, VH = 420;
  const cX = VW / 2;

  const frontY = 150;
  const rearY  = 310;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="vs-svg" xmlns="http://www.w3.org/2000/svg">
      <SvgDefs id={ID} />
      <rect width={VW} height={VH} fill={`url(#${ID}_grid)`} opacity={0.6} />

      <DirectionBadge cx={cX} y={24} />

      <rect x={cX - 60} y={110} width={120} height={230} rx={12}
        fill="#1e160a" stroke="#d97706" strokeWidth={1.5} />
      <rect x={cX - 46} y={170} width={92} height={60} rx={6}
        fill="#2e1f0c" stroke="rgba(255,255,255,0.06)" />
      <rect x={cX - 22} y={190} width={44} height={22} rx={4}
        fill="#0f0c08" stroke="#f59e0b" strokeWidth={0.8} />

      <rect x={cX - 54} y={305} width={108} height={30} rx={6}
        fill="#111111" stroke="#525252" strokeWidth={1} />
      <text x={cX} y={324} textAnchor="middle" fontSize={7} fill="#737373" fontFamily="monospace">
        COUNTERWEIGHT
      </text>

      <rect x={cX - 30} y={45} width={10} height={55} rx={2} fill="#78716c" />
      <rect x={cX + 20} y={45} width={10} height={55} rx={2} fill="#78716c" />
      <rect x={cX - 36} y={95} width={72} height={8}  rx={2} fill="#a8a29e" />

      <AxleBar x1={95}  y={frontY} x2={285} svgId={ID} />
      <AxleBar x1={105} y={rearY}  x2={275} svgId={ID} />

      <text x={cX} y={frontY - 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#f59e0b" fontFamily="monospace">
        GANDAR DEPAN (BEBAN UTAMA)
      </text>
      <text x={cX} y={rearY - 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#38bdf8" fontFamily="monospace">
        GANDAR BELAKANG (KEMUDI PUTAR)
      </text>

      <Tire cx={95}  cy={frontY} id="w1" type="drive" label="FL"
        isActive={selectedWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={4} />
      <Tire cx={285} cy={frontY} id="w2" type="drive" label="FR"
        isActive={selectedWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={4} />
      <Tire cx={105} cy={rearY}  id="w3" type="steer" label="RL"
        isActive={selectedWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={4} />
      <Tire cx={275} cy={rearY}  id="w4" type="steer" label="RR"
        isActive={selectedWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={4} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REALISTIC PHYSICAL TIRE COMPONENT (STOCK_BANS VISUAL BAN FISIK)
   ═══════════════════════════════════════════════════════════════ */
export function RealisticTireGraphic({
  ban,
  size = 72,
  isAssigned = false,
  assignedCode
}: {
  ban: StockBanItem;
  size?: number;
  isAssigned?: boolean;
  assignedCode?: string | null;
}) {
  const c = size / 2;
  const rOuter = size * 0.46;
  const rSidewall = size * 0.38;
  const rRim = size * 0.28;
  const rHub = size * 0.13;
  const numTreads = 20;

  return (
    <div className="vs-tire-graphic-wrap" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="vs-tire-graphic-svg"
      >
        <defs>
          <radialGradient id={`rubber_grad_${ban.id}_${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#252932" />
            <stop offset="85%" stopColor="#14181f" />
            <stop offset="100%" stopColor="#090b0e" />
          </radialGradient>
          <radialGradient id={`rim_grad_${ban.id}_${size}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
          <radialGradient id={`hub_grad_${ban.id}_${size}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={isAssigned ? '#10b981' : '#38bdf8'} />
            <stop offset="70%" stopColor={isAssigned ? '#047857' : '#0284c7'} />
            <stop offset="100%" stopColor={isAssigned ? '#064e3b' : '#0369a1'} />
          </radialGradient>
          <filter id={`tire_drop_shadow_${ban.id}_${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Shadow & Gigi Tapak Luar Ban (Tread Lugs) */}
        <g filter={`url(#tire_drop_shadow_${ban.id}_${size})`}>
          {Array.from({ length: numTreads }).map((_, i) => {
            const angle = (i * 360) / numTreads;
            const rad = (angle * Math.PI) / 180;
            const x1 = c + (rOuter - size * 0.04) * Math.cos(rad);
            const y1 = c + (rOuter - size * 0.04) * Math.sin(rad);
            const x2 = c + (rOuter + size * 0.02) * Math.cos(rad);
            const y2 = c + (rOuter + size * 0.02) * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#090b0e"
                strokeWidth={size * 0.05}
                strokeLinecap="round"
              />
            );
          })}

          {/* Dinding Luar Ban (Outer Rubber Donut) */}
          <circle
            cx={c}
            cy={c}
            r={rOuter}
            fill={`url(#rubber_grad_${ban.id}_${size})`}
            stroke="#334155"
            strokeWidth={size * 0.015}
          />
        </g>

        {/* Alur Dinding Samping Ban (Sidewall Grooves) */}
        <circle
          cx={c}
          cy={c}
          r={rSidewall}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={size * 0.012}
          strokeDasharray="4 2"
        />

        {/* Velg Alloy Rim */}
        <circle
          cx={c}
          cy={c}
          r={rRim}
          fill={`url(#rim_grad_${ban.id}_${size})`}
          stroke="#1e293b"
          strokeWidth={size * 0.02}
        />

        {/* Baut Roda (8 Lug Nuts) */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 360) / 8;
          const rad = (angle * Math.PI) / 180;
          const dist = rRim * 0.65;
          const bx = c + dist * Math.cos(rad);
          const by = c + dist * Math.sin(rad);
          return (
            <g key={i}>
              <circle cx={bx} cy={by} r={size * 0.035} fill="#0f172a" />
              <circle cx={bx - 0.5} cy={by - 0.5} r={size * 0.024} fill="#e2e8f0" />
            </g>
          );
        })}

        {/* Tutup Hub Poros Tengah */}
        <circle
          cx={c}
          cy={c}
          r={rHub}
          fill={`url(#hub_grad_${ban.id}_${size})`}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={size * 0.018}
        />

        {/* Label Kode Roda atau Ikon di Tengah Hub */}
        <text
          x={c}
          y={c + 0.5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.12}
          fontWeight={900}
          fill="#ffffff"
          fontFamily="ui-monospace, monospace"
        >
          {isAssigned && assignedCode ? assignedCode : '🛞'}
        </text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — DROPDOWN TIRE ASSIGNMENT
   ═══════════════════════════════════════════════════════════════ */
export default function VehicleSchematic3D({
  wheelCount,
  selectedWheelId,
  onWheelClick,
  mobil_id,
  mobilId,
  alat_berat_id,
  alatBeratId,
  category,
  wheelConfig
}: VehicleSchematicProps) {
  const activeMobilId = mobil_id ?? mobilId ?? null;
  const activeAlatBeratId = alat_berat_id ?? alatBeratId ?? null;

  const [tires, setTires] = useState<StockBanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pilihan Tampilan: 3D Animasi Interaktif (Three.js WebGL) vs Denah Blueprint 2D
  const [viewMode, setViewMode] = useState<'3d-anim' | 'blueprint'>('3d-anim');

  // Toggle tabel dropdown seluruh roda


  // Key penyimpanan mapping posisi roda ke ID ban stock_bans
  const storageKey = activeMobilId
    ? `tire_assign_mobil_${activeMobilId}`
    : activeAlatBeratId
      ? `tire_assign_alat_${activeAlatBeratId}`
      : null;

  // State mapping roda -> stockBanId (awalannya kosong {})
  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    if (!storageKey) return {};
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Saat unit berubah, muat mapping yang tersimpan (atau default kosong)
  useEffect(() => {
    if (!storageKey) {
      setAssignments({});
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      setAssignments(saved ? JSON.parse(saved) : {});
    } catch {
      setAssignments({});
    }
  }, [storageKey]);

  // Simpan ke state dan localStorage
  const saveAssignments = (newAssigns: Record<string, number>) => {
    setAssignments(newAssigns);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newAssigns));
      } catch (e) {
        console.error('Error saving assignments:', e);
      }
    }
  };

  // Ambil daftar ban terpakai unit dari API stock_bans
  useEffect(() => {
    if (!activeMobilId && !activeAlatBeratId) {
      setTires([]);
      setIsLoading(false);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    const q = activeMobilId
      ? `mobil_id=${encodeURIComponent(String(activeMobilId))}`
      : `alat_berat_id=${encodeURIComponent(String(activeAlatBeratId))}`;

    fetch(`/api/tire-tread/tires?${q}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.status === 'success' && Array.isArray(json.data)) {
            setTires(json.data);
          } else {
            setTires([]);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching stock_bans:', err);
          setErrorMsg('Gagal memuat stock_bans');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeMobilId, activeAlatBeratId]);

  // Posisi roda yang aktif dipilih (fallback default 'w1' agar dropdown langsung terlihat)
  const [internalWheelId, setInternalWheelId] = useState<string>('w1');
  const activeWheelId = selectedWheelId || internalWheelId;

  // State Drag and Drop
  const [draggedTireId, setDraggedTireId] = useState<number | null>(null);
  const [draggedSourceWheelId, setDraggedSourceWheelId] = useState<string | null>(null);
  const [isDragOverTray, setIsDragOverTray] = useState<boolean>(false);



  // Mencari ban yang terpasang pada suatu posisi roda
  const getTireForWheel = (wheelId: string): StockBanItem | null => {
    const banId = assignments[wheelId];
    if (!banId) return null;
    return tires.find((t) => t.id === banId) || null;
  };

  // Handler klik roda pada diagram atau saat memilih posisi dari dropdown
  const handleSelectWheel = (wheelId: string) => {
    setInternalWheelId(wheelId);
    const tire = getTireForWheel(wheelId);
    onWheelClick?.(wheelId, tire);
  };

  // Pasang ban tertentu ke posisi roda
  const handleAssignTire = (wheelId: string, banId: number) => {
    const nextAssigns = { ...assignments };
    // Jika ban ini sebelumnya terpasang di roda lain, lepas dari roda lama
    for (const [wKey, bVal] of Object.entries(nextAssigns)) {
      if (bVal === banId) {
        delete nextAssigns[wKey];
      }
    }
    nextAssigns[wheelId] = banId;
    saveAssignments(nextAssigns);

    const assignedTire = tires.find((t) => t.id === banId) || null;
    setInternalWheelId(wheelId);
    onWheelClick?.(wheelId, assignedTire);
  };



  // Lepas ban dari posisi roda
  const handleRemoveTire = (wheelId: string) => {
    const nextAssigns = { ...assignments };
    delete nextAssigns[wheelId];
    saveAssignments(nextAssigns);
    onWheelClick?.(wheelId, null);
  };



  // Reset/Kosongkan seluruh posisi roda
  const handleReset = () => {
    saveAssignments({});
    onWheelClick?.(activeWheelId, null);
  };

  // Data roda dan ban yang sedang aktif dipilih


  // Filter tray kartu ban: 'all' | 'ready' | 'placed'
  const [trayFilter, setTrayFilter] = useState<'all' | 'ready' | 'placed'>('all');

  const assignedCount = Object.keys(assignments).length;
  const unassignedTiresCount = tires.filter((t) => !Object.values(assignments).includes(t.id)).length;

  // Filtered tires for tray display
  const displayedTires = tires.filter((ban) => {
    const isPlaced = Object.values(assignments).includes(ban.id);
    if (trayFilter === 'ready') return !isPlaced;
    if (trayFilter === 'placed') return isPlaced;
    return true;
  });

  return (
    <div className="vs-wrapper">
      {/* ── WORKBENCH GRID CONTAINER (2-KOLOM PADA DESKTOP, RESPONSIVE) ── */}
      <div className="vs-workbench">
        {/* ── KOLOM 1: STAGE VISUAL (3D STUDIO / BLUEPRINT 2D) ── */}
        <div className="vs-workbench-stage">
          {/* Header Bar Stage & Kontrol View Mode */}
          <div className="vs-stage-header">
            {/* Toggle Mode Tampilan */}
            <div className="vs-view-mode-bar">
              <button
                type="button"
                className={`vs-mode-btn ${viewMode === '3d-anim' ? 'vs-mode-btn--active' : ''}`}
                onClick={() => setViewMode('3d-anim')}
              >
                <span>✨</span>
                <span>3D Studio</span>
              </button>
              <button
                type="button"
                className={`vs-mode-btn ${viewMode === 'blueprint' ? 'vs-mode-btn--active' : ''}`}
                onClick={() => setViewMode('blueprint')}
              >
                <span>📐</span>
                <span>Blueprint 2D</span>
              </button>
            </div>

            {/* Status Unit & Legend Indikator */}
            <div className="vs-stage-status-group">
              <div className="vs-status-pill-wrap">
                {errorMsg ? (
                  <span className="vs-status-pill vs-status-pill--warn">⚠ {errorMsg}</span>
                ) : isLoading ? (
                  <span className="vs-status-pill vs-status-pill--loading">⟳ Memuat ban...</span>
                ) : assignedCount >= wheelCount ? (
                  <span className="vs-status-pill vs-status-pill--ok">✓ {assignedCount}/{wheelCount} Terpasang Penuh</span>
                ) : assignedCount > 0 ? (
                  <span className="vs-status-pill vs-status-pill--warn">● {assignedCount}/{wheelCount} Terpasang</span>
                ) : (
                  <span className="vs-status-pill vs-status-pill--neutral">⚪ 0/{wheelCount} Terpasang</span>
                )}
              </div>

              <div className="vs-legend-row">
                <div className="vs-legend-item"><span className="vs-legend-dot vs-legend-dot--steer" /><span>Steer</span></div>
                <div className="vs-legend-item"><span className="vs-legend-dot vs-legend-dot--drive" /><span>Drive</span></div>
                <div className="vs-legend-item"><span className="vs-legend-dot vs-legend-dot--trailer" /><span>Sasis</span></div>
              </div>
            </div>
          </div>

          {/* Kanvas 3D Interaktif atau Blueprint SVG 2D */}
          <div className="vs-stage-canvas-wrap">
            {viewMode === '3d-anim' ? (
              <VehicleAnimation3D
                wheelCount={wheelCount}
                selectedWheelId={activeWheelId}
                onWheelClick={handleSelectWheel}
                getTireForWheel={getTireForWheel}
                wheelConfig={wheelConfig}
                category={category}
                onDropTireToWheel={(targetWheelId, banId) => {
                  handleAssignTire(targetWheelId, banId);
                }}
                draggedTireId={draggedTireId}
              />
            ) : (
              <div className="vs-container">
                {wheelCount === 6 && (
                  <Schema6Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} />
                )}
                {wheelCount === 8 && (
                  <Schema8Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} />
                )}
                {wheelCount === 12 && (
                  <Schema12Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} />
                )}
                {wheelCount === 4 && (
                  <Schema4Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── KOLOM 2: INVENTORI BAN UNIT & DRAG DOCK ── */}
        <div className="vs-workbench-dock">
          <div
            className={`vs-tray-card ${isDragOverTray ? 'vs-tray-card--dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverTray(true);
            }}
            onDragLeave={() => setIsDragOverTray(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOverTray(false);
              if (draggedSourceWheelId) {
                handleRemoveTire(draggedSourceWheelId);
                setDraggedSourceWheelId(null);
                setDraggedTireId(null);
              }
            }}
          >
            {/* Header Tray */}
            <div className="vs-tray-header">
              <div className="vs-tray-title-group">
                <span className="vs-tray-icon">🛞</span>
                <span className="vs-tray-title-text">Inventori Ban Unit</span>
                <span className="vs-tray-counter-badge">
                  {unassignedTiresCount} siap • {assignedCount}/{wheelCount} terpasang
                </span>
              </div>

              {assignedCount > 0 && (
                <button
                  type="button"
                  className="vs-detach-all-btn"
                  onClick={handleReset}
                  title="Lepas semua ban dari seluruh posisi roda unit ini"
                >
                  ↺ Lepas Semua
                </button>
              )}
            </div>

            {/* Filter Tabs & Panduan Drag */}
            <div className="vs-tray-controls">
              <div className="vs-filter-tabs">
                <button
                  type="button"
                  className={`vs-filter-tab ${trayFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTrayFilter('all')}
                >
                  Semua ({tires.length})
                </button>
                <button
                  type="button"
                  className={`vs-filter-tab ${trayFilter === 'ready' ? 'active' : ''}`}
                  onClick={() => setTrayFilter('ready')}
                >
                  Siap ({unassignedTiresCount})
                </button>
                <button
                  type="button"
                  className={`vs-filter-tab ${trayFilter === 'placed' ? 'active' : ''}`}
                  onClick={() => setTrayFilter('placed')}
                >
                  Terpasang ({assignedCount})
                </button>
              </div>

              <span className="vs-tray-hint-mini">
                🖐️ Tarik ban ke denah roda
              </span>
            </div>

            {/* List Kartu Ban */}
            <div className="vs-tray-list">
              {tires.length === 0 ? (
                <div className="vs-tray-empty">
                  {isLoading ? '⟳ Memuat data inventori ban...' : 'Tidak ada data ban terdaftar untuk unit ini.'}
                </div>
              ) : displayedTires.length === 0 ? (
                <div className="vs-tray-empty">
                  Tidak ada ban yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                displayedTires.map((ban) => {
                  const placedAtWheel = Object.entries(assignments).find(([_, bId]) => bId === ban.id)?.[0];
                  const placedMeta = placedAtWheel ? wheelConfig?.wheels.find((w) => w.id === placedAtWheel) : null;
                  const isDraggingThis = draggedTireId === ban.id;

                  return (
                    <div
                      key={ban.id}
                      draggable={true}
                      onDragStart={(e) => {
                        globalActiveDraggedBanId = ban.id;
                        e.dataTransfer.setData('text/plain', String(ban.id));
                        e.dataTransfer.effectAllowed = 'copyMove';
                        setDraggedTireId(ban.id);
                        setDraggedSourceWheelId(placedAtWheel || null);
                      }}
                      onDragEnd={() => {
                        setTimeout(() => {
                          globalActiveDraggedBanId = null;
                          setDraggedTireId(null);
                          setDraggedSourceWheelId(null);
                        }, 200);
                      }}
                      className={`vs-tire-card ${isDraggingThis ? 'vs-tire-card--dragging' : ''} ${
                        placedAtWheel ? 'vs-tire-card--assigned' : ''
                      }`}
                      title="Pegang & Tarik ban ini ke 3D atau denah unit"
                    >
                      <div className="vs-card-left">
                        <span className="vs-drag-handle" title="Tarik Ban">⠿</span>
                        <RealisticTireGraphic
                          ban={ban}
                          size={58}
                          isAssigned={Boolean(placedAtWheel)}
                          assignedCode={placedMeta?.code || (placedAtWheel ? placedAtWheel.toUpperCase() : null)}
                        />
                        <div className="vs-card-info">
                          <div className="vs-card-header-row">
                            <span className="vs-card-brand">{ban.merk}</span>
                            <span className="vs-card-serial-pill">#{ban.nomor_seri}</span>
                          </div>
                          <div className="vs-card-meta-row">
                            <span className="vs-card-spec">{ban.ukuran}</span>
                            <span className="vs-card-cond-pill">{ban.kondisi}</span>
                          </div>
                        </div>
                      </div>

                      <div className="vs-card-right">
                        {placedAtWheel ? (
                          <div className="vs-card-assigned-actions">
                            <span className="vs-status-badge vs-status-badge--placed">
                              ✓ [{placedMeta?.code || placedAtWheel.toUpperCase()}]
                            </span>
                            <button
                              type="button"
                              className="vs-detach-btn"
                              title="Lepas ban dari posisi roda ini"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTire(placedAtWheel);
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="vs-status-badge vs-status-badge--ready">
                            ⚪ Siap Pasang
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

