import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getDashboardData, type CsvRow } from "@/lib/data";

/* Helpers */
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
    const e = keys.find((k) => k === c);
    if (e) return row[e];
  }
  for (const c of candidates) {
    const p = keys.find((k) => k.includes(c));
    if (p) return row[p];
  }
  return "";
}

export default function TrialFailurePage() {
  const data = getDashboardData();

  const mapRows = (rows: CsvRow[], nameKeys: string[]) =>
    (rows ?? [])
      .map((row) => {
        const name = getValue(row, nameKeys) || "未分类";
        const failure = numberValue(
          getValue(row, ["试工不通过人数", "人数", "试工不通过", "count"])
        );
        return { name, failure };
      })
      .filter((r) => r.name !== "未分类" && r.failure > 0)
      .sort((a, b) => b.failure - a.failure);

  const suppliers = mapRows(data.trialFailureSupplier, ["供应商", "供应商名称"]);
  const warehouses = mapRows(data.trialFailureWarehouse, ["仓库", "物理仓", "需求仓"]);
  const jobs = mapRows(data.trialFailureJob, ["工种", "Job"]);

  const total = suppliers.reduce((s, r) => s + r.failure, 0)
    || warehouses.reduce((s, r) => s + r.failure, 0)
    || jobs.reduce((s, r) => s + r.failure, 0);

  const topSup = suppliers[0];
  const topWh = warehouses[0];
  const topJob = jobs[0];

  const top3SupShare = total > 0
    ? (suppliers.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;
  const top3WhShare = total > 0
    ? (warehouses.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;

  const RankList = ({ items }: { items: { name: string; failure: number }[] }) => (
    <div className="space-y-4">
      {items.slice(0, 8).map((it, i) => (
        <div key={it.name}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                i < 3 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
              }`}>{i + 1}</span>
              <span className="max-w-[180px] truncate text-sm font-semibold">{it.name}</span>
            </div>
            <span className="text-lg font-bold text-rose-600">{formatNumber(it.failure)}</span>
          </div>
          <div className="ml-10 mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
              style={{ width: `${Math.min((it.failure / Math.max(1, items[0]?.failure ?? 1)) * 100, 100)}%` }}
            />
          </div>
          <p className="ml-10 mt-1 text-[11px] text-slate-400">
            占全部 {formatPercent(total > 0 ? (it.failure / total) * 100 : 0)}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">劳动质量 Labor Quality</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">试工不通过分析 Trial Failure Analysis</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">Sep 01, 2026 — Sep 30, 2026</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">试工不通过集中在哪里？ Where are trial failures concentrated?</p>
              <div className="mt-4 flex items-end gap-6">
                <p className="text-6xl font-bold tracking-tight">{formatNumber(total)}</p>
                <div className="pb-2">
                  <p className="text-sm text-rose-100">试工不通过总人数 Total Trial Failures</p>
                  <p className="mt-1 text-xs text-rose-200">数据来源：临时工派遣表 Source: Temp Dispatch Records</p>
                </div>
              </div>
              <div className="mt-6 grid max-w-2xl grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{suppliers.length}</p>
                  <p className="mt-1 text-xs text-rose-200">涉及供应商<br />Suppliers</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{warehouses.length}</p>
                  <p className="mt-1 text-xs text-rose-200">涉及仓库<br />Warehouses</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{formatPercent(top3SupShare)}</p>
                  <p className="mt-1 text-xs text-rose-200">前三供应商占比<br />Top 3 Share</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {topSup && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">🔴 最多供应商 Top Supplier</p>
                <p className="mt-3 truncate text-lg font-bold">{topSup.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatNumber(topSup.failure)}</p>
                <p className="mt-2 text-xs text-slate-500">占全部 {formatPercent(total > 0 ? (topSup.failure / total) * 100 : 0)}</p>
              </div>
            )}
            {topWh && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">🔴 最多仓库 Top Warehouse</p>
                <p className="mt-3 truncate text-lg font-bold">{topWh.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatNumber(topWh.failure)}</p>
                <p className="mt-2 text-xs text-slate-500">占全部 {formatPercent(total > 0 ? (topWh.failure / total) * 100 : 0)}</p>
              </div>
            )}
            {topJob && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">🔴 最多工种 Top Job</p>
                <p className="mt-3 truncate text-lg font-bold">{topJob.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatNumber(topJob.failure)}</p>
                <p className="mt-2 text-xs text-slate-500">占全部 {formatPercent(total > 0 ? (topJob.failure / total) * 100 : 0)}</p>
              </div>
            )}
          </section>

          {/* Concentration */}
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">供应商集中度 Supplier Concentration</p>
                  <p className="mt-1 text-sm font-bold">前三供应商占比 Top 3 Share</p>
                </div>
                <p className="text-3xl font-bold text-indigo-600">{formatPercent(top3SupShare)}</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${Math.min(top3SupShare, 100)}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">仓库集中度 Warehouse Concentration</p>
                  <p className="mt-1 text-sm font-bold">前三仓库占比 Top 3 Share</p>
                </div>
                <p className="text-3xl font-bold text-indigo-600">{formatPercent(top3WhShare)}</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${Math.min(top3WhShare, 100)}%` }} />
              </div>
            </div>
          </section>

          {/* Rankings */}
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">供应商排名 By Supplier</h3>
              <p className="mt-1 text-xs text-slate-400">按不通过人数排序 Rank by Failure Count</p>
              <div className="mt-5"><RankList items={suppliers} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">仓库排名 By Warehouse</h3>
              <p className="mt-1 text-xs text-slate-400">按不通过人数排序 Rank by Failure Count</p>
              <div className="mt-5"><RankList items={warehouses} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">工种排名 By Job</h3>
              <p className="mt-1 text-xs text-slate-400">按不通过人数排序 Rank by Failure Count</p>
              <div className="mt-5"><RankList items={jobs} /></div>
            </div>
          </section>

          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">只展示不通过人数，不算不通过率 · Counts only, no failure rate</p>
          </div>
        </div>
      </main>
    </div>
  );
}
