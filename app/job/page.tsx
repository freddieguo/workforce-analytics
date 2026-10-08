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

/* 到岗职位名 → 需求/发单工种名聚合：Bendi I/II→Bendi，General Labor→普工，Janitor→保洁员 */
function normalizeJobKey(name: string): string {
  const n = name.trim();
  if (n === "General Labor" || n === "General Labor-") return "普工";
  if (n === "Janitor") return "保洁员";
  let base = n.replace(/\s+[IVX]+\.?$/, "").trim().replace(/-+$/, "").trim();
  base = base.replace(/^Sr\s+/, "Sr. ");
  if (base === "Sr. Warehouse Associate") return "Sr. Warehouse Associate (P1)";
  return base;
}

type JobRow = {
  name: string;
  demand: number;
  issued: number | null;
  filled: number | null;
  arrived: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
};

export default function JobPage() {
  const { demand, jobDemandSummary, jobAllocSummary, arrivalTrackingJob } = getDashboardData();

  // 发单详情按工种：已发单、已派遣
  const allocMap = new Map<string, { issued: number; filled: number }>(
    (((jobAllocSummary ?? []) as CsvRow[]).map((r: CsvRow) => [
      getValue(r, ["工种"]) || "未分类",
      {
        issued: numberValue(getValue(r, ["需求人数"])),
        filled: numberValue(getValue(r, ["已派遣人数"])),
      },
    ]) as [string, { issued: number; filled: number }][])
  );

  // 到岗表按工种聚合：实际到场、已接受
  const atJobMap = new Map<string, { arrived: number; accepted: number }>();
  for (const r of ((arrivalTrackingJob ?? []) as CsvRow[])) {
    const key = normalizeJobKey(getValue(r, ["工种"]) || "");
    if (!key || key === "未分类") continue;
    const total = numberValue(getValue(r, ["到岗人次"]));
    const noshow = numberValue(getValue(r, ["NoShow人次"]));
    const accepted = numberValue(getValue(r, ["已接受人次"]));
    const e = atJobMap.get(key) ?? { arrived: 0, accepted: 0 };
    e.arrived += total - noshow;
    e.accepted += accepted;
    atJobMap.set(key, e);
  }

  // 以需求池工种为主
  const jobs: JobRow[] = ((jobDemandSummary ?? []) as CsvRow[])
    .map((row) => {
      const name = getValue(row, ["工种"]) || "未分类";
      const demandCount = numberValue(getValue(row, ["需求人数"]));
      const alloc = allocMap.get(name);
      const at = atJobMap.get(name);
      const accepted = at?.accepted ?? null;
      return {
        name,
        demand: demandCount,
        issued: alloc?.issued ?? null,
        filled: alloc?.filled ?? null,
        arrived: at?.arrived ?? null,
        accepted,
        fulfillmentRate: accepted !== null && demandCount > 0 ? (accepted / demandCount) * 100 : null,
      };
    })
    .filter((j) => j.name !== "未分类")
    .sort((a, b) => b.demand - a.demand);

  const totalDemand = jobs.reduce((s, x) => s + x.demand, 0);
  const totalIssued = jobs.reduce((s, x) => s + (x.issued ?? 0), 0);
  const totalArrived = jobs.reduce((s, x) => s + (x.arrived ?? 0), 0);
  const totalAccepted = jobs.reduce((s, x) => s + (x.accepted ?? 0), 0);
  const overallFulfillment = totalDemand > 0 ? (totalAccepted / totalDemand) * 100 : 0;

  const mostDemanded = jobs[0] ?? null;
  const worst = [...jobs].sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  const best = [...jobs].sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1))[0] ?? null;

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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">工种需求与达成 Job Demand & Fulfillment</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {jobs.length} 个工种
              </h2>
              <p className="mt-1 text-sm font-medium text-violet-200">
                {jobs.length} jobs · Overall fulfillment rate {formatPercent(overallFulfillment)}
              </p>
              <p className="mt-3 text-sm leading-6 text-violet-100">
                {formatNumber(totalAccepted)} / {formatNumber(totalDemand)} 人次最终被接受，
                实际到场 {formatNumber(totalArrived)} 人次。
                {mostDemanded && <>需求最多的是 <strong className="text-white">{mostDemanded.name}</strong>（{formatNumber(mostDemanded.demand)} 人次），</>}
                {worst?.fulfillmentRate != null && <>达成率最低的是 <strong className="text-white">{worst.name}</strong>（{formatPercent(worst.fulfillmentRate)}）。</>}
              </p>
              <div className="mt-6 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalDemand)}</p>
                  <p className="mt-1 text-xs text-violet-200">总需求<br />Demand</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalIssued)}</p>
                  <p className="mt-1 text-xs text-violet-200">已发单<br />Issued</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalArrived)}</p>
                  <p className="mt-1 text-xs text-violet-200">实际到场<br />Arrived</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalAccepted)}</p>
                  <p className="mt-1 text-xs text-violet-200">已接受<br />Accepted</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {mostDemanded && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">📦 需求最多 Most Demanded</p>
                <p className="mt-3 truncate text-lg font-bold">{mostDemanded.name}</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatNumber(mostDemanded.demand)}</p>
                <p className="mt-2 text-xs text-slate-500">需求 Demand · 已发单 Issued {formatNumber(mostDemanded.issued ?? 0)}</p>
              </div>
            )}
            {worst?.fulfillmentRate != null && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">⚠️ 达成率最低 Attention</p>
                <p className="mt-3 truncate text-lg font-bold">{worst.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatPercent(worst.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(worst.accepted ?? 0)} / {formatNumber(worst.demand)} 已接受 accepted</p>
              </div>
            )}
            {best?.fulfillmentRate != null && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">🏆 达成率最高 Best</p>
                <p className="mt-3 truncate text-lg font-bold">{best.name}</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{formatPercent(best.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(best.accepted ?? 0)} / {formatNumber(best.demand)} 已接受 accepted</p>
              </div>
            )}
          </section>

          {/* Visual ranking */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">工种排名 Job Ranking</h3>
                <p className="mt-1 text-xs text-slate-400">按需求数从多到少排序 Rank by Demand (High to Low) · 数据来源：用工需求池 + 发单详情 + 人员到岗表 Source: Labor Demand Pool + Allocation + Arrival Tracking</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{jobs.length} 个工种 jobs</span>
            </div>

            {jobs.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                暂无工种数据，请先跑管线生成 job_demand_summary。No job data yet — run the pipeline first.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {jobs.map((j, i) => {
                  const fr = j.fulfillmentRate ?? 0;
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
                          {j.fulfillmentRate !== null ? formatPercent(j.fulfillmentRate) : "—"}
                        </span>
                      </div>
                      <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                          style={{ width: `${Math.min(fr, 100)}%` }}
                        />
                      </div>
                      <div className="ml-11 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 md:grid-cols-5">
                        <span className="font-medium text-slate-600">{formatNumber(j.demand)} 需求 Demand</span>
                        {j.issued !== null ? (
                          <span>{formatNumber(j.issued)} 已发单 Issued</span>
                        ) : (
                          <span className="text-slate-300">已发单 —</span>
                        )}
                        {j.arrived !== null ? (
                          <span>{formatNumber(j.arrived)} 实际到场 Arrived</span>
                        ) : (
                          <span className="text-slate-300">实际到场 —</span>
                        )}
                        {j.accepted !== null ? (
                          <span className="font-medium text-emerald-600">
                            {formatNumber(j.accepted)} 已接受 Accepted
                          </span>
                        ) : (
                          <span className="text-slate-300">已接受 —</span>
                        )}
                        <span className="text-slate-500">达成率 = 已接受 ÷ 需求</span>
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
            <p className="mt-3 text-[11px] text-slate-400">达成率 = 已接受 ÷ 需求 · Fulfillment rate = accepted ÷ demand</p>
          </div>
        </div>
      </main>
    </div>
  );
}
