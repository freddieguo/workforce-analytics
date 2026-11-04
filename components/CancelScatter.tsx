"use client";

import { useState } from "react";

export type CancelScatterRow = {
  name: string;
  total: number;
  ended: number;
  warnings: number;
  eoaShare: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function shareColor(share: number) {
  if (share >= 90) return "text-rose-600";
  if (share >= 80) return "text-amber-600";
  return "text-emerald-600";
}

/* 散点图：横轴=该家总人次（被结束+警告），纵轴=被结束占比（被结束 ÷ 该家合计）。
   右上角 = 量大、且基本都是被结束不是警告，最值得盯紧。圆点越大 = 被结束越多。
   这里的占比分母是该家自己的合计，不是外部人数，别跟占全部被结束混淆。
   SVG 里不用 title 元素，避免 hydration 报错。 */
export default function CancelScatter({ rows }: { rows: CancelScatterRow[] }) {
  const [hovered, setHovered] = useState<CancelScatterRow | null>(null);
  const pts = rows.filter((r) => r.eoaShare !== null && r.total > 0);
  if (pts.length === 0) return null;
  const totalEnded = pts.reduce((s, r) => s + r.ended, 0);
  const W = 620, H = 250, PL = 58, PR = 20, PT = 14, PB = 36;
  const maxX = Math.max(1, ...pts.map((p) => p.total));
  const yMax = 100;
  const x = (v: number) => PL + (v / maxX) * (W - PL - PR);
  const y = (v: number) => H - PB - (v / yMax) * (H - PT - PB);
  const divX = x(maxX * 0.5);
  const color = (r: CancelScatterRow) => {
    const s = r.eoaShare ?? 0;
    if (s >= 90) return "#f43f5e";
    if (s >= 80) return "#f59e0b";
    return "#10b981";
  };
  const radius = (r: CancelScatterRow) => {
    const maxEnded = Math.max(1, ...pts.map((p) => p.ended));
    return 5 + (r.ended / maxEnded) * 5;
  };
  return (
    <div className="relative">
      <svg viewBox={"0 0 " + W + " " + H} className="w-full" style={{ height: "auto", display: "block" }}>
        <line x1={divX} y1={PT} x2={divX} y2={H - PB} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 4" />
        <text x={divX} y={H - PB + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">{formatNumber(maxX * 0.5)}</text>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#cbd5e1" strokeWidth="1" />
        <text x={16} y={H / 2} fontSize="11" fill="#94a3b8" textAnchor="middle" transform={"rotate(-90 16 " + H / 2 + ")"}>被结束占比 →</text>
        <text x={W - PR} y={H - 8} fontSize="11" fill="#94a3b8" textAnchor="end">总人次 →</text>
        <text x={PL - 6} y={y(0) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">0%</text>
        <text x={PL - 6} y={y(yMax) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">100%</text>
        <text x={W - PR - 4} y={PT + 13} fontSize="11" fill="#e11d48" fontWeight="700" textAnchor="end">基本都是被结束</text>
        <text x={W - PR - 4} y={H - PB - 6} fontSize="11" fill="#059669" fontWeight="700" textAnchor="end">警告占比较多</text>
        {pts.map((r) => (
          <g
            key={r.name}
            onMouseEnter={() => setHovered(r)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x(r.total)}
              cy={y(r.eoaShare ?? 0)}
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
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-rose-500" />被结束占比 ≥ 90%</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-amber-500" />被结束占比 80–90%</span>
        <span className="flex items-center"><span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-emerald-500" />被结束占比 &lt; 80%</span>
        <span>圆点越大 = 被结束人次越多</span>
      </div>
      {(() => {
        if (!hovered) return null;
        const hx = x(hovered.total);
        const hy = y(hovered.eoaShare ?? 0);
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
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">被结束 End of Assignment</span>
              <span className="font-bold tabular-nums text-rose-600">{formatNumber(hovered.ended)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">警告 Warning</span>
              <span className="font-semibold tabular-nums text-amber-600">{formatNumber(hovered.warnings)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">合计 Total</span>
              <span className="font-semibold tabular-nums text-slate-800">{formatNumber(hovered.total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">被结束占比 EOA Share</span>
              <span className={"font-bold tabular-nums " + shareColor(hovered.eoaShare ?? 0)}>
                {hovered.eoaShare !== null ? formatPercent(hovered.eoaShare) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">占全部被结束 Share of Ended</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {totalEnded > 0 ? formatPercent((hovered.ended / totalEnded) * 100) : "—"}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-400">被结束占比 = 该家被结束 ÷ 该家合计（被结束+警告）</p>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
