"use client";

import { useState, Fragment } from "react";

export type JobTableRow = {
  name: string;
  demand: number;
  issued: number | null;
  filled: number | null;
  arrived: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/* 达成率三色：绿≥60% · 黄40-60% · 红<40%（跟供应商/仓库表同一套） */
function rateColor(fr: number) {
  if (fr >= 60) return "text-emerald-600";
  if (fr >= 40) return "text-amber-600";
  return "text-rose-600";
}
function rateBar(fr: number) {
  if (fr >= 60) return "from-teal-300 via-emerald-400 to-emerald-600";
  if (fr >= 40) return "from-amber-300 via-amber-400 to-orange-500";
  return "from-rose-300 via-rose-400 to-rose-600";
}
/* 派遣率三色：同样 60/40 */
function dispatchColor(dr: number) {
  if (dr >= 60) return "text-emerald-600";
  if (dr >= 40) return "text-amber-600";
  return "text-rose-600";
}

type SortMode = "rate" | "volume" | "gap";

export default function JobTable({ jobs }: { jobs?: JobTableRow[] }) {
  const [sort, setSort] = useState<SortMode>("rate");
  const [showModal, setShowModal] = useState(false);

  const list = jobs ?? [];
  const rows = list.filter((j) => j && j.demand > 0);
  const maxX = Math.max(1, ...rows.map((r) => r.demand));
  const gapOf = (j: JobTableRow) => j.demand - (j.filled ?? 0);
  const dispatchRateOf = (j: JobTableRow) =>
    (j.issued ?? 0) > 0 ? ((j.filled ?? 0) / (j.issued ?? 0)) * 100 : 0;

  const sorted = [...rows].sort((a, b) => {
    if (sort === "rate") return (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1);
    if (sort === "volume") return b.demand - a.demand;
    return gapOf(b) - gapOf(a);
  });

  const statusOf = (j: JobTableRow) => {
    const fr = j.fulfillmentRate ?? 0;
    if (j.demand >= maxX * 0.5 && fr < 60)
      return { label: "需盯紧", cls: "bg-rose-100 text-rose-700" };
    if (j.demand >= maxX * 0.5 && fr >= 60)
      return { label: "靠谱", cls: "bg-emerald-100 text-emerald-700" };
    if (fr >= 60) return { label: "样本小", cls: "bg-amber-100 text-amber-700" };
    return { label: "一般", cls: "bg-slate-100 text-slate-500" };
  };

  const tabBtn = (active: boolean) =>
    "rounded-full px-4 py-1.5 text-xs font-semibold transition " +
    (active
      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
      : "bg-slate-100 text-slate-500 hover:bg-slate-200");

  const sortLabel: Record<SortMode, string> = {
    rate: "按达成率从高到低",
    volume: "按需求量从多到少",
    gap: "按缺口从大到小",
  };

  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">暂无工种数据</div>;
  }

  const hlVol = sort === "volume" ? "bg-indigo-50/70" : "";
  const hlRate = sort === "rate" ? "bg-indigo-50/70" : "";
  const hlGap = sort === "gap" ? "bg-indigo-50/70" : "";

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{sortLabel[sort]} · 悬停每一行看完整数据</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tabBtn(sort === "rate")} onClick={() => setSort("rate")}>
            达成率 Fulfillment
          </button>
          <button type="button" className={tabBtn(sort === "volume")} onClick={() => setSort("volume")}>
            需求量 Demand
          </button>
          <button type="button" className={tabBtn(sort === "gap")} onClick={() => setSort("gap")}>
            缺口 Gap
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            查看详情 ▼
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">工种 Job</th>
              <th className={"px-3 py-2 text-right font-semibold " + hlVol}>需求量 Demand</th>
              <th className={"px-3 py-2 text-right font-semibold " + (sort === "volume" ? "" : "bg-indigo-50/70 text-indigo-600")}>
                {sort === "gap" ? "缺口 Gap" : "达成率 Fulfillment"}
              </th>
              <th className="px-3 py-2 text-right font-semibold">状态 Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((j, i) => {
              const st = statusOf(j);
              const fr = j.fulfillmentRate ?? 0;
              const showGap = sort === "gap";
              /* 悬停卡智能翻转：哪边空间大往哪边展开，避免被滚动容器裁掉 */
              const cardPos = sorted.length - 1 - i >= i ? "top-full mt-1" : "bottom-full mb-1";
              return (
                <Fragment key={j.name}>
                  <tr className="group border-t border-slate-100 transition hover:bg-indigo-50/40">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="relative px-3 py-2 font-semibold">
                      <span className="block truncate" style={{ maxWidth: 180 }}>{j.name}</span>
                      <span className={"pointer-events-none absolute left-0 z-30 hidden w-80 group-hover:block " + cardPos}>
                        <span className="mt-1 block rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
                          <span className="block truncate text-base font-bold text-slate-900">{j.name}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            需求 <span className="font-bold tabular-nums text-slate-900">{formatNumber(j.demand)}</span> 人次 · Demand
                          </span>
                          <span className="mt-3 block space-y-2.5">
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已发单 Issued</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {j.issued !== null ? formatNumber(j.issued) : "—"}
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已派遣 Dispatched</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {j.filled !== null ? formatNumber(j.filled) : "—"}{" "}
                                <span className={"font-semibold " + dispatchColor(dispatchRateOf(j))}>
                                  ({formatPercent(dispatchRateOf(j))})
                                </span>
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">实际到场 Arrived</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {j.arrived !== null ? formatNumber(j.arrived) : "—"}
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已接受 Accepted</span>
                              <span className="font-bold tabular-nums text-emerald-600">
                                {j.accepted !== null ? formatNumber(j.accepted) : "—"}
                              </span>
                            </span>
                            <span className="block border-t border-slate-100" />
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">缺口 Gap</span>
                              <span className="font-bold tabular-nums text-amber-600">{formatNumber(gapOf(j))}</span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">达成率 Fulfillment</span>
                              <span className={"font-bold tabular-nums " + rateColor(fr)}>
                                {j.fulfillmentRate !== null ? formatPercent(j.fulfillmentRate) : "—"}
                              </span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={"px-3 py-2 text-right tabular-nums " + hlVol}>{formatNumber(j.demand)}</td>
                    <td className={"px-3 py-2 text-right " + (showGap ? hlGap : hlRate)}>
                      {showGap ? (
                        <span className="font-bold tabular-nums text-amber-600">{formatNumber(gapOf(j))}</span>
                      ) : (
                        <span className={"font-bold tabular-nums " + rateColor(fr)}>
                          {j.fulfillmentRate !== null ? formatPercent(fr) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + st.cls}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td colSpan={5} className="px-3 pb-2 pt-0">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={"h-full rounded-full bg-gradient-to-r " + rateBar(fr)}
                          style={{ width: Math.min(fr, 100) + "%" }}
                        />
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 状态判定说明：大白话 */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500">状态怎么判的 How Status Is Decided</p>
        <div className="mt-2 grid gap-x-6 gap-y-2 text-xs leading-5 text-slate-500 md:grid-cols-2">
          <p>
            <span className="mr-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">需盯紧</span>
            需求多（需求量 ≥ 全场最多的 50%），达成率却不到 60% —— 量大还做不好，最危险，优先盯它。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">靠谱</span>
            需求多，达成率 ≥ 60% —— 主力工种，需求到这里落地最稳。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">样本小</span>
            达成率 ≥ 60% 但需求少 —— 好看可能是因为单少，别当主力用。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">一般</span>
            需求不多、达成率也不高 —— 剩下的都归这里。
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          每行下面的小条按达成率三色画：绿 ≥ 60% · 黄 40–60% · 红 &lt; 40%。达成率 = 已接受 ÷ 需求。
        </p>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold">工种完整明细 Job Details</h3>
                <p className="mt-0.5 text-xs text-slate-400">{sortLabel[sort]}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="max-h-[calc(85vh-73px)] overflow-auto p-6">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">工种 Job</th>
                    <th className="px-3 py-2 text-right font-semibold">需求 Demand</th>
                    <th className="px-3 py-2 text-right font-semibold">已发单 Issued</th>
                    <th className="px-3 py-2 text-right font-semibold">已派遣 Dispatched</th>
                    <th className="px-3 py-2 text-right font-semibold">实际到场 Arrived</th>
                    <th className="px-3 py-2 text-right font-semibold">已接受 Accepted</th>
                    <th className="px-3 py-2 text-right font-semibold">缺口 Gap</th>
                    <th className="px-3 py-2 text-right font-semibold">达成率 Fulfillment</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((j, i) => {
                    const fr = j.fulfillmentRate ?? 0;
                    return (
                      <tr key={j.name} className="border-t border-slate-100 hover:bg-indigo-50/30">
                        <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 font-semibold" title={j.name}>
                          {j.name}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(j.demand)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {j.issued !== null ? formatNumber(j.issued) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {j.filled !== null ? formatNumber(j.filled) : "—"}{" "}
                          <span className={"text-xs font-semibold " + dispatchColor(dispatchRateOf(j))}>
                            ({formatPercent(dispatchRateOf(j))})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {j.arrived !== null ? formatNumber(j.arrived) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">
                          {j.accepted !== null ? formatNumber(j.accepted) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-600">
                          {formatNumber(gapOf(j))}
                        </td>
                        <td className={"px-3 py-2.5 text-right font-bold tabular-nums " + rateColor(fr)}>
                          {j.fulfillmentRate !== null ? formatPercent(j.fulfillmentRate) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- 散点图（并进本文件，绕过 VS Code 对新文件 JobScatter 的 TS2307 缓存问题） ----
   横轴=需求量，纵轴=达成率（已接受 ÷ 需求），悬停显示工种信息卡。
   写法照 SupplierScatter，只换了横轴和悬停卡字段；SVG 里不用 title 元素，避免 hydration 报错。 */
export type JobScatterRow = {
  name: string;
  demand: number;
  issued: number | null;
  filled: number | null;
  arrived: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
};

export function JobScatter({ jobs }: { jobs: JobScatterRow[] }) {
  const [hovered, setHovered] = useState<JobScatterRow | null>(null);
  const pts = jobs.filter((j) => j.fulfillmentRate !== null && j.demand > 0);
  if (pts.length === 0) return null;
  const W = 620, H = 250, PL = 58, PR = 20, PT = 14, PB = 36;
  const maxX = Math.max(1, ...pts.map((pp) => pp.demand));
  const yMin = 0;
  const yMax = 100;
  const x = (v: number) => PL + (v / maxX) * (W - PL - PR);
  const y = (v: number) => H - PB - ((v - yMin) / (yMax - yMin)) * (H - PT - PB);
  const divX = x(maxX * 0.5);
  const divY = y(60);
  const color = (j: JobScatterRow) => {
    const fr = j.fulfillmentRate ?? 0;
    const big = j.demand >= maxX * 0.5;
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
        <text x={16} y={H / 2} fontSize="11" fill="#94a3b8" textAnchor="middle" transform={"rotate(-90 16 " + H / 2 + ")"}>达成率 →</text>
        <text x={W - PR} y={H - 8} fontSize="11" fill="#94a3b8" textAnchor="end">需求量 →</text>
        <text x={PL - 6} y={y(yMin) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{yMin}%</text>
        <text x={PL - 6} y={y(yMax) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{yMax}%</text>
        <text x={W - PR - 4} y={PT + 13} fontSize="11" fill="#059669" fontWeight="700" textAnchor="end">靠谱</text>
        <text x={W - PR - 4} y={H - PB - 6} fontSize="11" fill="#e11d48" fontWeight="700" textAnchor="end">危险</text>
        {pts.map((j) => (
          <g
            key={j.name}
            onMouseEnter={() => setHovered(j)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x(j.demand)}
              cy={y(j.fulfillmentRate ?? 0)}
              r={hovered?.name === j.name ? 10 : 7}
              fill={color(j)}
              opacity="0.85"
              stroke={hovered?.name === j.name ? "#fff" : "none"}
              strokeWidth={hovered?.name === j.name ? 2 : 0}
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
      {(() => {
        if (!hovered) return null;
        const hx = x(hovered.demand);
        const hy = y(hovered.fulfillmentRate ?? 0);
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
            需求 <span className="font-bold tabular-nums text-slate-900">{formatNumber(hovered.demand)}</span> 人次 · Demand
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">已发单 Issued</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {hovered.issued !== null ? formatNumber(hovered.issued) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">已派遣 Dispatched</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {hovered.filled !== null ? formatNumber(hovered.filled) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">实际到场 Arrived</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {hovered.arrived !== null ? formatNumber(hovered.arrived) : "—"}
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
              <span className="text-slate-500">达成率 Fulfillment</span>
              <span className={"font-bold tabular-nums " + rateColor(hovered.fulfillmentRate ?? 0)}>
                {hovered.fulfillmentRate !== null ? formatPercent(hovered.fulfillmentRate) : "—"}
              </span>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
