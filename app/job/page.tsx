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

type JobRow = {
  name: string;
  planned: number;
  arrived: number;
  accepted: number;
  noshow: number;
  rejected: number;
  fulfillmentRate: number;
};

export default function JobPage() {
  const { demand, arrivalTrackingJob } = getDashboardData();

  // 直接用人员到岗表按职位汇总，不跟发单详情硬拼
  const jobs: JobRow[] = ((arrivalTrackingJob ?? []) as CsvRow[])
    .map((row) => {
      const name = getValue(row, ["工种"]) || "未分类";
      const planned = numberValue(getValue(row, ["拟到岗人次"]));
      const total = numberValue(getValue(row, ["到岗人次"]));
      const noshow = numberValue(getValue(row, ["NoShow人次"]));
      const rejected = numberValue(getValue(row, ["被退回人次"]));
      const accepted = numberValue(getValue(row, ["已接受人次"]));
      const arrived = total - noshow;
      const fulfillmentRate = planned > 0 ? (accepted / planned) * 100 : 0;
      return { name, planned, arrived, accepted, noshow, rejected, fulfillmentRate };
    })
    .filter((j) => j.name !== "未分类")
    .sort((a, b) => a.fulfillmentRate - b.fulfillmentRate);

  const totalPlanned = jobs.reduce((s, x) => s + x.planned, 0);
  const totalArrived = jobs.reduce((s, x) => s + x.arrived, 0);
  const totalAccepted = jobs.reduce((s, x) => s + x.accepted, 0);
  const totalRejected = jobs.reduce((s, x) => s + x.rejected, 0);
  const overallFulfillment = totalPlanned > 0 ? (totalAccepted / totalPlanned) * 100 : 0;

  const best = [...jobs].sort((a, b) => b.fulfillmentRate - a.fulfillmentRate)[0] ?? null;
  const worst = jobs[0] ?? null;
  const mostRejected = [...jobs].sort((a, b) => b.rejected - a.rejected)[0] ?? null;

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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">工种到岗与接受 Job Arrival & Acceptance</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {jobs.length} 个工种
              </h2>
              <p className="mt-1 text-sm font-medium text-violet-200">
                {jobs.length} jobs
              </p>
              <p className="mt-3 text-sm leading-6 text-violet-100">
                {formatNumber(totalAccepted)} / {formatNumber(totalPlanned)} 人次最终被接受，
                实际到场 {formatNumber(totalArrived)} 人次，被退回 {formatNumber(totalRejected)} 人次。
                {best && <>达成率最高的是 <strong className="text-white">{best.name}</strong>（{formatPercent(best.fulfillmentRate)}），</>}
                {mostRejected && <>被退回最多的是 <strong className="text-white">{mostRejected.name}</strong>（{formatNumber(mostRejected.rejected)} 人次）。</>}
              </p>
              <div className="mt-6 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalPlanned)}</p>
                  <p className="mt-1 text-xs text-violet-200">拟到岗<br />Planned</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalArrived)}</p>
                  <p className="mt-1 text-xs text-violet-200">实际到场<br />Arrived</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalAccepted)}</p>
                  <p className="mt-1 text-xs text-violet-200">已接受<br />Accepted</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalRejected)}</p>
                  <p className="mt-1 text-xs text-violet-200">被退回<br />Rejected</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {best && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">🏆 达成率最高 Best</p>
                <p className="mt-3 truncate text-lg font-bold">{best.name}</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatPercent(best.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(best.accepted)} / {formatNumber(best.planned)} 已接受 accepted</p>
              </div>
            )}
            {worst && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">⚠️ 达成率最低 Attention</p>
                <p className="mt-3 truncate text-lg font-bold">{worst.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatPercent(worst.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(worst.accepted)} / {formatNumber(worst.planned)} 已接受 accepted</p>
              </div>
            )}
            {mostRejected && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">📊 被退回最多 Most Rejected</p>
                <p className="mt-3 truncate text-lg font-bold">{mostRejected.name}</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{formatNumber(mostRejected.rejected)}</p>
                <p className="mt-2 text-xs text-slate-500">被退回 Rejected · 到场 Arrived {formatNumber(mostRejected.arrived)}</p>
              </div>
            )}
          </section>

          {/* Visual ranking */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">工种排名 Job Ranking</h3>
                <p className="mt-1 text-xs text-slate-400">按达成率从低到高排序 Rank by Fulfillment Rate (Low to High) · 数据来源：人员到岗表 Source: Arrival Tracking</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{jobs.length} 个工种 jobs</span>
            </div>

            {jobs.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                暂无工种到岗数据，请先跑管线生成 arrival_tracking_job。No job arrival data yet — run the pipeline first.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {jobs.map((j, i) => {
                  const fr = j.fulfillmentRate;
                  const barColor = fr >= 80 ? "from-emerald-400 to-emerald-600"
                    : fr >= 60 ? "from-amber-400 to-amber-600"
                    : "from-rose-400 to-rose-600";
                  const textColor = fr >= 80 ? "text-emerald-600"
                    : fr >= 60 ? "text-amber-600" : "text-rose-600";
                  return (
                    <div key={j.name} className="group rounded-2xl border border-slate-100 p-4 transition hover:border-violet-100 hover:bg-violet-50/30 md:p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>{i + 1}</span>
                          <span className="truncate text-sm font-semibold">{j.name}</span>
                        </div>
                        <span className={`ml-4 shrink-0 text-lg font-bold ${textColor}`}>
                          {formatPercent(fr)}
                        </span>
                      </div>
                      <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                          style={{ width: `${Math.min(fr, 100)}%` }}
                        />
                      </div>
                      <div className="ml-11 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 md:grid-cols-5">
                        <span>{formatNumber(j.planned)} 拟到岗 Planned</span>
                        <span>{formatNumber(j.arrived)} 实际到场 Arrived</span>
                        <span className="font-medium text-emerald-600">
                          {formatNumber(j.accepted)} 已接受 Accepted
                        </span>
                        <span>{formatNumber(j.noshow)} NoShow</span>
                        <span className="font-medium text-rose-500">
                          {formatNumber(j.rejected)} 被退回 Rejected
                        </span>
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
            <p className="mt-3 text-[11px] text-slate-400">达成率 = 已接受 ÷ 拟到岗 · Fulfillment rate = accepted ÷ planned</p>
          </div>
        </div>
      </main>
    </div>
  );
}
