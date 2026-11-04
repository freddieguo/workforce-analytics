"use client";

import { useState } from "react";

export type SentBackScatterRow = {
  name: string;
  scheduled: number;
  sentBack: number;
  rate: number | null;
  share: number;
  effectiveArrived?: number | null;
  accepted?: number | null;
  noshow?: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function rateColor(rate: number) {
  if (rate >= 20) return "text-rose-600";
  if (rate >= 10) return "text-amber-600";
  return "text-emerald-600";
}

/* 被退回率一律按新口径算，不再用传进来的旧 rate：
   effectiveRate = 被退回 ÷ 有效到岗，有效到岗 = 拟到岗 − No Show。
   只有没传 effectiveArrived 时，才回落到原来传进来的 rate，避免旧 trial 页直接没点。 */
function effectiveRate(r: SentBackScatterRow): number | null {
  if (r.effectiveArrived !== null && r.effectiveArrived !== undefined && r.effectiveArrived > 0) {
    return (r.sentBack / r.effectiveArrived) * 100;
  }
  return r.rate;
}

/* 散点图：横轴=拟到岗量，纵轴=被退回率（被退回 ÷ 有效到岗，剔除 No Show），圆点越大 = 被退回越多。
   被退回率高是坏事，所以颜色跟达成率散点反过来：率高红、低率绿。
   SVG 里不用 title 元素，避免 hydration 报错。 */
export default function SentBackScatter({ rows }: { rows: SentBackScatterRow[] }) {
  const [hovered, setHovered] = useState<SentBackScatterRow | null>(null);
  const pts = rows.filter((r) => effectiveRate(r) !== null && r.scheduled > 0);
  if (pts.length === 0) return null;
  const W = 620, H = 250, PL = 58, PR = 20, PT = 14, PB = 36;
  const maxX = Math.max(1, ...pts.map((p) => p.scheduled));
  const maxRate = Math.max(20, ...pts.map((p) => effectiveRate(p) ?? 0));
  const yMax = Math.ceil(maxRate / 10) * 10;
  const x = (v: number) => PL + (v / maxX) * (W - PL - PR);
  const y = (v: number) => H - PB - (v / yMax) * (H - PT - PB);
  const divX = x(maxX * 0.5);
  const color = (r: SentBackScatterRow) => {
    const rate = effectiveRate(r) ?? 0;
    if (rate >= 20) return "#f43f5e";
    if (rate >= 10) return "#f59e0b";
    return "#10b981";
  };
  const radius = (r: SentBackScatterRow) => {
    const maxSent = Math.max(1, ...pts.map((p) => p.sentBack));
    return 5 + (r.sentBack / maxSent) * 5;
  };
  return (
    <div className="relative">
      <svg viewBox={"0 0 " + W + " " + H} className="w-full" style={{ height: "auto", display: "block" }}>
        <line x1={divX} y1={PT} x2={divX} y2={H - PB} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 4" />
        <text x={divX} y={H - PB + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">{formatNumber(maxX * 0.5)}</text>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <text x={16} y={H / 2} fontSize="11" fill="#94a3b8" textAnchor="middle" transform={"rotate(-90 16 " + H / 2 + ")"}>被退回率 →</text>
        <text x={W - PR} y={H - 8} fontSize="11" fill="#94a3b8" textAnchor="end">拟到岗量 →</text>
        <text x={PL - 6} y={y(0) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">0%</text>
        <text x={PL - 6} y={y(yMax) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{yMax}%</text>
        <text x={W - PR - 4} y={PT + 13} fontSize="11" fill="#e11d48" fontWeight="700" textAnchor="end">退回率高</text>
        <text x={W - PR - 4} y={H - PB - 6} fontSize="11" fill="#059669" fontWeight="700" textAnchor="end">退回率低</text>
        {pts.map((r) => (
          <g
            key={r.name}
            onMouseEnter={() => setHovered(r)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x(r.scheduled)}
              cy={y(effectiveRate(r) ?? 0)}
              r={hovered?.name === r.name ? radius(r) + 3 : radius(r)}
              fill={color(r)}
              opacity="0.85"
              stroke={hovered?.name === r.name ? "#fff" : "none"}
              strokeWidth={hovered?.name === r.name ? 2 : 0}
            />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-rose-500" />被退回率 ≥ 20%</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-amber-500" />被退回率 10–20%</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-emerald-500" />被退回率 &lt; 10%</span>
        <span>圆点越大 = 被退回人次越多</span>
      </div>
      {(() => {
        if (!hovered) return null;
        const hoverRate = effectiveRate(hovered);
        const hx = x(hovered.scheduled);
        const hy = y(hoverRate ?? 0);
        const toLeft = hx > W * 0.55;
        const below = hy < H * 0.5;
        return (
        <div
          className="pointer-events-none absolute z-30 w-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          style={{
            left: (hx / W) * 100 + "%",
            top: (hy / H) * 100 + "%",
            transform:
              "translate(" +
              (toLeft ? "calc(-100% - 14px)" : "14px") +
              ", " +
              (below ? "14px" : "calc(-100% - 14px)") +
              ")",
          }}
        >
          <p className="truncate text-base font-bold text-slate-900" title={hovered.name}>{hovered.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            拟到岗 <span className="font-bold tabular-nums text-slate-900">{formatNumber(hovered.scheduled)}</span> 人次 · Scheduled
          </p>
          <div className="mt-3 space-y-2">
            {hovered.noshow !== null && hovered.noshow !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">No Show</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatNumber(hovered.noshow)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">有效到岗 Effective Arrived</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {hovered.effectiveArrived !== null && hovered.effectiveArrived !== undefined ? formatNumber(hovered.effectiveArrived) : "—"}
              </span>
            </div>
            {hovered.accepted !== null && hovered.accepted !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">已接受 Accepted</span>
                <span className="font-semibold tabular-nums text-emerald-600">{formatNumber(hovered.accepted)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">被退回 Sent Back</span>
              <span className="font-bold tabular-nums text-rose-600">{formatNumber(hovered.sentBack)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">被退回率 Sent-back Rate</span>
              <span className={"font-bold tabular-nums " + rateColor(hoverRate ?? 0)}>
                {hoverRate !== null ? formatPercent(hoverRate) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">占全部被退回 Share</span>
              <span className="font-semibold tabular-nums text-slate-800">{formatPercent(hovered.share)}</span>
            </div>
            <p className="text-xs leading-5 text-slate-400">被退回率 = 被退回 ÷ 有效到岗（剔除 No Show）</p>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
