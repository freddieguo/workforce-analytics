import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
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

/* 到岗表仓库名（英文）-> 中文显示：Los Angeles-8 / LA-21 -> 洛杉矶8号仓 / 洛杉矶21号仓；(CP)->(中邮) */
function normalizeWarehouseDisplay(name: string): string {
  const num = name.match(/(\d+)/)?.[1] ?? "";
  if (!num) return name;
  let suffix = name.match(/\(([^)]+)\)/)?.[1] ?? "";
  if (suffix.toUpperCase() === "CP") suffix = "中邮";
  let s = `洛杉矶${num}号仓`;
  if (suffix) s += `(${suffix})`;
  return s;
}

export default async function TrialFailurePage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  const { arrivalTrackingDailySupplier, arrivalTrackingDailyWarehouse, arrivalTrackingDailyReason } = getDashboardData();

  // 口径：被退回人次（到了但不符合要求被退回）。日期按到岗日期算。
  const supRows = ((arrivalTrackingDailySupplier ?? []) as CsvRow[]);
  const whRows = ((arrivalTrackingDailyWarehouse ?? []) as CsvRow[]);
  const reasonRows = ((arrivalTrackingDailyReason ?? []) as CsvRow[]);
  const { start, end, min, max } = resolveRange(
    [...supRows.map((r) => getValue(r, ["日期"])),
     ...whRows.map((r) => getValue(r, ["日期"])),
     ...reasonRows.map((r) => getValue(r, ["日期"]))],
    startParam,
    endParam
  );

  const mapRows = (
    summed: Array<Record<string, unknown>>,
    nameField: string,
    normalize?: (n: string) => string
  ) => {
    const m = new Map<string, number>();
    for (const r of summed) {
      const raw = String(r[nameField] ?? "未分类") || "未分类";
      const name = normalize ? normalize(raw) : raw;
      const v = Number(r["被退回人次"] ?? r["人次"] ?? 0) || 0;
      m.set(name, (m.get(name) ?? 0) + v);
    }
    return [...m.entries()]
      .map(([name, failure]) => ({ name, failure }))
      .filter((r) => r.name !== "未分类" && r.failure > 0)
      .sort((a, b) => b.failure - a.failure);
  };

  const suppliers = mapRows(
    sumByKey(filterByDateRange(supRows, start, end), "供应商", ["被退回人次"]),
    "供应商"
  );
  const warehouses = mapRows(
    sumByKey(filterByDateRange(whRows, start, end), "仓库", ["被退回人次"]),
    "仓库",
    normalizeWarehouseDisplay
  );
  const reasons = mapRows(
    sumByKey(filterByDateRange(reasonRows, start, end), "不符合要求原因", ["人次"]),
    "不符合要求原因"
  );

  const total = suppliers.reduce((s, r) => s + r.failure, 0)
    || warehouses.reduce((s, r) => s + r.failure, 0)
    || reasons.reduce((s, r) => s + r.failure, 0);

  // 拟到岗总人次（算退回率的分母）
  const totalScheduled = sumByKey(
    filterByDateRange(supRows, start, end), "供应商", ["拟到岗人次"]
  ).reduce((s, r) => s + (Number(r["拟到岗人次"] ?? 0) || 0), 0);
  const sentBackRate = totalScheduled > 0 ? (total / totalScheduled) * 100 : 0;

  const topSup = suppliers[0];
  const topWh = warehouses[0];
  const topReason = reasons[0];

  const top3SupShare = total > 0
    ? (suppliers.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;
  const top3WhShare = total > 0
    ? (warehouses.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;

  const periodLabel = start && end
    ? `${formatDateLabel(start)} — ${formatDateLabel(end)}`
    : "—";

  const RankList = ({ items, wrapName }: { items: { name: string; failure: number }[]; wrapName?: boolean }) => (
    <div className="space-y-4">
      {items.slice(0, 8).map((it, i) => (
        <div key={it.name}>
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                i < 3 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
              }`}>{i + 1}</span>
              <span className={wrapName ? "text-sm font-semibold leading-snug" : "max-w-[180px] truncate text-sm font-semibold"}>{it.name}</span>
            </div>
            <span className="ml-3 shrink-0 text-lg font-bold text-rose-600">{formatNumber(it.failure)}</span>
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
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">被退回分析 Sent Back Analysis</h1>
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

          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">被退回总览 Sent-back Overview</p>
              <div className="mt-4 flex items-end gap-6">
                <p className="text-6xl font-bold tracking-tight">{formatNumber(total)}</p>
                <div className="pb-2">
                  <p className="text-sm text-rose-100">被退回总人次 Total Sent Back</p>
                  <p className="mt-1 text-xs text-rose-200">口径：到了但不符合要求被退回的人次 · 数据来源：人员到岗表 Source: Arrival Tracking</p>
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
                  <p className="text-xl font-bold">{formatPercent(sentBackRate)}</p>
                  <p className="mt-1 text-xs text-rose-200">被退回率<br />Sent-back Rate</p>
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
            {topReason && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">🔴 最多原因 Top Reason</p>
                <p className="mt-3 text-lg font-bold leading-snug">{topReason.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatNumber(topReason.failure)}</p>
                <p className="mt-2 text-xs text-slate-500">占全部 {formatPercent(total > 0 ? (topReason.failure / total) * 100 : 0)}</p>
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
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-5"><RankList items={suppliers} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">仓库排名 By Warehouse</h3>
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-5"><RankList items={warehouses} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold">原因排名 By Reason</h3>
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-5"><RankList items={reasons} wrapName /></div>
            </div>
          </section>

          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">被退回率 = 被退回人次 ÷ 拟到岗人次 · Sent-back rate = sent back ÷ scheduled</p>
          </div>
        </div>
      </main>
    </div>
  );
}
