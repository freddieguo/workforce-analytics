"use client";

import { Fragment } from "react";

export type SentBackTableRow = {
  name: string;
  failure: number;
  /* 悬停卡用的全链路数，全部来自人员到岗表，不用新管线。
     effectiveArrived = 拟到岗 − No Show = 已接受 + 被退回。
     原因维度没有按原因的到岗数，所以原因表传全公司有效到岗，并用 effectiveLabel 标明。
     share = 该行被退回 ÷ 全部被退回，只放悬停卡，主表不再列这一列。 */
  effectiveArrived?: number | null;
  effectiveLabel?: string;
  accepted?: number | null;
  noshow?: number | null;
  scheduled?: number | null;
  share?: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/* 被退回明细表：跟供应商/仓库表同一套格式（行 + 下面小条 + 悬停卡）。
   主表只列 #、名称、被退回人次，不列占比；占比挪到悬停卡里。 */
export default function SentBackTable({ items }: { items: SentBackTableRow[]; total?: number }) {
  const rows = [...items]
    .filter((r) => r && r.failure > 0)
    .sort((a, b) => b.failure - a.failure);
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">暂无被退回数据</div>;
  }
  const maxFailure = Math.max(1, ...rows.map((r) => r.failure));
  return (
    <div className="relative">
      <p className="mb-4 text-xs text-slate-400">按被退回人次排序 · 悬停每一行看完整数据</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">名称 Name</th>
              <th className="px-3 py-2 text-right font-semibold">被退回人次 Sent Back</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const effective = r.effectiveArrived ?? null;
              const rate = effective !== null && effective > 0 ? (r.failure / effective) * 100 : null;
              /* 悬停卡智能翻转：哪边空间大往哪边展开，避免被滚动容器裁掉 */
              const cardPos = rows.length - 1 - i >= i ? "top-full mt-1" : "bottom-full mb-1";
              return (
                <Fragment key={r.name}>
                  <tr className="group border-t border-slate-100 transition hover:bg-indigo-50/40">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="relative px-3 py-2 font-semibold">
                      <span className="block truncate" style={{ maxWidth: 180 }}>{r.name}</span>
                      <span className={"pointer-events-none absolute left-0 z-30 hidden w-72 group-hover:block " + cardPos}>
                        <span className="mt-1 block rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
                          <span className="block truncate text-base font-bold text-slate-900">{r.name}</span>
                          <span className="mt-3 block space-y-2.5">
                            {r.scheduled !== null && r.scheduled !== undefined && (
                              <span className="flex items-center justify-between text-sm">
                                <span className="font-normal text-slate-500">拟到岗 Scheduled</span>
                                <span className="font-semibold tabular-nums text-slate-800">{formatNumber(r.scheduled)}</span>
                              </span>
                            )}
                            {r.noshow !== null && r.noshow !== undefined && (
                              <span className="flex items-center justify-between text-sm">
                                <span className="font-normal text-slate-500">No Show</span>
                                <span className="font-semibold tabular-nums text-slate-800">{formatNumber(r.noshow)}</span>
                              </span>
                            )}
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">{r.effectiveLabel ?? "有效到岗 Effective Arrived"}</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {effective !== null ? formatNumber(effective) : "—"}
                              </span>
                            </span>
                            {r.accepted !== null && r.accepted !== undefined && (
                              <span className="flex items-center justify-between text-sm">
                                <span className="font-normal text-slate-500">已接受 Accepted</span>
                                <span className="font-semibold tabular-nums text-emerald-600">{formatNumber(r.accepted)}</span>
                              </span>
                            )}
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">被退回 Sent Back</span>
                              <span className="font-bold tabular-nums text-rose-600">{formatNumber(r.failure)}</span>
                            </span>
                            <span className="block border-t border-slate-100" />
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">被退回率 Sent-back Rate</span>
                              <span className="font-bold tabular-nums text-rose-600">
                                {rate !== null ? formatPercent(rate) : "—"}
                              </span>
                            </span>
                            {r.share !== null && r.share !== undefined && (
                              <span className="flex items-center justify-between text-sm">
                                <span className="font-normal text-slate-500">占全部被退回 Share</span>
                                <span className="font-semibold tabular-nums text-slate-800">{formatPercent(r.share)}</span>
                              </span>
                            )}
                            <span className="block text-xs leading-5 text-slate-400">
                              被退回率 = 被退回 ÷ 有效到岗（剔除 No Show）
                            </span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatNumber(r.failure)}</td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td colSpan={3} className="px-3 pb-2 pt-0">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                          style={{ width: Math.min((r.failure / maxFailure) * 100, 100) + "%" }}
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
    </div>
  );
}
