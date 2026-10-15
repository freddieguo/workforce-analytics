"use client";

import { useState, Fragment } from "react";

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

/* 达成率三色：绿≥60% · 黄40-60% · 红<40% */
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

export default function SupplierTable({ suppliers }: { suppliers?: SupplierRow[] }) {
  const [sort, setSort] = useState<SortMode>("rate");
  const [showModal, setShowModal] = useState(false);

  const list = suppliers ?? [];
  const rows = list.filter((s) => s && s.requested > 0);
  const maxX = Math.max(1, ...rows.map((r) => r.requested));

  const sorted = [...rows].sort((a, b) => {
    if (sort === "rate") return (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1);
    if (sort === "volume") return b.requested - a.requested;
    return b.unfilled - a.unfilled;
  });

  const statusOf = (s: SupplierRow) => {
    const fr = s.fulfillmentRate ?? 0;
    if (s.requested >= maxX * 0.5 && fr < 60)
      return { label: "需盯紧", cls: "bg-rose-100 text-rose-700" };
    if (s.requested >= maxX * 0.5 && fr >= 60)
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
    volume: "按发单量从多到少",
    gap: "按未满足缺口从大到小",
  };

  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">暂无供应商数据</div>;
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
            发单量 Volume
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
              <th className="px-3 py-2 font-semibold">供应商 Supplier</th>
              <th className={"px-3 py-2 text-right font-semibold " + hlVol}>发单量 Issued</th>
              <th className={"px-3 py-2 text-right font-semibold " + (sort === "volume" ? "" : "bg-indigo-50/70 text-indigo-600")}>
                {sort === "gap" ? "缺口 Gap" : "达成率 Fulfillment"}
              </th>
              <th className="px-3 py-2 text-right font-semibold">状态 Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const st = statusOf(s);
              const fr = s.fulfillmentRate ?? 0;
              const showGap = sort === "gap";
              /* 悬停卡智能翻转：哪边空间大往哪边展开，避免被滚动容器裁掉 */
              const cardPos = sorted.length - 1 - i >= i ? "top-full mt-1" : "bottom-full mb-1";
              return (
                <Fragment key={s.name}>
                  <tr className="group border-t border-slate-100 transition hover:bg-indigo-50/40">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="relative px-3 py-2 font-semibold">
                      <span className="block truncate" style={{ maxWidth: 180 }}>{s.name}</span>
                      <span className={"pointer-events-none absolute left-0 z-30 hidden w-80 group-hover:block " + cardPos}>
                        <span className="mt-1 block rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
                          <span className="block truncate text-base font-bold text-slate-900">{s.name}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            发单 <span className="font-bold tabular-nums text-slate-900">{formatNumber(s.requested)}</span> 人次 · Issued
                          </span>
                          <span className="mt-3 block space-y-2.5">
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已派遣 Dispatched</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {formatNumber(s.filled)}{" "}
                                <span className={"font-semibold " + dispatchColor(s.dispatchRate)}>
                                  ({formatPercent(s.dispatchRate)})
                                </span>
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">实际到场 Arrived</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {s.actualArrived !== null ? formatNumber(s.actualArrived) : "—"}
                                {s.arrivalRate !== null && (
                                  <span className="font-normal text-slate-400"> ({formatPercent(s.arrivalRate)})</span>
                                )}
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已接受 Accepted</span>
                              <span className="font-bold tabular-nums text-emerald-600">
                                {s.accepted !== null ? formatNumber(s.accepted) : "—"}
                              </span>
                            </span>
                            <span className="block border-t border-slate-100" />
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">未派遣缺口 Gap</span>
                              <span className="font-bold tabular-nums text-amber-600">{formatNumber(s.unfilled)}</span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">达成率 Fulfillment</span>
                              <span className={"font-bold tabular-nums " + rateColor(fr)}>
                                {s.fulfillmentRate !== null ? formatPercent(s.fulfillmentRate) : "—"}
                              </span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={"px-3 py-2 text-right tabular-nums " + hlVol}>{formatNumber(s.requested)}</td>
                    <td className={"px-3 py-2 text-right " + (showGap ? hlGap : hlRate)}>
                      {showGap ? (
                        <span className="font-bold tabular-nums text-amber-600">{formatNumber(s.unfilled)}</span>
                      ) : (
                        <span className={"font-bold tabular-nums " + rateColor(fr)}>
                          {s.fulfillmentRate !== null ? formatPercent(fr) : "—"}
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
            单子多（发单量 ≥ 全场最多的 50%），达成率却不到 60% —— 量大还做不好，最危险，优先盯它。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">靠谱</span>
            单子多，达成率 ≥ 60% —— 主力供应商，可以放心给单。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">样本小</span>
            达成率 ≥ 60% 但单子少 —— 好看可能是因为单少，别当主力用。
          </p>
          <p>
            <span className="mr-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">一般</span>
            单不多、达成率也不高 —— 剩下的都归这里。
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          每行下面的小条按达成率三色画：绿 ≥ 60% · 黄 40–60% · 红 &lt; 40%。
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
                <h3 className="text-lg font-bold">供应商完整明细 Supplier Details</h3>
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
                    <th className="px-3 py-2 font-semibold">供应商 Supplier</th>
                    <th className="px-3 py-2 text-right font-semibold">已发单 Issued</th>
                    <th className="px-3 py-2 text-right font-semibold">已派遣 Dispatched</th>
                    <th className="px-3 py-2 text-right font-semibold">实际到场 Arrived</th>
                    <th className="px-3 py-2 text-right font-semibold">已接受 Accepted</th>
                    <th className="px-3 py-2 text-right font-semibold">缺口 Gap</th>
                    <th className="px-3 py-2 text-right font-semibold">达成率 Fulfillment</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const fr = s.fulfillmentRate ?? 0;
                    return (
                      <tr key={s.name} className="border-t border-slate-100 hover:bg-indigo-50/30">
                        <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 font-semibold" title={s.name}>
                          {s.name}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.requested)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatNumber(s.filled)}{" "}
                          <span className={"text-xs font-semibold " + dispatchColor(s.dispatchRate)}>
                            ({formatPercent(s.dispatchRate)})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.actualArrived !== null ? formatNumber(s.actualArrived) : "—"}
                          {s.arrivalRate !== null && (
                            <span className="text-xs text-slate-400"> ({formatPercent(s.arrivalRate)})</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">
                          {s.accepted !== null ? formatNumber(s.accepted) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-600">
                          {formatNumber(s.unfilled)}
                        </td>
                        <td className={"px-3 py-2.5 text-right font-bold tabular-nums " + rateColor(fr)}>
                          {s.fulfillmentRate !== null ? formatPercent(fr) : "—"}
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
