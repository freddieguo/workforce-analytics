import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import JobTable, { JobScatter } from "@/components/JobTable";
import { getDashboardData, type CsvRow } from "@/lib/data";
import { resolveRange, filterByDateRange, sumByKey, getSavedRange } from "@/lib/dateRange";

/* Helpers */
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

export default async function JobPage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  const { demandDailyJob, allocDailyJob, arrivalTrackingDailyJob } = getDashboardData();

  // 日期范围：需求日期、发单日期与到岗日期的并集（各维度按自己的日期算）
  const demandRows = ((demandDailyJob ?? []) as CsvRow[]);
  const allocRows = ((allocDailyJob ?? []) as CsvRow[]);
  const atRows = ((arrivalTrackingDailyJob ?? []) as CsvRow[]);
  const { start, end, min, max } = resolveRange(
    [...demandRows.map((r) => getValue(r, ["日期"])),
     ...allocRows.map((r) => getValue(r, ["日期"])),
     ...atRows.map((r) => getValue(r, ["日期"]))],
    startParam,
    endParam
  );

  // 选定范围内按工种汇总：需求 + 发单（已发单/已派遣）+ 到岗（到岗/NoShow/已接受）
  const demandByJob = new Map<string, number>(
    sumByKey(filterByDateRange(demandRows, start, end), "工种", ["需求人数"])
      .map((r) => [String(r["工种"]), Number(r["需求人数"] ?? 0)])
  );
  const allocMap = new Map<string, { issued: number; filled: number }>(
    sumByKey(filterByDateRange(allocRows, start, end), "工种",
      ["已发单人数", "已派遣人数"])
      .map((r) => [String(r["工种"]), {
        issued: Number(r["已发单人数"] ?? 0),
        filled: Number(r["已派遣人数"] ?? 0),
      }])
  );

  // 到岗表按工种聚合：实际到场、已接受（子型号归入大类）
  const atJobMap = new Map<string, { arrived: number; accepted: number }>();
  for (const r of sumByKey(filterByDateRange(atRows, start, end), "工种",
    ["到岗人次", "NoShow人次", "已接受人次"])) {
    const key = normalizeJobKey(String(r["工种"] ?? ""));
    if (!key || key === "未分类") continue;
    const e = atJobMap.get(key) ?? { arrived: 0, accepted: 0 };
    e.arrived += Number(r["到岗人次"] ?? 0) - Number(r["NoShow人次"] ?? 0);
    e.accepted += Number(r["已接受人次"] ?? 0);
    atJobMap.set(key, e);
  }

  // 以需求池工种为主
  const jobs: JobRow[] = [...demandByJob.entries()]
    .map(([name, demandCount]) => {
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
  const totalFilled = jobs.reduce((s, x) => s + (x.filled ?? 0), 0);
  const totalArrived = jobs.reduce((s, x) => s + (x.arrived ?? 0), 0);
  const totalAccepted = jobs.reduce((s, x) => s + (x.accepted ?? 0), 0);
  const worst = [...jobs].sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  const best = [...jobs].sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1))[0] ?? null;

  /* 需要盯紧：自动挑问题（逻辑与供应商页一致，量按需求算） */
  // 1. 最危险：量大（>=150）但达成率最低
  const dangerous = jobs
    .filter((j) => j.fulfillmentRate !== null && j.demand >= 150)
    .sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  // 2. 缺口最大：需求 - 已派遣
  const largestGap = [...jobs].sort((a, b) => (b.demand - (b.filled ?? 0)) - (a.demand - (a.filled ?? 0)))[0] ?? null;
  // 3. 样本小但达成率虚高：量小（<150）但达成率>=80
  const inflated = jobs
    .filter((j) => j.fulfillmentRate !== null && j.demand < 150 && (j.fulfillmentRate ?? 0) >= 80)
    .sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1))[0] ?? null;

  const periodLabel = start && end
    ? `${formatDateLabel(start)} — ${formatDateLabel(end)}`
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
            <div className="flex items-center gap-3">
              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
                <p className="text-sm font-semibold text-slate-700">{periodLabel}</p>
              </div>
              <div className="flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">已处理数据 Processed Data</span>
              </div>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* 日期筛选 */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <DateRangePicker start={start} end={end} min={min} max={max} />
          </div>

          {/* Hero：供应商页同款白卡 */}
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">工种概览 Job Overview</p>
          <section className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">工种数量 Jobs</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{jobs.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">个工种有需求</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">达成率 Fulfillment</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">
                {totalDemand > 0 ? formatPercent((totalAccepted / totalDemand) * 100) : "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                已接受 ÷ 需求 = {formatNumber(totalAccepted)} ÷ {formatNumber(totalDemand)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">已派遣 Dispatched</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{formatNumber(totalFilled)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                派遣率 {totalIssued > 0 ? formatPercent((totalFilled / totalIssued) * 100) : "—"} · 已发单 {formatNumber(totalIssued)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">已接受 Accepted</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-indigo-600">{formatNumber(totalAccepted)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {best?.fulfillmentRate != null && <>最高 {best.name} {formatPercent(best.fulfillmentRate)}</>}
              </p>
            </div>
          </section>

          {/* 散点图：需求量 vs 达成率 */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <h3 className="text-lg font-bold">需求量 vs 达成率 Demand vs Fulfillment</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-400">右下（量大率低）最危险</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                悬停圆点看详情
              </span>
            </div>
            <div className="mt-4">
              <JobScatter jobs={jobs.map((j) => ({
                name: j.name,
                demand: j.demand,
                issued: j.issued,
                filled: j.filled,
                arrived: j.arrived,
                accepted: j.accepted,
                fulfillmentRate: j.fulfillmentRate,
              }))} />
            </div>
          </section>

          {/* 需要盯紧：一条紧凑预警横条 */}
          {dangerous && (
            <section className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4 shadow-sm md:p-5">
              <span className="mt-0.5 text-xl">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">
                  需要盯紧 Needs Attention
                  <span className="ml-2 font-normal text-slate-400">系统自动挑出最值得看的问题</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  <strong className="text-rose-600">{dangerous.name}</strong>
                  （需求 {formatNumber(dangerous.demand)} 人次）达成率仅{" "}
                  <strong className="text-rose-600">{formatPercent(dangerous.fulfillmentRate ?? 0)}</strong>
                  ，量大率低优先处理。
                  {largestGap && largestGap.name !== dangerous.name && (
                    <>
                      另 <strong className="text-amber-600">{largestGap.name}</strong> 缺口最大，
                      {formatNumber(largestGap.demand - (largestGap.filled ?? 0))} 人次没派出去。
                    </>
                  )}
                  {inflated && (
                    <>
                      <strong className="text-indigo-600">{inflated.name}</strong> 达成率{" "}
                      {formatPercent(inflated.fulfillmentRate ?? 0)} 看着高但需求只有{" "}
                      {formatNumber(inflated.demand)} 人次，样本小别当主力。
                    </>
                  )}
                </p>
              </div>
            </section>
          )}

          {/* 工种明细：跟供应商/仓库表同一套格式 */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <h3 className="text-lg font-bold">工种明细 Job Details</h3>
            <div className="mt-4">
              <JobTable jobs={jobs} />
            </div>
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
