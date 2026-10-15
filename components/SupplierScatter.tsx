"use client";

import { useState } from "react";

type SupplierRow = {
  name: string;
  requested: number;
  filled: number;
  unfilled: number;
  dispatchRate: number;
  actualArrived: number | null;
  arrivalRate: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/* 散点图：横轴=发单量，纵轴=达成率（悬停显示公司信息卡） */
export default function SupplierScatter({ suppliers }: { suppliers: SupplierRow[] }) {
  const [hovered, setHovered] = useState<SupplierRow | null>(null);
  const pts = suppliers.filter((s) => s.fulfillmentRate !== null && s.requested > 0);
  if (pts.length === 0) return null;
  const W = 620, H = 250, PL = 44, PR = 20, PT = 14, PB = 36;
  const maxX = Math.max(1, ...pts.map((p) => p.requested));
  const yMin = 0;
  const yMax = 100;
  const x = (v: number) => PL + (v / maxX) * (W - PL - PR);
  const y = (v: number) => H - PB - ((v - yMin) / (yMax - yMin)) * (H - PT - PB);
  const divX = x(maxX * 0.5);
  const divY = y(60);
  const isDanger = (s: SupplierRow) => s.requested >= maxX * 0.5 && (s.fulfillmentRate ?? 100) < 60;
  const color = (s: SupplierRow) => {
    const fr = s.fulfillmentRate ?? 0;
    const big = s.requested >= maxX * 0.5;
    if (big && fr < 60) return "#f43f5e";
    if (big) return "#10b981";
    if (fr >= 60) return "#3b82f6";
    return "#f59e0b";
  };
  return (
    <div className="relative">
      <svg viewBox={"0 0 " + W + " " + H} className="w-full" style={{ height: "auto", display: "block" }}>
        <line x1={divX} y1={PT} x2={divX} y2={H - PB} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 4" />
        <text x={divX} y={H - PB + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">{formatNumber(maxX * 0.5)}</text>
        <line x1={PL} y1={divY} x2={W - PR} y2={divY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 4" />
        <text x={PL - 6} y={divY + 4} fontSize="10" fill="#94a3b8" textAnchor="end">60%</text>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <text x={W - PR} y={H - 8} fontSize="11" fill="#94a3b8" textAnchor="end">发单量 →</text>
        <text x={PL - 6} y={y(yMin) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{yMin}%</text>
        <text x={PL - 6} y={y(yMax) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{yMax}%</text>
        <text x={W - PR - 4} y={PT + 13} fontSize="11" fill="#059669" fontWeight="700" textAnchor="end">靠谱</text>
        <text x={W - PR - 4} y={H - PB - 6} fontSize="11" fill="#e11d48" fontWeight="700" textAnchor="end">危险</text>
        {pts.map((s) => (
          <g
            key={s.name}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x(s.requested)}
              cy={y(s.fulfillmentRate ?? 0)}
              r={hovered?.name === s.name ? 10 : 7}
              fill={color(s)}
              opacity="0.85"
              stroke={hovered?.name === s.name ? "#fff" : "none"}
              strokeWidth={hovered?.name === s.name ? 2 : 0}
            />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-rose-500" />量大率低（危险）</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-emerald-500" />量大率高（靠谱）</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-blue-500" />量小率高（样本小）</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-amber-500" />量小率低</span>
      </div>
      {hovered && (
        <div className="pointer-events-none absolute left-0 top-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <p className="truncate text-base font-bold text-slate-900" title={hovered.name}>{hovered.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            发单 {formatNumber(hovered.requested)} 人次 · Issued
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">已派遣 Dispatched</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatNumber(hovered.filled)}{" "}
                <span className="font-normal text-slate-400">({formatPercent(hovered.dispatchRate)})</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">实际到场 Arrived</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {hovered.actualArrived !== null ? formatNumber(hovered.actualArrived) : "—"}
                {hovered.arrivalRate !== null && (
                  <span className="font-normal text-slate-400"> ({formatPercent(hovered.arrivalRate)})</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">已接受 Accepted</span>
              <span className="font-bold tabular-nums text-emerald-600">
                {hovered.accepted !== null ? formatNumber(hovered.accepted) : "—"}
              </span>
            </div>
            <div className="border-t border-slate-100" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">未派遣缺口 Gap</span>
              <span className="font-bold tabular-nums text-amber-600">{formatNumber(hovered.unfilled)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">达成率 Fulfillment</span>
              <span className="font-bold tabular-nums text-slate-800">
                {hovered.fulfillmentRate !== null ? formatPercent(hovered.fulfillmentRate) : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

