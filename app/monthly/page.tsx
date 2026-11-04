import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MonthlyInteractive, { type DailyPoint, type RankRow } from "@/components/MonthlyInteractive";
import EoaInteractive, { type EoaRow, type EoaDay } from "@/components/EoaInteractive";
import { getDashboardData, type CsvRow } from "@/lib/data";

/* 月报 Monthly Report（互动版）：一次只看一个月，给领导看的总结。
   只写数字，不写“主要问题是……”这类判断句。
   互动全部在 components/MonthlyInteractive.tsx 里（漏斗可点、每日堆叠柱可点可缩放、
   排名可切页签可换排序、点排名每日图联动），本文件只负责服务端取数和算数，不装新包，不用 SVG <title>。
   覆盖文件：app/monthly/page.tsx（本文件）+ components/MonthlyInteractive.tsx + components/EoaInteractive.tsx。
   不动：管线 scripts/、lib/data.ts、其他页面、侧边栏（月报入口已在的话不用再加）。 */

/* ---------- 小工具（跟之前月报页同一套） ---------- */
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
function num(row: Record<string, unknown>, field: string) {
  const v = Number(row[field] ?? 0);
  return Number.isFinite(v) ? v : 0;
}
function dateOf(row: Record<string, unknown>) {
  return String(row["日期"] ?? "");
}
function monthOf(date: string) {
  return date.length >= 7 ? date.slice(0, 7) : "";
}
function monthLabel(month: string) {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  return `${m[1]}年${Number(m[2])}月`;
}
function inMonth(rows: Record<string, unknown>[], month: string) {
  return rows.filter((r) => monthOf(dateOf(r)) === month);
}
/* Excel 空日期会被管线算成 1899-12-30、1900-01-01，其他页用 >=2000-01-01 挡掉，月报页同样挡。 */
function isSaneDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= "2000-01-01";
}
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function weekdayOf(date: string) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!y || !m || !d) return "";
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}
function sumField(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((s, r) => s + num(r, field), 0);
}
function groupSum(
  rows: Record<string, unknown>[],
  keyField: string,
  fields: string[],
  normalize?: (n: string) => string
): Array<Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const raw = String(r[keyField] ?? "未分类") || "未分类";
    const key = normalize ? normalize(raw) : raw;
    const cur = map.get(key) ?? { name: key };
    for (const f of fields) cur[f] = Number(cur[f] ?? 0) + num(r, f);
    map.set(key, cur);
  }
  return [...map.values()];
}
/* 到岗表仓库写法不统一（Los Angeles-8 / LA-9 等），只按数字归到洛杉矶X号仓。 */
function normalizeWarehouse(name: string) {
  const n = name.match(/(\d+)/)?.[1];
  return n ? `洛杉矶${n}号仓` : name;
}
/* 到岗职位名 -> 需求/发单工种名，跟工种页同一套：Bendi I/II->Bendi，General Labor->普工，Janitor->保洁员 */
function normalizeJobKey(name: string): string {
  const n = name.trim();
  if (n === "General Labor" || n === "General Labor-") return "普工";
  if (n === "Janitor") return "保洁员";
  let base = n.replace(/\s+[IVX]+\.?$/, "").trim().replace(/-+$/, "").trim();
  base = base.replace(/^Sr\s+/, "Sr. ");
  if (base === "Sr. Warehouse Associate") return "Sr. Warehouse Associate (P1)";
  return base;
}
/* 删除表里的 agency 短名 -> 其他页用的全名，跟被结束页对齐。 */
const AGENCY_ALIAS: Record<string, string> = {
  "CITI STAFF": "CitiStaff Solutions",
  PROMPT: "Prompt Priority INC",
  "Direct Staffing": "Direct Staffing LLC.",
  VOYAGE: "Voyage Employer Services",
  OSI: "OSI Staffing Inc.",
  "One Source Inc": "One Source Staffing Inc.",
  iStaffing: "iStaffing Partners Inc.",
  FAIRWAY: "Fairway Staffing Service",
  "PRIORITY WORKFORCE": "Workforce Priority INC",
  GRANDE: "GRANDE SOLUTIONS LLC-USCA",
  CSS: "CSS Employment Group",
};
function normalizeAgency(name: string) {
  const raw = (name || "").trim();
  if (!raw) return "未分类";
  return AGENCY_ALIAS[raw] ?? raw;
}

