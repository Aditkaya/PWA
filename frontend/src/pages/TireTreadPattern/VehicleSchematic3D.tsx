import { useState, useEffect, useMemo, useRef } from 'react';
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
  isBorrowed?: boolean;
  borrowedMeta?: {
    donorUnitId: number | string;
    donorUnitName: string;
    donorCategory?: string;
    borrowedAt?: string;
  };
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
  isTouchOver?: boolean;
}

function Tire({
  cx,
  cy,
  id,
  type,
  label,
  isActive,
  isTouchOver = false,
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
      data-wheel-id={id}
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
      {(isActive || isDndOver || isTouchOver) && (
        <rect
          x={cx - rx - 5} y={cy - ry - 5}
          width={W + 10} height={H + 10}
          rx={8} ry={8}
          fill={(isDndOver || isTouchOver) ? 'rgba(16, 185, 129, 0.25)' : 'none'}
          stroke={(isDndOver || isTouchOver) ? '#10b981' : c.glow}
          strokeWidth={(isDndOver || isTouchOver) ? 3.0 : 2.5}
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
  onDropTire,
  touchTargetWheelId
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
  touchTargetWheelId?: string | null;
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
        isActive={selectedWheelId === 'w1'} isTouchOver={touchTargetWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={4} />
      <Tire cx={295} cy={steerY} id="w2" type="steer" label="FR"
        isActive={selectedWheelId === 'w2'} isTouchOver={touchTargetWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={4} />

      <Tire cx={56}  cy={driveY} id="w3" type="drive" label="RL-O"
        isActive={selectedWheelId === 'w3'} isTouchOver={touchTargetWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={3} />
      <Tire cx={96}  cy={driveY} id="w4" type="drive" label="RL-I"
        isActive={selectedWheelId === 'w4'} isTouchOver={touchTargetWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={17} />
      <Tire cx={284} cy={driveY} id="w5" type="drive" label="RR-I"
        isActive={selectedWheelId === 'w5'} isTouchOver={touchTargetWheelId === 'w5'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w5')} pillOffsetY={17} />
      <Tire cx={324} cy={driveY} id="w6" type="drive" label="RR-O"
        isActive={selectedWheelId === 'w6'} isTouchOver={touchTargetWheelId === 'w6'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w6')} pillOffsetY={3} />
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
  onDropTire,
  touchTargetWheelId
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
  touchTargetWheelId?: string | null;
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
        isActive={selectedWheelId === 'w1'} isTouchOver={touchTargetWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={3} />
      <Tire cx={96}  cy={a1Y} id="w2" type="trailer" label="A1-LI"
        isActive={selectedWheelId === 'w2'} isTouchOver={touchTargetWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={17} />
      <Tire cx={284} cy={a1Y} id="w3" type="trailer" label="A1-RI"
        isActive={selectedWheelId === 'w3'} isTouchOver={touchTargetWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={17} />
      <Tire cx={324} cy={a1Y} id="w4" type="trailer" label="A1-RO"
        isActive={selectedWheelId === 'w4'} isTouchOver={touchTargetWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={3} />

      <Tire cx={56}  cy={a2Y} id="w5" type="trailer" label="A2-LO"
        isActive={selectedWheelId === 'w5'} isTouchOver={touchTargetWheelId === 'w5'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w5')} pillOffsetY={3} />
      <Tire cx={96}  cy={a2Y} id="w6" type="trailer" label="A2-LI"
        isActive={selectedWheelId === 'w6'} isTouchOver={touchTargetWheelId === 'w6'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w6')} pillOffsetY={17} />
      <Tire cx={284} cy={a2Y} id="w7" type="trailer" label="A2-RI"
        isActive={selectedWheelId === 'w7'} isTouchOver={touchTargetWheelId === 'w7'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w7')} pillOffsetY={17} />
      <Tire cx={324} cy={a2Y} id="w8" type="trailer" label="A2-RO"
        isActive={selectedWheelId === 'w8'} isTouchOver={touchTargetWheelId === 'w8'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w8')} pillOffsetY={3} />
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
  onDropTire,
  touchTargetWheelId
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
  touchTargetWheelId?: string | null;
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
          isActive={selectedWheelId === `w${startIdx}`}   isTouchOver={touchTargetWheelId === `w${startIdx}`}   onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx}`)} pillOffsetY={3} />
        <Tire cx={96}  cy={ay} id={`w${startIdx+1}`} type="trailer" label={`${prefix}-LI`}
          isActive={selectedWheelId === `w${startIdx+1}`} isTouchOver={touchTargetWheelId === `w${startIdx+1}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+1}`)} pillOffsetY={17} />
        <Tire cx={284} cy={ay} id={`w${startIdx+2}`} type="trailer" label={`${prefix}-RI`}
          isActive={selectedWheelId === `w${startIdx+2}`} isTouchOver={touchTargetWheelId === `w${startIdx+2}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+2}`)} pillOffsetY={17} />
        <Tire cx={324} cy={ay} id={`w${startIdx+3}`} type="trailer" label={`${prefix}-RO`}
          isActive={selectedWheelId === `w${startIdx+3}`} isTouchOver={touchTargetWheelId === `w${startIdx+3}`} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire(`w${startIdx+3}`)} pillOffsetY={3} />
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
  onDropTire,
  touchTargetWheelId
}: {
  selectedWheelId?: string | null;
  onWheelClick?: (id: string) => void;
  getTire: (wheelId: string) => StockBanItem | null;
  onDropTire?: (wheelId: string, banId: number) => void;
  touchTargetWheelId?: string | null;
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
        isActive={selectedWheelId === 'w1'} isTouchOver={touchTargetWheelId === 'w1'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w1')} pillOffsetY={4} />
      <Tire cx={285} cy={frontY} id="w2" type="drive" label="FR"
        isActive={selectedWheelId === 'w2'} isTouchOver={touchTargetWheelId === 'w2'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w2')} pillOffsetY={4} />
      <Tire cx={105} cy={rearY}  id="w3" type="steer" label="RL"
        isActive={selectedWheelId === 'w3'} isTouchOver={touchTargetWheelId === 'w3'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w3')} pillOffsetY={4} />
      <Tire cx={275} cy={rearY}  id="w4" type="steer" label="RR"
        isActive={selectedWheelId === 'w4'} isTouchOver={touchTargetWheelId === 'w4'} onClick={onWheelClick} onDropTire={onDropTire} svgId={ID} tireData={getTire('w4')} pillOffsetY={4} />
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
   TIRE DETAIL MODAL (DETAIL LENGKAP DATA BAN TERPASANG)
   ═══════════════════════════════════════════════════════════════ */
export interface TireDetailModalProps {
  tire: StockBanItem;
  wheelMeta?: WheelMeta | null;
  wheelId?: string | null;
  onClose: () => void;
  onRemove?: () => void;
  onReturn?: () => void;
}

export function TireDetailModal({
  tire,
  wheelMeta,
  wheelId,
  onClose,
  onRemove,
  onReturn
}: TireDetailModalProps) {
  const wheelCode = wheelMeta?.code || (wheelId ? wheelId.toUpperCase() : null);
  const wheelName = wheelMeta?.name || (wheelId ? `Roda ${wheelId}` : 'Roda Unit');

  return (
    <div className="vs-modal-backdrop" onClick={onClose}>
      <div className="vs-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="vs-modal-header">
          <div className="vs-modal-title-group">
            <span className="vs-modal-icon">🛞</span>
            <div>
              <h3 className="vs-modal-title">Detail Data Ban Unit</h3>
              <span className="vs-modal-subtitle">
                {wheelCode ? `Posisi [${wheelCode}] • ${wheelName}` : 'Informasi Spesifikasi Ban'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="vs-modal-close-btn"
            onClick={onClose}
            title="Tutup Modal"
          >
            ✕
          </button>
        </div>

        <div className="vs-modal-body">
          {/* Hero Banner Kartu Ban */}
          <div className="vs-modal-hero">
            <RealisticTireGraphic
              ban={tire}
              size={76}
              isAssigned={true}
              assignedCode={wheelCode}
            />
            <div className="vs-modal-hero-info">
              <span className="vs-modal-hero-brand">{tire.merk || 'TIRE'}</span>
              <span className="vs-modal-hero-serial">#{tire.nomor_seri}</span>
              <div className="vs-modal-tags-row">
                <span className="vs-modal-tag vs-modal-tag--ok">
                  ✓ Terpasang di Unit
                </span>
                <span className="vs-modal-tag vs-modal-tag--info">
                  {tire.kondisi || 'Standar'}
                </span>
                {tire.isBorrowed && (
                  <span className="vs-modal-tag vs-modal-tag--amber">
                    🏷️ Pinjaman: {tire.borrowedMeta?.donorUnitName || 'Unit Lain'}
                  </span>
                )}
                {tire.status_masak && (
                  <span className="vs-modal-tag vs-modal-tag--amber">
                    Masak: {tire.status_masak}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Grid Rincian Data Ban */}
          <div className="vs-modal-grid">
            {tire.isBorrowed && (
              <div
                className="vs-modal-field"
                style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}
              >
                <span className="vs-modal-field-label" style={{ color: '#fbbf24' }}>
                  Status Kepemilikan Ban
                </span>
                <span className="vs-modal-field-value" style={{ color: '#fef08a' }}>
                  🏷️ Ban Pinjaman dari Unit: {tire.borrowedMeta?.donorUnitName || 'Unit Lain'}
                </span>
                {tire.borrowedMeta?.borrowedAt && (
                  <span style={{ fontSize: '0.68rem', color: '#fde68a', marginTop: '2px' }}>
                    Dipinjam pada: {new Date(tire.borrowedMeta.borrowedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </span>
                )}
              </div>
            )}

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Nomor Seri</span>
              <span className="vs-modal-field-value" style={{ color: '#34d399' }}>
                #{tire.nomor_seri}
              </span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Merk Ban</span>
              <span className="vs-modal-field-value">{tire.merk || '-'}</span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Ukuran / Dimensi</span>
              <span className="vs-modal-field-value">{tire.ukuran || '-'}</span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Kondisi Ban</span>
              <span className="vs-modal-field-value">{tire.kondisi || '-'}</span>
            </div>

            {wheelCode && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Posisi Terpasang</span>
                <span className="vs-modal-field-value" style={{ color: '#38bdf8' }}>
                  [{wheelCode}] {wheelName}
                </span>
              </div>
            )}

            {wheelMeta?.patternName && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Standar Pola Tapak</span>
                <span className="vs-modal-field-value" style={{ color: '#fbbf24' }}>
                  {wheelMeta.patternName}
                </span>
              </div>
            )}

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Status Masak (Vulkanisir)</span>
              <span className="vs-modal-field-value">{tire.status_masak || '-'}</span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Jumlah Masak</span>
              <span className="vs-modal-field-value">
                {tire.jumlah_masak != null ? `${tire.jumlah_masak} Kali` : '0 Kali'}
              </span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Status Ban Luar</span>
              <span className="vs-modal-field-value">{tire.status_ban_luar || '-'}</span>
            </div>

            <div className="vs-modal-field">
              <span className="vs-modal-field-label">Lokasi / Gudang</span>
              <span className="vs-modal-field-value">{tire.lokasi || '-'}</span>
            </div>

            {tire.nomor_faktur && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Nomor Faktur</span>
                <span className="vs-modal-field-value">{tire.nomor_faktur}</span>
              </div>
            )}

            {tire.nomor_bukti && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Nomor Bukti</span>
                <span className="vs-modal-field-value">{tire.nomor_bukti}</span>
              </div>
            )}

            {tire.tanggal_digunakan && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Tanggal Digunakan</span>
                <span className="vs-modal-field-value">{tire.tanggal_digunakan}</span>
              </div>
            )}

            {tire.tanggal_masuk && !tire.tanggal_digunakan && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Tanggal Masuk</span>
                <span className="vs-modal-field-value">{tire.tanggal_masuk}</span>
              </div>
            )}

            {tire.harga_beli && (
              <div className="vs-modal-field">
                <span className="vs-modal-field-label">Harga Beli</span>
                <span className="vs-modal-field-value" style={{ color: '#f59e0b' }}>
                  {typeof tire.harga_beli === 'number'
                    ? `Rp ${tire.harga_beli.toLocaleString('id-ID')}`
                    : `Rp ${Number(tire.harga_beli).toLocaleString('id-ID') || tire.harga_beli}`}
                </span>
              </div>
            )}

            {tire.keterangan && (
              <div className="vs-modal-field" style={{ gridColumn: '1 / -1' }}>
                <span className="vs-modal-field-label">Keterangan / Catatan</span>
                <span className="vs-modal-field-value" style={{ fontFamily: 'inherit', fontWeight: 500 }}>
                  {tire.keterangan}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="vs-modal-footer">
          {tire.isBorrowed && onReturn && (
            <button
              type="button"
              className="vs-return-btn"
              style={{ padding: '7px 14px', fontSize: '0.78rem' }}
              onClick={() => {
                onReturn();
                onClose();
              }}
              title="Kembalikan ban pinjaman ini ke unit asalnya"
            >
              ↩️ Kembalikan ke Unit Asal
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="vs-detach-btn"
              style={{ padding: '7px 14px', fontSize: '0.78rem' }}
              onClick={() => {
                onRemove();
                onClose();
              }}
              title="Copot ban ini dari posisi roda"
            >
              ✕ Copot Dari Roda
            </button>
          )}
          <button
            type="button"
            className="vs-3d-tool-btn"
            style={{
              padding: '7px 16px',
              fontSize: '0.78rem',
              background: 'rgba(56, 189, 248, 0.2)',
              borderColor: '#38bdf8',
              color: '#fff'
            }}
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BORROW TIRE MODAL (PINJAM BAN DARI UNIT SESAMA JENIS)
   ═══════════════════════════════════════════════════════════════ */
export interface BorrowTireModalProps {
  currentUnitId: number | string | null;
  category?: string;
  categoryLabel?: string;
  onClose: () => void;
  onBorrowTire: (tire: StockBanItem, donorUnit: { id: number | string; name: string }) => void;
  borrowedTireIds: number[];
}

export function BorrowTireModal({
  currentUnitId,
  category,
  categoryLabel,
  onClose,
  onBorrowTire,
  borrowedTireIds
}: BorrowTireModalProps) {
  const [donorUnits, setDonorUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState<boolean>(true);
  const [selectedDonorId, setSelectedDonorId] = useState<string | number | ''>('');
  const [donorTires, setDonorTires] = useState<StockBanItem[]>([]);
  const [isLoadingTires, setIsLoadingTires] = useState<boolean>(false);
  const [searchUnit, setSearchUnit] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Ambil daftar unit sesama kategori
  useEffect(() => {
    if (!category) return;
    setIsLoadingUnits(true);
    fetch(`/api/tire-tread/units?category=${category}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success' && Array.isArray(json.data)) {
          const filtered = json.data.filter((u: any) => String(u.id) !== String(currentUnitId));
          setDonorUnits(filtered);
          if (filtered.length > 0) {
            setSelectedDonorId(filtered[0].id);
          }
        }
      })
      .catch((err) => console.error('Error fetching donor units:', err))
      .finally(() => setIsLoadingUnits(false));
  }, [category, currentUnitId]);

  // 2. Ambil daftar ban dari unit donor yang dipilih
  useEffect(() => {
    if (!selectedDonorId) {
      setDonorTires([]);
      return;
    }
    setIsLoadingTires(true);
    const q = category === 'forklift'
      ? `alat_berat_id=${encodeURIComponent(String(selectedDonorId))}`
      : `mobil_id=${encodeURIComponent(String(selectedDonorId))}`;

    fetch(`/api/tire-tread/tires?${q}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success' && Array.isArray(json.data)) {
          setDonorTires(json.data);
        } else {
          setDonorTires([]);
        }
      })
      .catch((err) => console.error('Error fetching donor tires:', err))
      .finally(() => setIsLoadingTires(false));
  }, [selectedDonorId, category]);

  const currentDonorUnit = useMemo(() => {
    return donorUnits.find((u) => String(u.id) === String(selectedDonorId)) || null;
  }, [donorUnits, selectedDonorId]);

  const donorUnitDisplayName = useMemo(() => {
    if (!currentDonorUnit) return 'Unit Donor';
    return (
      currentDonorUnit.nomor_polisi ||
      currentDonorUnit.kode_no ||
      currentDonorUnit.kode_alat ||
      currentDonorUnit.nama ||
      `Unit #${currentDonorUnit.id}`
    );
  }, [currentDonorUnit]);

  const filteredDonorUnits = useMemo(() => {
    if (!searchUnit) return donorUnits;
    const q = searchUnit.toLowerCase();
    return donorUnits.filter((u) => {
      const code = (u.kode_no || u.kode_alat || '').toLowerCase();
      const nopol = (u.nomor_polisi || '').toLowerCase();
      const nama = (u.nama || '').toLowerCase();
      const jenis = (u.jenis || '').toLowerCase();
      return code.includes(q) || nopol.includes(q) || nama.includes(q) || jenis.includes(q);
    });
  }, [donorUnits, searchUnit]);

  const handleBorrow = (tire: StockBanItem) => {
    onBorrowTire(tire, {
      id: selectedDonorId,
      name: donorUnitDisplayName
    });
    setSuccessToast(`✓ Ban #${tire.nomor_seri} (${tire.merk}) berhasil dipinjam!`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 2800);
  };

  return (
    <div className="vs-modal-backdrop" onClick={onClose}>
      <div className="vs-modal-card vs-borrow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vs-modal-header">
          <div className="vs-modal-title-group">
            <span className="vs-modal-icon">🔄</span>
            <div>
              <h3 className="vs-modal-title">Pinjam Ban Sesama Jenis</h3>
              <span className="vs-modal-subtitle">
                {categoryLabel ? `Armada ${categoryLabel}` : 'Inter-Unit Tire Borrowing'}
              </span>
            </div>
          </div>
          <button type="button" className="vs-modal-close-btn" onClick={onClose} title="Tutup">
            ✕
          </button>
        </div>

        <div className="vs-modal-body">
          {successToast && (
            <div className="vs-borrow-toast">
              <span>{successToast}</span>
            </div>
          )}

          {/* Section 1: Pilih Unit Donor */}
          <div className="vs-borrow-donor-selector">
            <div className="vs-borrow-section-title">
              <span>1. Pilih Unit Donor (Sumber Peminjaman)</span>
              <span className="vs-borrow-badge-count">{donorUnits.length} Unit Tersedia</span>
            </div>

            {isLoadingUnits ? (
              <div className="vs-borrow-loading">⟳ Memuat daftar unit sesama armada...</div>
            ) : donorUnits.length === 0 ? (
              <div className="vs-borrow-empty">Tidak ada unit lain dalam kategori ini untuk dipinjamkan.</div>
            ) : (
              <div className="vs-borrow-select-wrap">
                <input
                  type="text"
                  placeholder="Cari plat nomor / kode unit..."
                  value={searchUnit}
                  onChange={(e) => setSearchUnit(e.target.value)}
                  className="vs-borrow-search-input"
                />
                <select
                  value={selectedDonorId}
                  onChange={(e) => setSelectedDonorId(e.target.value)}
                  className="vs-borrow-select"
                >
                  {filteredDonorUnits.map((u) => {
                    const label = `${u.nomor_polisi ? u.nomor_polisi + ' • ' : ''}${u.kode_no || u.kode_alat || ''} (${u.jenis || u.merek || 'Armada'}${u.lokasi ? ' - ' + u.lokasi : ''})`;
                    return (
                      <option key={u.id} value={u.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Daftar Ban Unit Donor */}
          <div className="vs-borrow-tires-section">
            <div className="vs-borrow-section-title">
              <span>2. Pilih Ban dari Unit: <strong>{donorUnitDisplayName}</strong></span>
              <span className="vs-borrow-badge-count">{donorTires.length} Ban</span>
            </div>

            {isLoadingTires ? (
              <div className="vs-borrow-loading">⟳ Memuat data ban unit donor...</div>
            ) : donorTires.length === 0 ? (
              <div className="vs-borrow-empty">
                Unit <strong>{donorUnitDisplayName}</strong> belum memiliki ban aktif terdaftar.
              </div>
            ) : (
              <div className="vs-borrow-tires-list">
                {donorTires.map((tire) => {
                  const isAlreadyBorrowed = borrowedTireIds.includes(tire.id);
                  return (
                    <div
                      key={tire.id}
                      className={`vs-borrow-tire-item ${isAlreadyBorrowed ? 'is-borrowed' : ''}`}
                    >
                      <div className="vs-borrow-tire-left">
                        <RealisticTireGraphic ban={tire} size={50} />
                        <div className="vs-borrow-tire-info">
                          <div className="vs-borrow-tire-top">
                            <span className="vs-card-brand">{tire.merk}</span>
                            <span className="vs-card-serial-pill">#{tire.nomor_seri}</span>
                          </div>
                          <div className="vs-borrow-tire-meta">
                            <span>{tire.ukuran}</span>
                            <span className="vs-card-cond-pill">{tire.kondisi}</span>
                            {tire.status_masak && (
                              <span className="vs-borrow-masak-pill">Masak: {tire.status_masak}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="vs-borrow-tire-right">
                        {isAlreadyBorrowed ? (
                          <span className="vs-borrow-status-badge">
                            ✓ Sedang Dipinjam
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="vs-borrow-btn-action"
                            onClick={() => handleBorrow(tire)}
                            title={`Pinjam ban #${tire.nomor_seri} ke unit saat ini`}
                          >
                            📥 Pinjam Ban
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="vs-modal-footer">
          <div style={{ flex: 1, fontSize: '0.74rem', color: '#94a3b8' }}>
            {borrowedTireIds.length > 0
              ? `🏷️ ${borrowedTireIds.length} ban saat ini berstatus pinjaman di unit ini.`
              : 'Ban yang dipinjam akan otomatis muncul di inventori unit saat ini.'}
          </div>
          <button
            type="button"
            className="vs-3d-tool-btn"
            style={{
              padding: '7px 18px',
              fontSize: '0.8rem',
              background: 'rgba(56, 189, 248, 0.2)',
              borderColor: '#38bdf8',
              color: '#fff'
            }}
            onClick={onClose}
          >
            Selesai
          </button>
        </div>
      </div>
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

  // Key penyimpanan ban pinjaman antar-unit sesama jenis
  const borrowedStorageKey = activeMobilId
    ? `tire_borrowed_mobil_${activeMobilId}`
    : activeAlatBeratId
      ? `tire_borrowed_alat_${activeAlatBeratId}`
      : null;

  const userExplicitlyResetRef = useRef<boolean>(false);

  // State mapping roda -> stockBanId (awalannya memuat yang tersimpan jika ada)
  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    if (!storageKey) return {};
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
      return {};
    } catch {
      return {};
    }
  });

  // Saat unit berubah, muat mapping yang tersimpan dan reset flag lepas
  useEffect(() => {
    userExplicitlyResetRef.current = false;
    if (!storageKey) {
      setAssignments({});
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setAssignments(parsed);
          return;
        }
      }
      setAssignments({});
    } catch {
      setAssignments({});
    }
  }, [storageKey]);

  // State ban pinjaman antar-unit sesama jenis
  const [borrowedTires, setBorrowedTires] = useState<StockBanItem[]>(() => {
    if (!borrowedStorageKey) return [];
    try {
      const saved = localStorage.getItem(borrowedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!borrowedStorageKey) {
      setBorrowedTires([]);
      return;
    }
    try {
      const saved = localStorage.getItem(borrowedStorageKey);
      setBorrowedTires(saved ? JSON.parse(saved) : []);
    } catch {
      setBorrowedTires([]);
    }
  }, [borrowedStorageKey]);

  const saveBorrowedTires = (nextBorrowed: StockBanItem[]) => {
    setBorrowedTires(nextBorrowed);
    if (borrowedStorageKey) {
      try {
        localStorage.setItem(borrowedStorageKey, JSON.stringify(nextBorrowed));
      } catch (e) {
        console.error('Error saving borrowed tires:', e);
      }
    }
  };

  // Status Sinkronisasi Database MySQL: 'synced' | 'saving' | 'error' | 'idle'
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'saving' | 'error' | 'idle'>('idle');

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

  // Muat posisi ban terpasang dari database MySQL saat unit dipilih
  useEffect(() => {
    if (!activeMobilId && !activeAlatBeratId) return;

    let isMounted = true;
    const q = activeMobilId
      ? `mobil_id=${encodeURIComponent(String(activeMobilId))}`
      : `alat_berat_id=${encodeURIComponent(String(activeAlatBeratId))}`;

    fetch(`/api/tire-tread/installations?${q}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        if (json.status === 'success' && json.data) {
          const dbAssigns: Record<string, number> = json.data.assignments || {};
          // Jika ada record terpasang di database, gunakan data DB dan sinkronkan localStorage
          if (Object.keys(dbAssigns).length > 0) {
            setAssignments(dbAssigns);
            if (storageKey) {
              try {
                localStorage.setItem(storageKey, JSON.stringify(dbAssigns));
              } catch {}
            }
          }
          // Jika ada ban pinjaman yang terdaftar di database untuk unit ini, sinkronkan ke borrowedTires
          if (Array.isArray(json.data.borrowed) && json.data.borrowed.length > 0) {
            setBorrowedTires((prev) => {
              const merged = [...prev];
              json.data.borrowed.forEach((bt: StockBanItem) => {
                if (!merged.some((m) => m.id === bt.id)) {
                  merged.push(bt);
                }
              });
              if (borrowedStorageKey) {
                try {
                  localStorage.setItem(borrowedStorageKey, JSON.stringify(merged));
                } catch {}
              }
              return merged;
            });
          }
          setDbSyncStatus('synced');
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Gagal memuat instalasi ban dari database:', err);
          setDbSyncStatus('idle');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeMobilId, activeAlatBeratId, storageKey, borrowedStorageKey]);

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
          let list: StockBanItem[] = [];
          if (json.status === 'success' && Array.isArray(json.data)) {
            list = [...json.data];
          }

          // Pastikan jumlah ban terdaftar mencukupi seluruh roda unit agar defaultnya terpasang penuh
          const targetCount = wheelConfig?.wheels?.length || wheelCount;
          if (list.length < targetCount) {
            const needed = targetCount - list.length;
            const defaultBrand = category === 'forklift' ? 'GITI' : 'BRIDGESTONE';
            const defaultSpec = category === 'forklift' ? '28x9-15' : '11.00R20 16PR';
            const unitPrefix = activeMobilId ? `M${activeMobilId}` : activeAlatBeratId ? `AB${activeAlatBeratId}` : 'U';

            for (let i = 0; i < needed; i++) {
              const tireIdx = list.length + 1;
              list.push({
                id: (Number(activeMobilId || activeAlatBeratId || 1) * 1000) + tireIdx,
                nomor_seri: `BS-${unitPrefix}-${tireIdx.toString().padStart(2, '0')}`,
                merk: defaultBrand,
                ukuran: defaultSpec,
                kondisi: 'Original (Bagus)',
                status: 'Terpakai',
                mobil_id: activeMobilId ? Number(activeMobilId) : null,
                alat_berat_id: activeAlatBeratId ? Number(activeAlatBeratId) : null,
                lokasi: 'Unit Operasional'
              });
            }
          }

          setTires(list);
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



  // State Modal Pinjam Ban Antar-Unit
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState<boolean>(false);

  // Gabungan ban unit asli + ban yang sedang dipinjam
  const allTires = useMemo(() => {
    const list = [...tires];
    borrowedTires.forEach((bt) => {
      if (!list.some((t) => t.id === bt.id)) {
        list.push(bt);
      }
    });
    return list;
  }, [tires, borrowedTires]);

  // Pasangkan seluruh ban ke setiap posisi roda secara default jika belum ada mapping tersimpan
  useEffect(() => {
    const wheels = wheelConfig?.wheels;
    if (!wheels || wheels.length === 0 || allTires.length === 0) return;
    if (userExplicitlyResetRef.current) return;

    setAssignments((prev) => {
      // Jika sudah ada ban yang terpasang, pertahankan
      if (Object.keys(prev).length > 0) return prev;

      const defaultAssigns: Record<string, number> = {};
      wheels.forEach((w, idx) => {
        if (allTires[idx]) {
          defaultAssigns[w.id] = allTires[idx].id;
        }
      });

      if (Object.keys(defaultAssigns).length > 0 && storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(defaultAssigns));
        } catch {}
      }
      return defaultAssigns;
    });
  }, [wheelConfig, allTires, storageKey]);

  // State modal detail ban untuk Blueprint 2D & list tray
  const [blueprintDetailTire, setBlueprintDetailTire] = useState<{ tire: StockBanItem; wheelId: string } | null>(null);

  // Handler pinjam ban dari unit donor
  const handleBorrowTire = (tire: StockBanItem, donorUnit: { id: number | string; name: string }) => {
    const newBorrowed: StockBanItem = {
      ...tire,
      isBorrowed: true,
      borrowedMeta: {
        donorUnitId: donorUnit.id,
        donorUnitName: donorUnit.name,
        donorCategory: category || 'unit',
        borrowedAt: new Date().toISOString()
      }
    };
    const nextList = [...borrowedTires.filter((t) => t.id !== tire.id), newBorrowed];
    saveBorrowedTires(nextList);
  };

  // Handler kembalikan ban pinjaman ke unit asalnya
  const handleReturnTire = (tireId: number) => {
    // 1. Lepas dari dudukan roda jika sedang terpasang di salah satu roda
    const nextAssigns = { ...assignments };
    let changed = false;
    let removedWheelId: string | null = null;
    for (const [wKey, bVal] of Object.entries(nextAssigns)) {
      if (bVal === tireId) {
        delete nextAssigns[wKey];
        changed = true;
        removedWheelId = wKey;
      }
    }
    if (changed) {
      saveAssignments(nextAssigns);
      if (removedWheelId) {
        fetch('/api/tire-tread/installations/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobil_id: activeMobilId,
            alat_berat_id: activeAlatBeratId,
            wheel_id: removedWheelId
          })
        }).catch(() => {});
      }
    }

    // 2. Hapus dari daftar ban pinjaman
    const nextBorrowed = borrowedTires.filter((t) => t.id !== tireId);
    saveBorrowedTires(nextBorrowed);

    // 3. Jika sedang dibuka di modal detail blueprint, tutup
    if (blueprintDetailTire?.tire.id === tireId) {
      setBlueprintDetailTire(null);
    }
  };

  // Mencari ban yang terpasang pada suatu posisi roda
  const getTireForWheel = (wheelId: string): StockBanItem | null => {
    const banId = assignments[wheelId];
    if (!banId) return null;
    return allTires.find((t) => t.id === banId) || null;
  };

  // Handler klik roda pada diagram atau saat memilih posisi dari dropdown
  const handleSelectWheel = (wheelId: string) => {
    setInternalWheelId(wheelId);
    const tire = getTireForWheel(wheelId);
    onWheelClick?.(wheelId, tire);
    if (tire && viewMode === 'blueprint') {
      setBlueprintDetailTire({ tire, wheelId });
    }
  };

  // Pasang ban tertentu ke posisi roda dan simpan ke database
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

    const assignedTire = allTires.find((t) => t.id === banId) || null;
    const wheelMeta = wheelConfig?.wheels.find((w) => w.id === wheelId);
    setInternalWheelId(wheelId);
    onWheelClick?.(wheelId, assignedTire);

    // Kirim mutasi simpan ke database MySQL
    setDbSyncStatus('saving');
    fetch('/api/tire-tread/installations/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobil_id: activeMobilId,
        alat_berat_id: activeAlatBeratId,
        category,
        wheel_id: wheelId,
        wheel_code: wheelMeta?.code || wheelId.toUpperCase(),
        wheel_name: wheelMeta?.name || `Roda ${wheelId}`,
        stock_ban_id: banId,
        nomor_seri: assignedTire?.nomor_seri,
        merk: assignedTire?.merk,
        ukuran: assignedTire?.ukuran,
        kondisi: assignedTire?.kondisi,
        is_borrowed: assignedTire?.isBorrowed ? 1 : 0,
        donor_unit_id: assignedTire?.borrowedMeta?.donorUnitId || null,
        donor_unit_name: assignedTire?.borrowedMeta?.donorUnitName || null,
        donor_category: assignedTire?.borrowedMeta?.donorCategory || null,
        borrowed_at: assignedTire?.borrowedMeta?.borrowedAt || null
      })
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success') {
          setDbSyncStatus('synced');
        } else {
          setDbSyncStatus('error');
        }
      })
      .catch((err) => {
        console.warn('Gagal menyimpan posisi ban ke database:', err);
        setDbSyncStatus('error');
      });
  };

  // Lepas ban dari posisi roda dan hapus dari database
  const handleRemoveTire = (wheelId: string) => {
    const nextAssigns = { ...assignments };
    delete nextAssigns[wheelId];
    saveAssignments(nextAssigns);
    onWheelClick?.(wheelId, null);

    // Hapus dari database MySQL
    setDbSyncStatus('saving');
    fetch('/api/tire-tread/installations/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobil_id: activeMobilId,
        alat_berat_id: activeAlatBeratId,
        wheel_id: wheelId
      })
    })
      .then((res) => res.json())
      .then(() => setDbSyncStatus('synced'))
      .catch((err) => {
        console.warn('Gagal mencopot ban dari database:', err);
        setDbSyncStatus('error');
      });
  };

  // Reset/Kosongkan seluruh posisi roda pada unit di database
  const handleReset = () => {
    userExplicitlyResetRef.current = true;
    saveAssignments({});
    onWheelClick?.(activeWheelId, null);

    setDbSyncStatus('saving');
    fetch('/api/tire-tread/installations/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobil_id: activeMobilId,
        alat_berat_id: activeAlatBeratId
      })
    })
      .then((res) => res.json())
      .then(() => setDbSyncStatus('synced'))
      .catch((err) => {
        console.warn('Gagal mengosongkan ban di database:', err);
        setDbSyncStatus('error');
      });
  };

  // Filter tray kartu ban: 'ready' | 'placed' | 'all' (default 'ready' agar ban yang terpasang otomatis hilang dari daftar inventori)
  const [trayFilter, setTrayFilter] = useState<'ready' | 'placed' | 'all'>('ready');

  const assignedCount = Object.keys(assignments).length;
  const unassignedTiresCount = allTires.filter((t) => !Object.values(assignments).includes(t.id)).length;

  // Filtered tires for tray display
  const displayedTires = allTires.filter((ban) => {
    const isPlaced = Object.values(assignments).includes(ban.id);
    if (trayFilter === 'ready') return !isPlaced;
    if (trayFilter === 'placed') return isPlaced;
    return true;
  });

  // Virtual Touch Drag & Drop (Mencegah kotak hitam & badge (+) OS Android di layar HP)
  const [touchDraggingTire, setTouchDraggingTire] = useState<StockBanItem | null>(null);
  const [touchCoords, setTouchCoords] = useState<{ x: number; y: number } | null>(null);
  const [touchTargetWheelId, setTouchTargetWheelId] = useState<string | null>(null);

  const touchDraggingTireRef = useRef<StockBanItem | null>(null);
  const touchCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const touchTargetWheelIdRef = useRef<string | null>(null);

  const handleTouchStart = (ban: StockBanItem, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const coords = { x: touch.clientX, y: touch.clientY };
    setTouchDraggingTire(ban);
    setTouchCoords(coords);
    touchDraggingTireRef.current = ban;
    touchCoordsRef.current = coords;

    if (navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch {}
    }
  };

  useEffect(() => {
    if (!touchDraggingTire) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      if (e.cancelable) {
        e.preventDefault(); // Mencegah scrolling layar saat sedang mendrag ban
      }
      const touch = e.touches[0];
      const coords = { x: touch.clientX, y: touch.clientY };
      setTouchCoords(coords);
      touchCoordsRef.current = coords;

      if (viewMode === 'blueprint') {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const wheelEl = el?.closest('[data-wheel-id]');
        const wheelId = wheelEl?.getAttribute('data-wheel-id') || null;
        setTouchTargetWheelId(wheelId);
        touchTargetWheelIdRef.current = wheelId;
      }
    };

    const handleTouchEnd = () => {
      const currentTire = touchDraggingTireRef.current;
      const targetWheel = touchTargetWheelIdRef.current;

      if (currentTire && targetWheel) {
        handleAssignTire(targetWheel, currentTire.id);
        if (navigator.vibrate) {
          try {
            navigator.vibrate([30, 50, 30]);
          } catch {}
        }
      }

      setTouchDraggingTire(null);
      setTouchCoords(null);
      setTouchTargetWheelId(null);
      touchDraggingTireRef.current = null;
      touchCoordsRef.current = null;
      touchTargetWheelIdRef.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [touchDraggingTire, viewMode]);

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
                <span>3D</span>
              </button>
              <button
                type="button"
                className={`vs-mode-btn ${viewMode === 'blueprint' ? 'vs-mode-btn--active' : ''}`}
                onClick={() => setViewMode('blueprint')}
              >
                <span>2D</span>
              </button>
            </div>

            {/* Status Unit & Legend Indikator */}
            <div className="vs-stage-status-group">
              <div className="vs-status-pill-wrap">
                {errorMsg ? (
                  <span className="vs-status-pill vs-status-pill--warn">⚠ {errorMsg}</span>
                ) : isLoading ? (
                  <span className="vs-status-pill vs-status-pill--loading">⟳ Memuat...</span>
                ) : assignedCount >= wheelCount ? (
                  <span className="vs-status-pill vs-status-pill--ok">✓ {assignedCount}/{wheelCount}</span>
                ) : assignedCount > 0 ? (
                  <span className="vs-status-pill vs-status-pill--warn">● {assignedCount}/{wheelCount}</span>
                ) : (
                  <span className="vs-status-pill vs-status-pill--neutral">⚪ 0/{wheelCount}</span>
                )}

                {/* Status Persistensi Database MySQL */}
                {dbSyncStatus === 'saving' ? (
                  <span className="vs-status-pill vs-status-pill--loading" title="Menyimpan perubahan posisi ban ke database MySQL">
                    ☁️ ⟳ Simpan...
                  </span>
                ) : dbSyncStatus === 'synced' && assignedCount > 0 ? (
                  <span className="vs-status-pill vs-status-pill--ok" title="Tersimpan permanen di database MySQL">
                    ☁️ DB ✓
                  </span>
                ) : dbSyncStatus === 'error' ? (
                  <span className="vs-status-pill vs-status-pill--warn" title="Gagal tersambung ke database, data disimpan lokal">
                    ☁️ ⚠ Offline
                  </span>
                ) : null}
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
                onRemoveTireFromWheel={handleRemoveTire}
                onReturnBorrowedTire={handleReturnTire}
                draggedTireId={draggedTireId || touchDraggingTire?.id || null}
                touchCoords={touchCoords}
                onTargetWheelChange={(wId) => {
                  setTouchTargetWheelId(wId);
                  touchTargetWheelIdRef.current = wId;
                }}
              />
            ) : (
              <div className="vs-container">
                {wheelCount === 6 && (
                  <Schema6Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} touchTargetWheelId={touchTargetWheelId} />
                )}
                {wheelCount === 8 && (
                  <Schema8Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} touchTargetWheelId={touchTargetWheelId} />
                )}
                {wheelCount === 12 && (
                  <Schema12Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} touchTargetWheelId={touchTargetWheelId} />
                )}
                {wheelCount === 4 && (
                  <Schema4Roda selectedWheelId={activeWheelId} onWheelClick={handleSelectWheel} getTire={getTireForWheel} onDropTire={handleAssignTire} touchTargetWheelId={touchTargetWheelId} />
                )}

                {/* Status Bar untuk Blueprint 2D */}
                {activeWheelId && (
                  <div className="vs-3d-status-bar" style={{ marginTop: '12px' }}>
                    <div className="vs-3d-wheel-tag">
                      <div className="vs-3d-tag-left">
                        <span className="vs-3d-code-pill">
                          {wheelConfig?.wheels.find((w) => w.id === activeWheelId)?.code || activeWheelId.toUpperCase()}
                        </span>
                        <span className="vs-3d-wheel-title">
                          {wheelConfig?.wheels.find((w) => w.id === activeWheelId)?.name || `Roda ${activeWheelId}`}
                        </span>
                      </div>

                      <div className="vs-3d-tag-right">
                        {getTireForWheel(activeWheelId) ? (
                          <div className="vs-3d-assigned-actions">
                            <span
                              className="vs-3d-tire-pill vs-3d-tire-pill--ok vs-3d-tire-pill--clickable"
                              onClick={() => {
                                const t = getTireForWheel(activeWheelId);
                                if (t) setBlueprintDetailTire({ tire: t, wheelId: activeWheelId });
                              }}
                              title="Klik untuk detail data ban"
                            >
                              ✓ #{getTireForWheel(activeWheelId)?.nomor_seri} ({getTireForWheel(activeWheelId)?.merk})
                            </span>
                            <button
                              type="button"
                              className="vs-detach-btn vs-detach-btn--pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTire(activeWheelId);
                              }}
                              title="Copot ban"
                            >
                              ✕ Copot
                            </button>
                          </div>
                        ) : (
                          <span className="vs-3d-tire-pill vs-3d-tire-pill--empty">
                            ⚪ Kosong
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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
                <span className="vs-tray-title-text">Stok Ban</span>
                <span className="vs-tray-counter-badge">
                  {unassignedTiresCount} Siap • {assignedCount}/{wheelCount} Terpasang
                </span>
                {borrowedTires.length > 0 && (
                  <span className="vs-tray-borrowed-pill" title={`${borrowedTires.length} ban pinjaman dari unit sesama armada`}>
                    🏷️ {borrowedTires.length} Pinjaman
                  </span>
                )}
              </div>

              <div className="vs-tray-actions-group">
                <button
                  type="button"
                  className="vs-borrow-trigger-btn"
                  onClick={() => setIsBorrowModalOpen(true)}
                  title="Pinjam ban dari unit lain"
                >
                  <span>🔄</span>
                  <span>Pinjam</span>
                </button>

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
            </div>

            {/* Filter Tabs */}
            <div className="vs-tray-controls">
              <div className="vs-filter-tabs">
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
                <button
                  type="button"
                  className={`vs-filter-tab ${trayFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTrayFilter('all')}
                >
                  Semua ({allTires.length})
                </button>
              </div>
            </div>

            {/* List Kartu Ban */}
            <div className="vs-tray-list">
              {allTires.length === 0 ? (
                <div className="vs-tray-empty">
                  {isLoading ? '⟳ Memuat data...' : 'Tidak ada data ban.'}
                </div>
              ) : displayedTires.length === 0 ? (
                <div className="vs-tray-empty">
                  {trayFilter === 'ready' && assignedCount > 0 ? (
                    <div className="vs-tray-empty-success">
                      <span>✓ Semua ban ({assignedCount}) sudah terpasang</span>
                    </div>
                  ) : (
                    'Tidak ada ban dalam filter ini.'
                  )}
                </div>
              ) : (
                displayedTires.map((ban) => {
                  const placedAtWheel = Object.entries(assignments).find(([_, bId]) => bId === ban.id)?.[0];
                  const placedMeta = placedAtWheel ? wheelConfig?.wheels.find((w) => w.id === placedAtWheel) : null;
                  const isDraggingThis = draggedTireId === ban.id || touchDraggingTire?.id === ban.id;

                  return (
                    <div
                      key={ban.id}
                      draggable={true}
                      onDragStart={(e) => {
                        // Jika sedang aktif touch drag di layar HP, batalkan HTML5 drag bawaan agar tidak muncul kotak hitam & badge (+) dari OS Android
                        if (touchDraggingTireRef.current) {
                          e.preventDefault();
                          return;
                        }
                        globalActiveDraggedBanId = ban.id;
                        e.dataTransfer.setData('text/plain', String(ban.id));
                        e.dataTransfer.effectAllowed = 'copyMove';
                        setDraggedTireId(ban.id);
                        setDraggedSourceWheelId(placedAtWheel || null);

                        const graphicEl = e.currentTarget.querySelector('.vs-tire-graphic-wrap') as HTMLElement;
                        if (graphicEl && e.dataTransfer.setDragImage) {
                          const w = graphicEl.offsetWidth || 58;
                          const h = graphicEl.offsetHeight || 58;
                          e.dataTransfer.setDragImage(graphicEl, w / 2, h / 2);
                        }
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
                        <span
                          className="vs-drag-handle"
                          title="Tarik Ban ke Roda (Sentuh & Geser)"
                          onTouchStart={(e) => handleTouchStart(ban, e)}
                        >
                          ⠿
                        </span>
                        <div
                          className="vs-tire-touch-trigger"
                          title="Sentuh & Geser gambar ban ke unit"
                          onTouchStart={(e) => handleTouchStart(ban, e)}
                        >
                          <RealisticTireGraphic
                            ban={ban}
                            size={58}
                            isAssigned={Boolean(placedAtWheel)}
                            assignedCode={placedMeta?.code || (placedAtWheel ? placedAtWheel.toUpperCase() : null)}
                          />
                        </div>
                        <div className="vs-card-info">
                          <div className="vs-card-header-row">
                            <span className="vs-card-brand">{ban.merk}</span>
                            <span className="vs-card-serial-pill">#{ban.nomor_seri}</span>
                            {ban.isBorrowed && (
                              <span
                                className="vs-borrowed-tag"
                                title={`Dipinjam dari unit ${ban.borrowedMeta?.donorUnitName || 'lain'}`}
                              >
                                🏷️ Pinjam: {ban.borrowedMeta?.donorUnitName || 'Unit Lain'}
                              </span>
                            )}
                          </div>
                          <div className="vs-card-meta-row">
                            <span className="vs-card-spec">{ban.ukuran}</span>
                            <span className="vs-card-cond-pill">{ban.kondisi}</span>
                            {ban.isBorrowed && (
                              <button
                                type="button"
                                className="vs-return-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReturnTire(ban.id);
                                }}
                                title={`Kembalikan ban ini ke ${ban.borrowedMeta?.donorUnitName || 'unit asal'}`}
                              >
                                ↩️ Kembalikan
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="vs-card-right">
                        {placedAtWheel ? (
                          <div className="vs-card-assigned-actions">
                            <span
                              className="vs-status-badge vs-status-badge--placed"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBlueprintDetailTire({ tire: ban, wheelId: placedAtWheel });
                              }}
                              style={{ cursor: 'pointer' }}
                              title="Klik untuk melihat detail data ban"
                            >
                              ✓ [{placedMeta?.code || placedAtWheel.toUpperCase()}]
                            </span>
                            <button
                              type="button"
                              className="vs-detach-btn vs-detach-btn--pill"
                              title="Copot ban dari posisi roda ini dan kembalikan ke inventori"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTire(placedAtWheel);
                              }}
                            >
                              ✕ Copot
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="vs-status-badge vs-status-badge--ready vs-btn-quick-assign"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeWheelId) {
                                handleAssignTire(activeWheelId, ban.id);
                              }
                            }}
                            title={`Klik untuk pasang langsung ke roda [${wheelConfig?.wheels.find((w) => w.id === activeWheelId)?.code || activeWheelId.toUpperCase()}]`}
                          >
                            ⚪ Siap Pasang
                          </button>
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

      {/* ── MODAL DETAIL BAN UNTUK BLUEPRINT 2D & TRAY ── */}
      {blueprintDetailTire && (
        <TireDetailModal
          tire={blueprintDetailTire.tire}
          wheelId={blueprintDetailTire.wheelId}
          wheelMeta={wheelConfig?.wheels.find((w) => w.id === blueprintDetailTire.wheelId) || null}
          onClose={() => setBlueprintDetailTire(null)}
          onRemove={() => {
            if (blueprintDetailTire.wheelId) {
              handleRemoveTire(blueprintDetailTire.wheelId);
            }
          }}
          onReturn={() => {
            handleReturnTire(blueprintDetailTire.tire.id);
            setBlueprintDetailTire(null);
          }}
        />
      )}

      {/* ── MODAL PINJAM BAN ANTAR-UNIT SESAMA JENIS ── */}
      {isBorrowModalOpen && (
        <BorrowTireModal
          currentUnitId={activeMobilId || activeAlatBeratId || null}
          category={category}
          categoryLabel={
            category === 'tractor-head'
              ? 'Tractor Head'
              : category === 'chassis-container'
              ? 'Chassis Container'
              : category === 'forklift'
              ? 'Forklift'
              : undefined
          }
          onClose={() => setIsBorrowModalOpen(false)}
          onBorrowTire={handleBorrowTire}
          borrowedTireIds={borrowedTires.map((t) => t.id)}
        />
      )}

      {/* ── FLOATING TOUCH TIRE (DRAG AND DROP LAYAR SENTUH HP) ── */}
      {touchDraggingTire && touchCoords && (
        <div
          className="vs-floating-touch-tire"
          style={{
            left: `${touchCoords.x}px`,
            top: `${touchCoords.y}px`
          }}
        >
          <RealisticTireGraphic
            ban={touchDraggingTire}
            size={76}
            isAssigned={Boolean(touchTargetWheelId)}
            assignedCode={
              touchTargetWheelId
                ? wheelConfig?.wheels.find((w) => w.id === touchTargetWheelId)?.code || touchTargetWheelId.toUpperCase()
                : null
            }
          />
          <div className="vs-floating-touch-label">
            <span className="vs-floating-touch-brand">{touchDraggingTire.merk}</span>
            {touchTargetWheelId ? (
              <span className="vs-floating-touch-target">
                ➜ Pasang di {wheelConfig?.wheels.find((w) => w.id === touchTargetWheelId)?.code || touchTargetWheelId.toUpperCase()}
              </span>
            ) : (
              <span className="vs-floating-touch-hint">Geser ke roda kendaraan</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

