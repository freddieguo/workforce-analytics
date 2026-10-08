import Sidebar from "@/components/Sidebar";
import { getDashboardData, type CsvRow } from "@/lib/data";

function numberValue(value: string | undefined) {
  if (!value) return 0;
  const n = Number(value.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getValue(row: CsvRow, candidates: string[]) {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const exact = keys.find((k) => k === c);
    if (exact) return row[exact];
  }
  for (const c of candidates) {
    const partial = keys.find((k) => k.includes(c));
    if (partial) return row[partial];
  }
  return "";
}

export default function DataQualityPage() {
  const data = getDashboardData();
  const missingSupplier = data.missingSupplierAllocation ?? [];
  const allocationCount = data.allocation.length;
  const missingCount = missingSupplier.length;
  const missingRate = allocationCount > 0 ? (missingCount / allocationCount) * 100 : 0;
  const isHealthy = missingCount === 0;

  const rows = missingSupplier
    .map((row, index) => {
      const requested = numberValue(getValue(row, ["供应商需派遣人数", "请求人数"]));
      const filled = numberValue(getValue(row, ["供应商已派遣人数", "已派遣人数"]));
      return { row, index, requested, filled, unfilled: Math.max(requested - filled, 0) };
    })
    .sort((a, b) => b.unfilled - a.unfilled);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">系统 System</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">数据质量 Data Quality</h1>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                isHealthy
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {isHealthy ? "健康 Healthy" : `${formatNumber(missingCount)} 条缺失`}
            </div>
          </div>
        </header>

        <div className="p-5 md:p-8">
          {isHealthy ? (
            /* Healthy state */
            <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 p-12 text-center shadow-sm">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-teal-100/30 blur-3xl" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl text-white shadow-lg">
                  ✓
                </div>
                <h2 className="mt-6 text-2xl font-bold text-slate-900">数据健康 Data Healthy</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                  所有 {formatNumber(allocationCount)} 条调配记录都有供应商归属，无缺失问题。
                  <br />
                  All allocation records have supplier attribution.
                </p>
                <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-2xl font-bold text-slate-900">{formatNumber(allocationCount)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">调配记录<br />Allocations</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-2xl font-bold text-emerald-600">100%</p>
                    <p className="mt-1 text-[11px] text-slate-400">归属覆盖率<br />Coverage</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-2xl font-bold text-slate-900">0</p>
                    <p className="mt-1 text-[11px] text-slate-400">缺失<br />Missing</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Issues state */
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">总调配 Total</p>
                  <p className="mt-2 text-3xl font-bold">{formatNumber(allocationCount)}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">缺失 Missing</p>
                  <p className="mt-2 text-3xl font-bold text-amber-700">{formatNumber(missingCount)}</p>
                  <p className="mt-1 text-xs text-amber-600/70">{formatPercent(missingRate)} 的记录</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">覆盖率 Coverage</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">{formatPercent(100 - missingRate)}</p>
                </div>
              </div>

              {/* Table */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
                <div className="border-b border-slate-100 px-6 py-5">
                  <h2 className="font-bold">缺少供应商归属 Missing Supplier Attribution</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    按未派遣缺口排序 · Sorted by unfilled gap
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">日期 Date</th>
                        <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">仓库 Warehouse</th>
                        <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">工种 Job</th>
                        <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">需求 Requested</th>
                        <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">已派遣 Filled</th>
                        <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">未派遣 Unfilled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map(({ row, index, requested, filled, unfilled }) => (
                        <tr key={index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                          <td className="px-6 py-4 text-sm text-slate-600">{getValue(row, ["需求日期", "日期"]) || "—"}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700">{getValue(row, ["需求仓", "仓库"]) || "—"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{getValue(row, ["工种"]) || "—"}</td>
                          <td className="px-6 py-4 text-right text-sm text-slate-600">{formatNumber(requested)}</td>
                          <td className="px-6 py-4 text-right text-sm text-slate-600">{formatNumber(filled)}</td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">{formatNumber(unfilled)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {missingCount > 100 && (
                  <p className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400">
                    显示前 100 条，共 {formatNumber(missingCount)} 条 · Showing top 100 of {formatNumber(missingCount)}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
