"use client";

import { Fragment } from "react";

export type CancelTableRow = {
  name: string;
  ended: number;
  warnings: number;
  /* 已接受：人员到岗表里的累计数，只在悬停卡里显示、主表不列。
     没传（到岗表没数据）时悬停卡显示 —，不写成 0，免得误以为一个都没接受。 */
  accepted?: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/* 被结束明细表：跟被退回表同一套格式（行 + 下面小条 + 悬停卡）。
   主表只列 #、名称、被结束、警告、合计，不列占比；占比和已接受都挪到悬停卡里。
   口径：人次不去重，同一工号多次出现算多次。警告包括口头、书面、书面+最终警告三类。
   已接受来自人员到岗表累计，时间跟删除表不一样，只作规模对比，不进被结束率。 */
export default function CancelTable({ items }: { items: CancelTableRow[] }) {
  const rows = [...items]
    .filter((r) => r && r.ended + r.warnings > 0)
    .map((r) => ({ ...r, total: r.ended + r.warnings }))
    .sort((a, b) => b.ended - a.ended || b.total - a.total);
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">暂无被结束数据</div>;
  }
  const maxEnded = Math.max(1, ...rows.map((r) => r.ended));
  const totalEnded = rows.reduce((s, r) => s + r.ended, 0);
  const totalWarnings = rows.reduce((s, r) => s + r.warnings, 0);
  return (
    <div className="relative">
      <p className="mb-4 text-xs text-slate-400">按被结束人数排序 · 悬停每一行看完整数据</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">名称 Name</th>
              <th className="px-3 py-2 text-right font-semibold">被结束 Ended</th>
              <th className="px-3 py-2 text-right font-semibold">警告 Warning</th>
              <th className="px-3 py-2 text-right font-semibold">合计 Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
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
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">被结束 End of Assignment</span>
                              <span className="font-bold tabular-nums text-rose-600">{formatNumber(r.ended)}</span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">警告 Warning</span>
                              <span className="font-semibold tabular-nums text-amber-600">{formatNumber(r.warnings)}</span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">合计 Total</span>
                              <span className="font-semibold tabular-nums text-slate-800">{formatNumber(r.total)}</span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">已接受 Accepted（到岗表累计）</span>
                              <span className="font-semibold tabular-nums text-emerald-600">
                                {r.accepted != null ? formatNumber(r.accepted) : "—"}
                              </span>
                            </span>
                            <span className="block border-t border-slate-100" />
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">占全部被结束 Share of Ended</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {totalEnded > 0 ? formatPercent((r.ended / totalEnded) * 100) : "—"}
                              </span>
                            </span>
                            <span className="flex items-center justify-between text-sm">
                              <span className="font-normal text-slate-500">占全部警告 Share of Warnings</span>
                              <span className="font-semibold tabular-nums text-slate-800">
                                {totalWarnings > 0 ? formatPercent((r.warnings / totalWarnings) * 100) : "—"}
                              </span>
                            </span>
                            <span className="block text-xs leading-5 text-slate-400">
                              人次不去重，同一工号多次出现算多次
                            </span>
                            <span className="block text-xs leading-5 text-slate-400">
                              已接受是人员到岗表里的累计数，时间跟删除表不一样，只用来对比规模大小，不能直接拿被结束除以已接受算比例
                            </span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatNumber(r.ended)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-600">{formatNumber(r.warnings)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{formatNumber(r.total)}</td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td colSpan={5} className="px-3 pb-2 pt-0">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                          style={{ width: Math.min((r.ended / maxEnded) * 100, 100) + "%" }}
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
