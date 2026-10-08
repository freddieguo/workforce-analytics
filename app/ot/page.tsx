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
function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
function shortDate(value: string) {
  if (!value) return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(5);
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit" }).format(d);
}
function formatDate(value: string) {
  if (!value) return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(d);
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
function getRate(ot: number, work: number) {
  return work > 0 ? (ot / work) * 100 : 0;
}
function rateColor(rate: number) {
  if (rate >= 10) return { bar: "from-rose-400 to-rose-600", text: "text-rose-600", bg: "bg-rose-50" };
  if (rate >= 7) return { bar: "from-amber-400 to-amber-600", text: "text-amber-600", bg: "bg-amber-50" };
  return { bar: "from-emerald-400 to-emerald-600", text: "text-emerald-600", bg: "bg-emerald-50" };
}

export default function OTPage() {
  const { otDaily, otWarehouse, otSupplier, otJob } = getDashboardData();

  /* Daily aggregation */
  const dailyMap = new Map<string, { date: string; workHours: number; otHours: number }>();
  for (const row of otDaily as CsvRow[]) {
    const date = getValue(row, ["日期", "考勤日期"]);
    if (!date) continue;
    const wh = numberValue(getValue(row, ["工作时长", "总工作时长", "总工时"]));
    const ot = numberValue(getValue(row, ["加班时长", "加班工时", "OT时长", "OT"]));
    const e = dailyMap.get(date);
    if (e) { e.workHours += wh; e.otHours += ot; }
    else dailyMap.set(date, { date, workHours: wh, otHours: ot });
  }
  const daily = Array.from(dailyMap.values())
    .map((r) => ({ ...r, rate: getRate(r.otHours, r.workHours) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalWork = daily.reduce((s, r) => s + r.workHours, 0);
  const totalOt = daily.reduce((s, r) => s + r.otHours, 0);
  const totalHours = totalWork + totalOt;
  const otRate = getRate(totalOt, totalWork);
  const rc = rateColor(otRate);

  const mapRows = (rows: CsvRow[], nameKeys: string[]) =>
    (rows as CsvRow[])
      .map((row) => {
        const name = getValue(row, nameKeys) || "未分类";
        const wh = numberValue(getValue(row, ["工作时长", "总工作时长", "总工时"]));
        const ot = numberValue(getValue(row, ["加班时长", "加班工时", "OT时长", "OT"]));
        return { name, workHours: wh, otHours: ot, rate: getRate(ot, wh) };
      })
      .filter((r) => r.name !== "未分类");

  const warehouses = mapRows(otWarehouse, ["仓库", "物理仓", "需求仓"]).sort((a, b) => b.rate - a.rate);
  const suppliers = mapRows(otSupplier, ["供应商", "供应商名称"]).sort((a, b) => b.rate - a.rate);
  const jobs = mapRows(otJob, ["工种", "工作类型"]).sort((a, b) => b.otHours - a.otHours);

  const topWh = warehouses[0];
  const topSup = suppliers[0];
  const topJob = jobs[0];
  const peakDay = [...daily].sort((a, b) => b.rate - a.rate)[0];

  const maxDailyRate = Math.max(1, ...daily.map((d) => d.rate));

  const period = daily.length > 0
    ? `${formatDate(daily[0].date)} — ${formatDate(daily[daily.length - 1].date)}`
    : "—";

  const RankList = ({ items, unit, by = "rate" }: {
    items: { name: string; rate: number; otHours: number }[];
    unit: string;
    by?: "rate" | "hours";
  }) => (
    <div className="space-y-4">
      {items.slice(0, 8).map((it, i) => {
        const c = rateColor(it.rate);
        const metric = by === "hours" ? it.otHours : it.rate;
        const maxMetric = by === "hours" ? (items[0]?.otHours ?? 1) : (items[0]?.rate ?? 1);
        return (
          <div key={it.name}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                  i < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}>{i + 1}</span>
                <span className="max-w-[180px] truncate text-sm font-semibold">{it.name}</span>
              </div>
              <span className={`text-lg font-bold ${c.text}`}>
                {by === "hours" ? formatDecimal(it.otHours) : formatPercent(it.rate)}
              </span>
            </div>
            <div className="ml-10 mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full bg-gradient-to-r ${c.bar}`} style={{ width: `${Math.min(metric / Math.max(1, maxMetric) * 100, 100)}%` }} />
            </div>
            <p className="ml-10 mt-1 text-[11px] text-slate-400">
              {by === "hours" ? `${formatPercent(it.rate)} 加班率` : `${formatDecimal(it.otHours)} ${unit}`}
            </p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">人力管理 Workforce Management</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">加班分析 OT Analysis</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">{period}</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">加班表现 Overtime Performance</p>
              <div className="mt-4 flex items-end gap-6">
                <p className="text-6xl font-bold tracking-tight">{formatPercent(otRate)}</p>
                <div className="pb-2">
                  <p className="text-sm text-orange-100">总体加班率 Overall OT Rate</p>
                  <p className="mt-1 text-xs text-orange-200">{formatDecimal(totalOt)} / {formatDecimal(totalWork)} 小时</p>
                </div>
              </div>
              <div className="mt-6 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{formatDecimal(totalOt)}</p>
                  <p className="mt-1 text-xs text-orange-200">加班时长<br />OT Hours</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{formatDecimal(totalWork)}</p>
                  <p className="mt-1 text-xs text-orange-200">工作时长<br />Work Hours</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{formatDecimal(totalHours)}</p>
                  <p className="mt-1 text-xs text-orange-200">时长总计<br />Total Hours</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold">{daily.length}</p>
                  <p className="mt-1 text-xs text-orange-200">统计天数<br />Days</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {topWh && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">🏭 加班率最高仓库 Top Warehouse</p>
                <p className="mt-3 truncate text-lg font-bold">{topWh.name}</p>
                <p className={`mt-1 text-3xl font-bold ${rateColor(topWh.rate).text}`}>{formatPercent(topWh.rate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDecimal(topWh.otHours)} 小时加班</p>
              </div>
            )}
            {topSup && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">🏢 加班率最高供应商 Top Supplier</p>
                <p className="mt-3 truncate text-lg font-bold">{topSup.name}</p>
                <p className={`mt-1 text-3xl font-bold ${rateColor(topSup.rate).text}`}>{formatPercent(topSup.rate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDecimal(topSup.otHours)} 小时加班</p>
              </div>
            )}
            {peakDay && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">📅 单日峰值 Peak Day</p>
                <p className="mt-3 text-lg font-bold">{formatDate(peakDay.date)}</p>
                <p className={`mt-1 text-3xl font-bold ${rateColor(peakDay.rate).text}`}>{formatPercent(peakDay.rate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDecimal(peakDay.otHours)} 小时加班</p>
              </div>
            )}
          </section>

          {/* Daily trend */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h3 className="text-lg font-bold">每日加班趋势 Daily OT Trend</h3>
            <p className="mt-1 text-xs text-slate-400">数据来源：考勤表 Source: Attendance Records</p>
            {daily.length > 0 ? (
              <div className="mt-6 flex h-[260px] items-end gap-1.5 overflow-x-auto pb-1">
                {daily.map((d) => {
                  const c = rateColor(d.rate);
                  return (
                    <div key={d.date} className="group flex h-full min-w-[24px] flex-1 flex-col justify-end">
                      <div className="relative flex flex-1 items-end">
                        <div
                          className={`w-full rounded-t-md bg-gradient-to-t ${c.bar} transition-all group-hover:opacity-80`}
                          style={{ height: `${Math.max((d.rate / maxDailyRate) * 100, 2)}%` }}
                        />
                        <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                          <div className="font-semibold">{formatDate(d.date)}</div>
                          <div className="mt-1">{formatPercent(d.rate)} · {formatDecimal(d.otHours)}h</div>
                        </div>
                      </div>
                      <p className="mt-2 origin-top-left -rotate-45 whitespace-nowrap text-[9px] text-slate-400">
                        {shortDate(d.date)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">暂无数据 No data</p>
            )}
            <div className="mt-4 flex gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> 正常 &lt;7%</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 关注 7-10%</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> 偏高 ≥10%</span>
            </div>
          </section>

          {/* Rankings */}
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">仓库排名 By Warehouse</h3>
              <p className="mt-1 text-xs text-slate-400">按加班率排序</p>
              <div className="mt-5"><RankList items={warehouses} unit="小时加班" /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">供应商排名 By Supplier</h3>
              <p className="mt-1 text-xs text-slate-400">按加班率排序</p>
              <div className="mt-5"><RankList items={suppliers} unit="小时加班" /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">工种排名 By Job</h3>
              <p className="mt-1 text-xs text-slate-400">按加班时长排序</p>
              <div className="mt-5"><RankList items={jobs} unit="小时加班" by="hours" /></div>
            </div>
          </section>

          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">加班率 = 加班时长 ÷ 工作时长 · OT Rate = OT Hours ÷ Work Hours</p>
          </div>
        </div>
      </main>
    </div>
  );
}
