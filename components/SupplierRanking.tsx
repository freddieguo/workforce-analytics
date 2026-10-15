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

type SortMode = "rate" | "volume" | "gap";

export default function SupplierRanking({ suppliers }: { suppliers: SupplierRow[] }) {
  const [sort, setSort] = useState<SortMode>("rate");

  const sorted = [...suppliers].sort((a, b) => {
    if (sort === "rate") return (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1);
    if (sort === "volume") return b.requested - a.requested;
    return b.unfilled - a.unfilled;
  });

  const tabBtn = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
    }`;

  const sortLabel: Record<SortMode, string> = {
    rate: "按达成率从高到低排序 Rank by Fulfillment Rate (High to Low)",
    volume: "按发单量从多到少排序 Rank by Issued Volume (High to Low)",
    gap: "按未满足缺口从大到小排序 Rank by Unfilled Gap (High to Low)",
  };

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">供应商排名 Supplier Ranking</h3>
          <p className="mt-1 text-xs text-slate-400">
            {sortLabel[sort]} · 数据来源：用工需求池（发单详情）+ 人员到岗表 Source: Labor Demand Pool + Arrival Tracking
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {suppliers.length} 家 suppliers
        </span>
      </div>

      {/* 排序切换 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={tabBtn(sort === "rate")} onClick={() => setSort("rate")}>
          达成率 Fulfillment
        </button>
        <button type="button" className={tabBtn(sort === "volume")} onClick={() => setSort("volume")}>
          发单量 Volume
        </button>
        <button type="button" className={tabBtn(sort === "gap")} onClick={() => setSort("gap")}>
          缺口 Gap
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {sorted.map((s, i) => {
          const fr = s.fulfillmentRate ?? 0;
          const barColor =
            fr >= 80
              ? "from-emerald-400 to-emerald-600"
              : fr >= 60
                ? "from-amber-400 to-amber-600"
                : "from-rose-400 to-rose-600";
          const textColor =
            fr >= 80
              ? "text-emerald-600"
              : fr >= 60
                ? "text-amber-600"
                : "text-rose-600";
          const arrivalAbnormal =
            s.arrivalRate !== null && (s.arrivalRate > 115 || s.arrivalRate < 70);
          // 缺口排序时，大数字显示缺口而不是达成率
          const bigValue = sort === "gap" ? formatNumber(s.unfilled) : s.fulfillmentRate !== null ? formatPercent(s.fulfillmentRate) : "—";
          const bigLabel = sort === "gap" ? "未满足缺口 Gap" : null;
          return (
            <div
              key={s.name}
              className="group rounded-2xl border border-slate-100 p-4 transition hover:border-indigo-100 hover:bg-indigo-50/30 md:p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className={`text-lg font-bold ${sort === "gap" ? "text-amber-600" : textColor}`}>
                    {bigValue}
                  </span>
                  {bigLabel && (
                    <p className="text-[10px] font-medium text-slate-400">{bigLabel}</p>
                  )}
                </div>
              </div>
              <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                  style={{ width: `${Math.min(fr, 100)}%` }}
                />
              </div>
              <div className="ml-11 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 md:grid-cols-4">
                <span>{formatNumber(s.requested)} 已发单 Issued</span>
                <span>
                  {formatNumber(s.filled)} 已派遣 Dispatched
                  <span className="text-slate-500"> ({formatPercent(s.dispatchRate)})</span>
                </span>
                {s.actualArrived !== null ? (
                  <span>
                    {formatNumber(s.actualArrived)} 实际到场 Arrived
                    {s.arrivalRate !== null && (
                      <span className={arrivalAbnormal ? "font-semibold text-amber-600" : "text-slate-500"}>
                        {" "}({formatPercent(s.arrivalRate)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-300">实际到场 —</span>
                )}
                {s.accepted !== null ? (
                  <span className="font-medium text-emerald-600">
                    {formatNumber(s.accepted)} 已接受 Accepted
                  </span>
                ) : (
                  <span className="text-slate-300">已接受 —</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
