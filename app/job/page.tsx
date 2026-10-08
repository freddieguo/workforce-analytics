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
function formatDateLabel(value: string) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
  });
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

export default function JobPage() {
  const { demand, jobAllocSummary } = getDashboardData();

  const jobs = ((jobAllocSummary ?? []) as CsvRow[])
    .map((row) => {
      const name = getValue(row, ["工种"]) || "未分类";
      const requested = numberValue(getValue(row, ["需求人数"]));
      const filled = numberValue(getValue(row, ["已派遣人数"]));
      const unfilled = Math.max(requested - filled, 0);
      const fillRate = requested > 0 ? (filled / requested) * 100 : 0;
      return { name, requested, filled, unfilled, fillRate };
    })
    .filter((j) => j.name !== "未分类")
    .sort((a, b) => b.unfilled - a.unfilled);

  const totalRequested = jobs.reduce((s, x) => s + x.requested, 0);
  const totalFilled = jobs.reduce((s, x) => s + x.filled, 0);
  const totalUnfilled = jobs.reduce((s, x) => s + x.unfilled, 0);
  const overallRate = totalRequested > 0 ? (totalFilled / totalRequested) * 100 : 0;

  const best = [...jobs].sort((a, b) => b.fillRate - a.fillRate)[0] ?? null;
  const worst = [...jobs].sort((a, b) => a.fillRate - b.fillRate)[0] ?? null;
  const largestGap = jobs[0] ?? null;

  const demandDates = ((demand ?? []) as CsvRow[]).map((r) => getValue(r, ["需求日期", "日期"])).filter(Boolean).sort();
  const periodLabel = demandDates[0] && demandDates[demandDates.length - 1]
    ? `${formatDateLabel(demandDates[0])} — ${formatDateLabel(demandDates[demandDates.length - 1])}`
    : "—";

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">人力管理 Workforce Management</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">工种分析 Job Analysis</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">{periodLabel}</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">工种需求与缺口 Job Demand & Gaps</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {jobs.length} 个工种 · 总体派遣率 {formatPercent(overallRate)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100">
                {formatNumber(totalFilled)} / {formatNumber(totalRequested)} 人次已派遣，
                还有 {formatNumber(totalUnfilled)} 人次缺口。
                {largestGap && <>缺口最大的是 <strong className="text-white">{largestGap.name}</strong>（{formatNumber(largestGap.unfilled)} 人次），</>}
                {worst && <>派遣率最低的是 <strong className="text-white">{worst.name}</strong>（{formatPercent(worst.fillRate)}）。</>}
              </p>
              <div className="mt-6 grid max-w-3xl grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalRequested)}</p>
                  <p className="mt-1 text-xs text-violet-200">总需求<br />Requested</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalFilled)}</p>
                  <p className="mt-1 text-xs text-violet-200">已派遣<br />Dispatched</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalUnfilled)}</p>
                  <p className="mt-1 text-xs text-violet-200">未派遣缺口<br />Gap</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {largestGap && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">🔴 缺口最大 Largest Gap</p>
                <p className="mt-3 truncate text-lg font-bold">{largestGap.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatNumber(largestGap.unfilled)}</p>
                <p className="mt-2 text-xs text-slate-500">人次未派遣 · 派遣率 {formatPercent(largestGap.fillRate)}</p>
              </div>
            )}
            {worst && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">⚠️ 派遣率最低 Lowest Rate</p>
                <p className="mt-3 truncate text-lg font-bold">{worst.name}</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{formatPercent(worst.fillRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(worst.filled)} / {formatNumber(worst.requested)} 已派遣</p>
              </div>
            )}
            {best && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">🏆 派遣率最高 Best Rate</p>
                <p className="mt-3 truncate text-lg font-bold">{best.name}</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatPercent(best.fillRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(best.filled)} / {formatNumber(best.requested)} 已派遣</p>
              </div>
            )}
          </section>

          {/* Visual ranking */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">工种排名 Job Ranking</h3>
                <p className="mt-1 text-xs text-slate-400">按未派遣缺口从大到小排序 · 数据来源：用工需求池（发单详情） Source: Labor Demand Pool</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{jobs.length} 个工种</span>
            </div>

            {jobs.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                暂无工种数据，请先跑管线生成 job_alloc_summary。No job data yet — run the pipeline first.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {jobs.map((j, i) => {
                  const barColor = j.fillRate >= 80 ? "from-emerald-400 to-emerald-600"
                    : j.fillRate >= 60 ? "from-amber-400 to-amber-600"
                    : "from-rose-400 to-rose-600";
                  const textColor = j.fillRate >= 80 ? "text-emerald-600"
                    : j.fillRate >= 60 ? "text-amber-600" : "text-rose-600";
                  return (
                    <div key={j.name}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>{i + 1}</span>
                          <span className="text-sm font-semibold">{j.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="hidden text-xs text-slate-400 sm:block">
                            {formatNumber(j.filled)} / {formatNumber(j.requested)}
                          </span>
                          <span className={`w-16 text-right text-lg font-bold ${textColor}`}>
                            {formatPercent(j.fillRate)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                          style={{ width: `${Math.min(j.fillRate, 100)}%` }}
                        />
                      </div>
                      <div className="ml-11 mt-1 flex justify-between text-[11px] text-slate-400">
                        <span>已派遣 {formatNumber(j.filled)}</span>
                        <span>未派遣缺口 {formatNumber(j.unfilled)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Footer */}
          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">派遣率 = 已派遣 ÷ 已发单 · Dispatch rate = dispatched ÷ issued</p>
          </div>
        </div>
      </main>
    </div>
  );
}