/* 按天汇总：返回按日期排好的 DailyPoint，total>0 的日子才进 x 轴（没数据的日子跳过，不是 0）。 */
function buildDaily(
  rows: Record<string, unknown>[],
  keyField: string | null,
  keyValue: string | null,
  normalize?: (n: string) => string
): DailyPoint[] {
  const map = new Map<string, { accepted: number; noshow: number; sentback: number }>();
  for (const r of rows) {
    const d = dateOf(r);
    if (!isSaneDate(d)) continue;
    if (keyField && keyValue !== null) {
      const raw = String(r[keyField] ?? "");
      const key = normalize ? normalize(raw) : raw;
      if (key !== keyValue) continue;
    }
    const cur = map.get(d) ?? { accepted: 0, noshow: 0, sentback: 0 };
    cur.accepted += num(r, "已接受人次");
    cur.noshow += num(r, "NoShow人次");
    cur.sentback += num(r, "被退回人次");
    map.set(d, cur);
  }
  return [...map.entries()]
    .map(([date, v]) => ({
      date,
      day: Number(date.slice(8, 10)),
      weekday: weekdayOf(date),
      accepted: v.accepted,
      noshow: v.noshow,
      sentback: v.sentback,
      total: v.accepted + v.noshow + v.sentback,
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default async function MonthlyPage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const data: any = getDashboardData();

  const demandRows = ((data.demandDaily ?? []) as CsvRow[]) as Record<string, unknown>[];
  const allocRows = ((data.allocDaily ?? []) as CsvRow[]) as Record<string, unknown>[];
  const arrivalRows = ((data.arrivalTrackingDaily ?? []) as CsvRow[]) as Record<string, unknown>[];
  const allocSupRows = ((data.allocDailySupplier ?? []) as CsvRow[]) as Record<string, unknown>[];
  const arrivalSupRows = ((data.arrivalTrackingDailySupplier ?? []) as CsvRow[]) as Record<string, unknown>[];
  const arrivalWhRows = ((data.arrivalTrackingDailyWarehouse ?? []) as CsvRow[]) as Record<string, unknown>[];
  const allocWhRows = ((data.allocDailyWarehouse ?? []) as CsvRow[]) as Record<string, unknown>[];
  const demandJobRows = ((data.demandDailyJob ?? []) as CsvRow[]) as Record<string, unknown>[];
  const allocJobRows = ((data.allocDailyJob ?? []) as CsvRow[]) as Record<string, unknown>[];
  const arrivalJobRows = ((data.arrivalTrackingDailyJob ?? []) as CsvRow[]) as Record<string, unknown>[];
  const eoaSupRows = ((data.eoaDailySupplier ?? []) as CsvRow[]) as Record<string, unknown>[];
  const eoaWhRows = ((data.eoaDailyWarehouse ?? []) as CsvRow[]) as Record<string, unknown>[];

  /* 月份选择器只留“像样”的月份，两道关：
     1) 日期必须 >=2000-01-01，挡掉 Excel 空日期带出来的 1899-12、1900-01；
     2) 这个月至少在两张表里出现过（需求/发单/到岗/删除），或者只有删除表
        但当月被结束+警告 >=20 人次。只在一张表里零星出现一两行的月份不进选择器。
     默认月 = 有到岗数据的最新月份。 */
  const monthSources = new Map<string, Set<string>>();
  const monthPeople = new Map<string, number>();
  const noteMonth = (rows: Record<string, unknown>[], source: string, fields: string[]) => {
    for (const r of rows) {
      const d = dateOf(r);
      if (!isSaneDate(d)) continue;
      const m = monthOf(d);
      const people = fields.reduce((s, f) => s + num(r, f), 0);
      if (people <= 0) continue;
      if (!monthSources.has(m)) monthSources.set(m, new Set());
      monthSources.get(m)!.add(source);
      monthPeople.set(m, (monthPeople.get(m) ?? 0) + people);
    }
  };
  noteMonth(demandRows, "demand", ["需求人数"]);
  noteMonth(allocRows, "alloc", ["已发单人数", "已派遣人数"]);
  noteMonth(arrivalRows, "arrival", ["拟到岗人次"]);
  noteMonth(eoaSupRows, "eoa", ["结束人次", "警告人次"]);
  const allMonths = [...monthSources.keys()]
    .filter((m) => {
      const sources = monthSources.get(m)!;
      if (sources.size >= 2) return true;
      if (sources.has("eoa") && (monthPeople.get(m) ?? 0) >= 20) return true;
      return false;
    })
    .sort();
  const arrivalMonths = [
    ...new Set(arrivalRows.map((r) => dateOf(r)).filter(isSaneDate).map((d) => monthOf(d))),
  ]
    .filter((m) => allMonths.includes(m))
    .sort();
  const defaultMonth = arrivalMonths[arrivalMonths.length - 1] ?? allMonths[allMonths.length - 1] ?? "";
  const monthParam = typeof params.month === "string" ? params.month : "";
  const month = allMonths.includes(monthParam) ? monthParam : defaultMonth;

  /* 本月汇总 */
  const mDemand = inMonth(demandRows, month);
  const mAlloc = inMonth(allocRows, month);
  const mArrival = inMonth(arrivalRows, month);
  const mEoa = inMonth(eoaSupRows, month);
  const hasDemand = mDemand.length > 0;
  const hasAlloc = mAlloc.length > 0;
  const hasArrival = mArrival.length > 0;
  const hasEoa = mEoa.length > 0;

  const demand = sumField(mDemand, "需求人数");
  const issued = sumField(mAlloc, "已发单人数");
  const dispatched = sumField(mAlloc, "已派遣人数");
  const scheduled = sumField(mArrival, "拟到岗人次");
  const accepted = sumField(mArrival, "已接受人次");
  const noshow = sumField(mArrival, "NoShow人次");
  const sentback = sumField(mArrival, "被退回人次");
  const fulfillment = demand > 0 ? (accepted / demand) * 100 : null;
  const dispatchRate = issued > 0 ? (dispatched / issued) * 100 : null;

  const monthDates = [...mDemand, ...mAlloc, ...mArrival].map((r) => dateOf(r)).filter(isSaneDate).sort();
  const periodLabel = monthDates.length > 0 ? `${monthDates[0]} — ${monthDates[monthDates.length - 1]}` : "本月暂无数据";

  /* 漏斗：需求 -> 已发单 -> 已派遣 -> 应到岗 -> 已接受 */
  const funnel = [
    { label: "需求 Demand", value: demand, color: "#6366f1", ok: hasDemand },
    { label: "已发单 Issued", value: issued, color: "#0ea5e9", ok: hasAlloc },
    { label: "已派遣 Dispatched", value: dispatched, color: "#14b8a6", ok: hasAlloc },
    { label: "应到岗 Scheduled", value: scheduled, color: "#f59e0b", ok: hasArrival },
    { label: "已接受 Accepted", value: accepted, color: "#10b981", ok: hasArrival },
  ];

  /* 每日序列：全公司 + 排名里的每一家/每一仓/每一工种（按全公司日期对齐补 0，
     这样双滑块下标在全公司和单家之间可以直接复用）。 */
  const mArrivalSup = inMonth(arrivalSupRows, month);
  const mArrivalWh = inMonth(arrivalWhRows, month);
  const mArrivalJob = inMonth(arrivalJobRows, month);
  const daily = buildDaily(mArrival, null, null);
  const dailyDates = daily.map((d) => d.date);
  const alignDaily = (points: DailyPoint[]): DailyPoint[] =>
    dailyDates.map((date) => {
      const found = points.find((p) => p.date === date);
      return found ?? { date, day: Number(date.slice(8, 10)), weekday: weekdayOf(date), accepted: 0, noshow: 0, sentback: 0, total: 0 };
    });

  /* 已发单按天：跟 daily 同一套日期对齐（没有的那天就是 0）。
     注意口径：已发单按发单表日期、应到岗按到岗表日期，同一天两个数本来就不一定对得上，
     跨月时间差会让某天已发单和应到岗差很多，这是正常的，图上只做对比、不做加减。 */
  const issuedByDate = (
    rows: Record<string, unknown>[],
    keyField: string | null,
    keyValue: string | null,
    normalize?: (n: string) => string
  ): number[] => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = dateOf(r);
      if (!isSaneDate(d) || monthOf(d) !== month) continue;
      if (keyField && keyValue !== null) {
        const raw = String(r[keyField] ?? "");
        const key = normalize ? normalize(raw) : raw;
        if (key !== keyValue) continue;
      }
      map.set(d, (map.get(d) ?? 0) + num(r, "已发单人数"));
    }
    return dailyDates.map((date) => map.get(date) ?? 0);
  };

  /* 供应商排名：已发单来自发单表，已接受来自到岗表，达成率 = 已接受 ÷ 已发单 */
  const allocBySup = groupSum(inMonth(allocSupRows, month), "供应商", ["已发单人数", "已派遣人数"]);
  const arrivalBySup = groupSum(mArrivalSup, "供应商", ["已接受人次", "拟到岗人次"]);
  const supMap = new Map<string, { name: string; issued: number; accepted: number }>();
  for (const s of allocBySup) supMap.set(String(s.name), { name: String(s.name), issued: Number(s["已发单人数"] ?? 0), accepted: 0 });
  for (const s of arrivalBySup) {
    const cur = supMap.get(String(s.name)) ?? { name: String(s.name), issued: 0, accepted: 0 };
    cur.accepted = Number(s["已接受人次"] ?? 0);
    supMap.set(String(s.name), cur);
  }
  const suppliers: RankRow[] = [...supMap.values()]
    .filter((s) => s.name !== "未分类" && (s.issued > 0 || s.accepted > 0))
    .sort((a, b) => b.accepted - a.accepted)
    .map((s) => ({ name: s.name, accepted: s.accepted, issued: s.issued, extra: null, extraLabel: "" }));

  /* 仓库排名：跟供应商统一，达成率 = 已接受 ÷ 已发单。拟到岗不进这个率，只放在每行小字里当补充。
     当月有已接受但已发单是 0 时，率显示 —，不写 0。 */
  const allocByWh = groupSum(inMonth(allocWhRows, month), "仓库", ["已发单人数"], normalizeWarehouse);
  const whIssued = new Map<string, number>();
  for (const w of allocByWh) whIssued.set(String(w.name), Number(w["已发单人数"] ?? 0));
  const warehouses: RankRow[] = groupSum(mArrivalWh, "仓库", ["已接受人次", "拟到岗人次", "NoShow人次", "被退回人次"], normalizeWarehouse)
    .filter((w) => String(w.name) !== "未分类")
    .map((w) => ({
      name: String(w.name),
      accepted: Number(w["已接受人次"] ?? 0),
      issued: whIssued.get(String(w.name)) ?? 0,
      extra: Number(w["拟到岗人次"] ?? 0),
      extraLabel: "应到岗",
    }))
    .sort((a, b) => b.accepted - a.accepted);

  /* 工种：跟供应商、仓库同一个排法和同一个达成率（已接受 ÷ 已发单）。
     到岗表的职位名先按工种页的规则归入大类，再跟需求/发单的工种名对齐。 */
  const jobMap = new Map<string, { name: string; demand: number; issued: number; accepted: number }>();
  const putJob = (name: string, demand: number, issued: number, accepted: number) => {
    const cur = jobMap.get(name) ?? { name, demand: 0, issued: 0, accepted: 0 };
    cur.demand += demand;
    cur.issued += issued;
    cur.accepted += accepted;
    jobMap.set(name, cur);
  };
  for (const j of groupSum(inMonth(demandJobRows, month), "工种", ["需求人数"])) putJob(String(j.name), Number(j["需求人数"] ?? 0), 0, 0);
  for (const j of groupSum(inMonth(allocJobRows, month), "工种", ["已发单人数"])) putJob(String(j.name), 0, Number(j["已发单人数"] ?? 0), 0);
  for (const j of groupSum(mArrivalJob, "工种", ["已接受人次"])) {
    const key = normalizeJobKey(String(j.name));
    if (!key || key === "未分类") continue;
    putJob(key, 0, 0, Number(j["已接受人次"] ?? 0));
  }
  const jobs: RankRow[] = [...jobMap.values()]
    .filter((j) => j.name !== "未分类" && (j.issued > 0 || j.accepted > 0 || j.demand > 0))
    .sort((a, b) => b.accepted - a.accepted)
    .map((j) => ({ name: j.name, accepted: j.accepted, issued: j.issued, extra: j.demand, extraLabel: "需求" }));

  /* 点排名联动用的每日序列：排名里每一家/每一仓/每一工种都做，点了回落到全公司。 */
  const dailyBySupplier: Record<string, DailyPoint[]> = {};
  for (const s of suppliers) dailyBySupplier[s.name] = alignDaily(buildDaily(mArrivalSup, "供应商", s.name));
  const dailyByWarehouse: Record<string, DailyPoint[]> = {};
  for (const w of warehouses) dailyByWarehouse[w.name] = alignDaily(buildDaily(mArrivalWh, "仓库", w.name, normalizeWarehouse));
  const dailyByJob: Record<string, DailyPoint[]> = {};
  for (const j of jobs) dailyByJob[j.name] = alignDaily(buildDaily(mArrivalJob, "工种", j.name, normalizeJobKey));

  /* 每日已发单：公司一条，每个排名名字各一条，跟 daily 同一套日期对齐。 */
  const mAllocSup = inMonth(allocSupRows, month);
  const mAllocWh = inMonth(allocWhRows, month);
  const mAllocJob = inMonth(allocJobRows, month);
  const dailyIssued = issuedByDate(mAlloc, null, null);
  const dailyIssuedBySupplier: Record<string, number[]> = {};
  for (const s of suppliers) dailyIssuedBySupplier[s.name] = issuedByDate(mAllocSup, "供应商", s.name);
  const dailyIssuedByWarehouse: Record<string, number[]> = {};
  for (const w of warehouses) dailyIssuedByWarehouse[w.name] = issuedByDate(mAllocWh, "仓库", w.name, normalizeWarehouse);
  const dailyIssuedByJob: Record<string, number[]> = {};
  for (const j of jobs) dailyIssuedByJob[j.name] = issuedByDate(mAllocJob, "工种", j.name);

  /* 被结束：单独一块，不进达成率。只看删除表本月的数据，只写人次，不算率。 */
  const eoaTotalEnded = sumField(mEoa, "结束人次");
  const eoaTotalWarning = sumField(mEoa, "警告人次");
  const eoaBySup = groupSum(mEoa, "供应商", ["结束人次", "警告人次"], normalizeAgency)
    .map((s) => ({ name: String(s.name), ended: Number(s["结束人次"] ?? 0), warnings: Number(s["警告人次"] ?? 0) }))
    .sort((a, b) => b.ended - a.ended);
  const eoaByWh = groupSum(inMonth(eoaWhRows, month), "仓库", ["结束人次", "警告人次"])
    .map((s) => ({ name: String(s.name), ended: Number(s["结束人次"] ?? 0), warnings: Number(s["警告人次"] ?? 0) }))
    .filter((s) => s.name !== "未分类")
    .sort((a, b) => b.ended - a.ended);
  /* 被结束按天：点排名展开用的每天小柱子。按供应商用短名归一化后的全名对齐，按仓库按仓号对齐。 */
  const buildEoaDaily = (
    rows: Record<string, unknown>[],
    keyField: string,
    keyValue: string,
    normalize?: (n: string) => string
  ): EoaDay[] => {
    const eoaDates = [...new Set(rows.map((r) => dateOf(r)).filter(isSaneDate))].sort();
    return eoaDates.map((date) => {
      let ended = 0;
      let warnings = 0;
      for (const r of rows) {
        if (dateOf(r) !== date) continue;
        const raw = String(r[keyField] ?? "");
        const key = normalize ? normalize(raw) : raw;
        if (key !== keyValue) continue;
        ended += num(r, "结束人次");
        warnings += num(r, "警告人次");
      }
      return { date, ended, warnings };
    });
  };
  const eoaDailySup: Record<string, EoaDay[]> = {};
  for (const s of eoaBySup) eoaDailySup[s.name] = buildEoaDaily(mEoa, "供应商", s.name, normalizeAgency);
  const eoaDailyWh: Record<string, EoaDay[]> = {};
  for (const w of eoaByWh) eoaDailyWh[w.name] = buildEoaDaily(inMonth(eoaWhRows, month), "仓库", w.name, normalizeWarehouse);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">人力管理 Workforce Management</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">月报 Monthly Report</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">{month ? `${monthLabel(month)} · ${periodLabel}` : "本月暂无数据"}</p>
            </div>
          </div>
        </header>

        {/* 动画全部是下面这段纯 CSS；换月时 key 变化，互动区状态跟着重置，动画重新跑一遍 */}
        <style>{`
          @keyframes mFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes mGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          @keyframes mGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
          @keyframes mPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
          .m-fade { animation: mFadeUp 0.6s ease both; }
          .m-bar { transform-origin: left center; animation: mGrowX 0.9s ease both; }
          .m-col { transform-origin: bottom center; animation: mGrowY 0.7s ease both; }
          .m-pop { animation: mPop 0.4s ease both; }
          .m-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
          .m-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10); }
        `}</style>

        {!month ? (
          <div className="px-5 py-7 md:px-8">
            <p className="text-sm text-slate-500">暂无符合条件的月份数据（月份要 ≥2000-01-01，且至少在两张表里出现过，或只有删除表但当月被结束+警告 ≥20 人次）。</p>
          </div>
        ) : (
          <div key={month} className="px-5 py-7 md:px-8">
            {/* 月份选择：一次只看一个月 */}
            <div className="m-fade mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-slate-700">选择月份 Month</span>
              {allMonths.map((m) => (
                <Link
                  key={m}
                  href={`/monthly?month=${m}`}
                  className="rounded-full px-4 py-1.5 text-sm font-semibold"
                  style={m === month ? { backgroundColor: "#6366f1", color: "#ffffff" } : { backgroundColor: "#f1f5f9", color: "#334155" }}
                >
                  {monthLabel(m)}
                </Link>
              ))}
              <span className="ml-auto text-xs text-slate-400">默认显示有到岗数据的最新月份</span>
            </div>

            {/* 数字条：只有数字，不写判断句 */}
            <section className="m-fade m-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" style={{ borderLeftWidth: "6px", borderLeftColor: "#6366f1", animationDelay: "0.05s" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{monthLabel(month)} · 本月数字 Monthly Numbers</p>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div><p className="text-3xl font-bold" style={{ color: "#6366f1" }}>{hasDemand ? formatNumber(demand) : "—"}</p><p className="mt-1 text-xs text-slate-500">需求 Demand</p></div>
                <div><p className="text-3xl font-bold" style={{ color: "#0ea5e9" }}>{hasAlloc ? formatNumber(issued) : "—"}</p><p className="mt-1 text-xs text-slate-500">已发单 Issued</p></div>
                <div><p className="text-3xl font-bold" style={{ color: "#14b8a6" }}>{hasAlloc ? formatNumber(dispatched) : "—"}</p><p className="mt-1 text-xs text-slate-500">已派遣 Dispatched</p></div>
                <div><p className="text-3xl font-bold" style={{ color: "#f59e0b" }}>{hasArrival ? formatNumber(scheduled) : "—"}</p><p className="mt-1 text-xs text-slate-500">应到岗 Scheduled</p></div>
                <div><p className="text-3xl font-bold" style={{ color: "#10b981" }}>{hasArrival ? formatNumber(accepted) : "—"}</p><p className="mt-1 text-xs text-slate-500">已接受 Accepted</p></div>
                <div><p className="text-3xl font-bold" style={{ color: "#6366f1" }}>{fulfillment !== null ? formatPercent(fulfillment) : "—"}</p><p className="mt-1 text-xs text-slate-500">需求满足率 Fulfillment Rate</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                <span>No Show <strong>{hasArrival ? formatNumber(noshow) : "—"}</strong></span>
                <span>被退回 Sent Back <strong>{hasArrival ? formatNumber(sentback) : "—"}</strong></span>
                <span>派遣率 Dispatch Rate <strong>{dispatchRate !== null ? formatPercent(dispatchRate) : "—"}</strong></span>
              </div>
            </section>

            {/* 互动区：漏斗 + 每日堆叠柱 + 排名（key={month} 保证换月时状态重置） */}
            <MonthlyInteractive
              key={month}
              funnel={funnel}
              daily={daily}
              dailyBySupplier={dailyBySupplier}
              dailyByWarehouse={dailyByWarehouse}
              dailyByJob={dailyByJob}
              issued={dailyIssued}
              issuedBySupplier={dailyIssuedBySupplier}
              issuedByWarehouse={dailyIssuedByWarehouse}
              issuedByJob={dailyIssuedByJob}
              suppliers={suppliers}
              warehouses={warehouses}
              jobs={jobs}
              hasArrival={hasArrival}
            />

            {/* 被结束：单独一块，不进达成率；只留按供应商、按仓库两张，左右一边一个，互动在 EoaInteractive 里 */}
            <section className="m-fade m-card mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animationDelay: "0.55s" }}>
              <h3 className="text-lg font-bold">被结束 End of Assignment</h3>
              <p className="mt-1 text-xs text-slate-400">这里是删除表的数据，跟上面达成率是两回事，不放在一起算；下面两张都只写人次，不算率</p>
              {hasEoa ? (
                <div className="mt-4">
                  <EoaInteractive
                    key={month}
                    totalEnded={eoaTotalEnded}
                    totalWarning={eoaTotalWarning}
                    suppliers={eoaBySup}
                    warehouses={eoaByWh}
                    dailySup={eoaDailySup}
                    dailyWh={eoaDailyWh}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">本月删除表没有数据。</p>
              )}
            </section>

            {/* 口径说明：只留公式和颜色 */}
            <section className="m-fade mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-500 shadow-sm" style={{ animationDelay: "0.65s" }}>
              <h3 className="font-bold text-slate-700">口径说明 Notes</h3>
              <p className="mt-2">达成率 = 已接受 ÷ 已发单；需求满足率 = 已接受 ÷ 需求；派遣率 = 已派遣 ÷ 已发单。颜色：绿 ≥60%、黄 40–60%、红 &lt;40%。</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
