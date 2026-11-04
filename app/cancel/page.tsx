import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import CancelTable from "@/components/CancelTable";
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
    const e = keys.find((k) => k === c);
    if (e) return row[e];
  }
  for (const c of candidates) {
    const p = keys.find((k) => k.includes(c));
    if (p) return row[p];
  }
  return "";
}

/* 删除表里的 agency 短名 -> 其他页用的全名，跟供应商页对齐。
   表里空 agency 的那 1 行归未分类，不硬编到某家。 */
const AGENCY_ALIAS: Record<string, string> = {
  "CITI STAFF": "CitiStaff Solutions",
  "PROMPT": "Prompt Priority INC",
  "Direct Staffing": "Direct Staffing LLC.",
  "VOYAGE": "Voyage Employer Services",
  "OSI": "OSI Staffing Inc.",
  "One Source Inc": "One Source Staffing Inc.",
  "iStaffing": "iStaffing Partners Inc.",
  "FAIRWAY": "Fairway Staffing Service",
  "PRIORITY WORKFORCE": "Workforce Priority INC",
  "GRANDE": "GRANDE SOLUTIONS LLC-USCA",
  "CSS": "CSS Employment Group",
};
function normalizeAgency(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return "未分类";
  return AGENCY_ALIAS[raw] ?? raw;
}
/* 删除表里的仓库写法是 CA #19 / LA#9 / LA-32 这种，按数字归到洛杉矶X号仓，跟到岗表对齐。 */
function normalizeWarehouseDisplay(name: string): string {
  const num = name.match(/(\d+)/)?.[1] ?? "";
  if (!num) return name;
  return `洛杉矶${num}号仓`;
}

export default async function CancelPage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  /* 管线数据集：见管线说明，eoa_daily_* 由删除表产出。
     管线还没跑出来时这里是空数组，页面会显示暂无数据说明，不会报错。
     已接受来自人员到岗表 arrival_tracking_daily_*，是累计数，不按删除表
     的日期筛选（两张表时间本来就不一样，硬按同一天筛会筛成 0，误导人）。 */
  const data: any = getDashboardData();
  const supRows = ((data.eoaDailySupplier ?? []) as CsvRow[]);
  const whRows = ((data.eoaDailyWarehouse ?? []) as CsvRow[]);
  const arrivalSupRows = ((data.arrivalTrackingDailySupplier ?? []) as CsvRow[]);
  const arrivalWhRows = ((data.arrivalTrackingDailyWarehouse ?? []) as CsvRow[]);

  const allDates = [
    ...supRows.map((r) => getValue(r, ["日期"])),
    ...whRows.map((r) => getValue(r, ["日期"])),
  ];
  const { start, end, min, max } = resolveRange(allDates, startParam, endParam);

  const mapRows = (
    summed: Array<Record<string, unknown>>,
    nameField: string,
    normalize?: (n: string) => string
  ) => {
    const m = new Map<string, { ended: number; warnings: number }>();
    for (const r of summed) {
      const raw = String(r[nameField] ?? "未分类") || "未分类";
      const name = normalize ? normalize(raw) : raw;
      const old = m.get(name) ?? { ended: 0, warnings: 0 };
      old.ended += Number(r["结束人次"] ?? 0) || 0;
      old.warnings += Number(r["警告人次"] ?? 0) || 0;
      m.set(name, old);
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ended: v.ended, warnings: v.warnings }))
      .filter((r) => r.ended + r.warnings > 0)
      .sort((a, b) => b.ended - a.ended || (b.ended + b.warnings) - (a.ended + a.warnings));
  };

  const suppliersBase = mapRows(
    sumByKey(filterByDateRange(supRows, start, end), "供应商", ["结束人次", "警告人次"]),
    "供应商",
    normalizeAgency
  );
  const warehousesBase = mapRows(
    sumByKey(filterByDateRange(whRows, start, end), "仓库", ["结束人次", "警告人次"]),
    "仓库",
    normalizeWarehouseDisplay
  );

  /* 已接受（到岗表累计）：到岗表里的供应商名已经是全名，跟上面
     normalizeAgency 之后的名字能直接对上；仓库按数字归到洛杉矶X号仓，
     跟上面 normalizeWarehouseDisplay 之后的名字能直接对上。
     没对上的（到岗表里没这家）留 undefined，悬停卡显示 —，不写成 0。 */
  const acceptedBySupplier = new Map<string, number>();
  for (const r of arrivalSupRows) {
    const name = normalizeAgency(String(getValue(r, ["供应商"]) || "未分类"));
    acceptedBySupplier.set(name, (acceptedBySupplier.get(name) ?? 0) + (Number(getValue(r, ["已接受人次"])) || 0));
  }
  const acceptedByWarehouse = new Map<string, number>();
  for (const r of arrivalWhRows) {
    const name = normalizeWarehouseDisplay(String(getValue(r, ["仓库"]) || "未分类"));
    acceptedByWarehouse.set(name, (acceptedByWarehouse.get(name) ?? 0) + (Number(getValue(r, ["已接受人次"])) || 0));
  }
  const suppliers = suppliersBase.map((s) => ({ ...s, accepted: acceptedBySupplier.get(s.name) }));
  const warehouses = warehousesBase.map((s) => ({ ...s, accepted: acceptedByWarehouse.get(s.name) }));

  const totalEnded = suppliers.reduce((s, r) => s + r.ended, 0)
    || warehouses.reduce((s, r) => s + r.ended, 0);
  const totalWarnings = suppliers.reduce((s, r) => s + r.warnings, 0)
    || warehouses.reduce((s, r) => s + r.warnings, 0);
  const totalRows = totalEnded + totalWarnings;

  const topSup = suppliers[0];
  const topWh = warehouses[0];
  const namedSuppliers = suppliers.filter((s) => s.name !== "未分类");

  const periodLabel = start && end
    ? `${formatDateLabel(start)} — ${formatDateLabel(end)}`
    : "—";

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">劳动质量 Labor Quality</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">被结束分析 Cancel Analysis</h1>
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
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <DateRangePicker start={start} end={end} min={min} max={max} />
          </div>

          {totalRows === 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              暂无删除表数据：把删除表（10_2026.xlsx 这类）放进 data/raw/，跑 python scripts/run_all.py，管线产出 eoa_daily_supplier、eoa_daily_warehouse 两个数据集后，这一页就会有数。日期筛选只对删除表里的日期起作用。
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">被结束概览 Cancel Overview</p>
          <section className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">被结束总人次 Total Ended</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-rose-600">{formatNumber(totalEnded)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">口径：删除表里 End of Assignment 的行数，人次不去重</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">警告总人次 Total Warnings</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-amber-600">{formatNumber(totalWarnings)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">口头、书面、书面+最终警告三类都算警告</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">涉及供应商 Suppliers</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{namedSuppliers.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {topSup && <>最多 {topSup.name} 被结束 {formatNumber(topSup.ended)} 人次 · 占全部被结束 {formatPercent(totalEnded > 0 ? (topSup.ended / totalEnded) * 100 : 0)}</>}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">涉及仓库 Warehouses</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{warehouses.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {topWh && <>最多 {topWh.name} 被结束 {formatNumber(topWh.ended)} 人次 · 占全部被结束 {formatPercent(totalEnded > 0 ? (topWh.ended / totalEnded) * 100 : 0)}</>}
              </p>
            </div>
          </section>

          {topSup && (
            <section className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4 shadow-sm md:p-5">
              <span className="mt-0.5 text-xl">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">
                  需要盯紧 Needs Attention
                  <span className="ml-2 font-normal text-slate-400">系统自动挑出最值得看的问题</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  <strong className="text-rose-600">{topSup.name}</strong>
                  被结束最多，{formatNumber(topSup.ended)} 人次，
                  占全部被结束 {formatPercent(totalEnded > 0 ? (topSup.ended / totalEnded) * 100 : 0)}，优先处理。
                  {topWh && (
                    <>
                      另 <strong className="text-amber-600">{topWh.name}</strong> 被结束最多，
                      {formatNumber(topWh.ended)} 人次。
                    </>
                  )}
                </p>
              </div>
            </section>
          )}

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-bold">供应商排名 By Supplier</h3>
              <p className="mt-1 text-xs text-slate-400">按被结束人数排序 Rank by Ended Count</p>
              <div className="mt-4"><CancelTable items={suppliers} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-bold">仓库排名 By Warehouse</h3>
              <p className="mt-1 text-xs text-slate-400">按被结束人数排序 Rank by Ended Count</p>
              <div className="mt-4"><CancelTable items={warehouses} /></div>
            </div>
          </section>

          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">数据来源：删除表 End of Assignment / Warning · 人次不去重，同一工号多次出现算多次 · 被结束占比 = 该家被结束 ÷ 该家合计（被结束+警告），不进首日达成率 · 悬停卡里的已接受来自人员到岗表累计，时间跟删除表不同，只作规模对比</p>
          </div>
        </div>
      </main>
    </div>
  );
}
