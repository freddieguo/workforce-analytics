import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import SentBackScatter from "@/components/SentBackScatter";
import SentBackTable from "@/components/SentBackTable";
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

  const { arrivalTrackingDailySupplier, arrivalTrackingDailyWarehouse, arrivalTrackingDailyReason, demandDaily, allocDaily } = getDashboardData();

  // 口径：被退回人次（到了但不符合要求被退回）。日期按到岗日期算。
  const supRows = ((arrivalTrackingDailySupplier ?? []) as CsvRow[]);
  const whRows = ((arrivalTrackingDailyWarehouse ?? []) as CsvRow[]);
  const reasonRows = ((arrivalTrackingDailyReason ?? []) as CsvRow[]);
  const demandRows = ((demandDaily ?? []) as CsvRow[]);
  const allocRows = ((allocDaily ?? []) as CsvRow[]);
  // 日期范围跟别的页对齐：需求 + 发单 + 到岗的日期并集（不只是到岗三张表）
  const allDates = [
    ...supRows.map((r) => getValue(r, ["日期"])),
    ...whRows.map((r) => getValue(r, ["日期"])),
    ...reasonRows.map((r) => getValue(r, ["日期"])),
    ...demandRows.map((r) => getValue(r, ["日期"])),
    ...allocRows.map((r) => getValue(r, ["日期"])),
  ];
  const { start, end, min, max } = resolveRange(allDates, startParam, endParam);

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

  // 拟到岗总人次、No Show、已接受（算新口径被退回率的分母：有效到岗 = 拟到岗 − No Show）
  const supDetailRows = sumByKey(filterByDateRange(supRows, start, end), "供应商",
    ["拟到岗人次", "NoShow人次", "已接受人次", "被退回人次"]);
  const totalScheduled = supDetailRows.reduce((s, r) => s + (Number(r["拟到岗人次"] ?? 0) || 0), 0);
  const totalNoshow = supDetailRows.reduce((s, r) => s + (Number(r["NoShow人次"] ?? 0) || 0), 0);
  const totalEffective = totalScheduled - totalNoshow;
  // 新口径：被退回率 = 被退回 ÷ 有效到岗（剔除 No Show），不再除以拟到岗
  const sentBackRate = totalEffective > 0 ? (total / totalEffective) * 100 : 0;

  // 悬停卡全链路：供应商按原名，仓库按归一化名合并（同一仓中英文写法合并）
  const supDetail = new Map<string, { scheduled: number; noshow: number; accepted: number; effective: number }>();
  for (const r of supDetailRows) {
    const name = String(r["供应商"] ?? "未分类");
    const scheduled = Number(r["拟到岗人次"] ?? 0) || 0;
    const noshow = Number(r["NoShow人次"] ?? 0) || 0;
    supDetail.set(name, {
      scheduled,
      noshow,
      accepted: Number(r["已接受人次"] ?? 0) || 0,
      effective: scheduled - noshow,
    });
  }
  const whDetail = new Map<string, { scheduled: number; noshow: number; accepted: number; effective: number }>();
  for (const r of sumByKey(filterByDateRange(whRows, start, end), "仓库",
    ["拟到岗人次", "NoShow人次", "已接受人次", "被退回人次"])) {
    const name = normalizeWarehouseDisplay(String(r["仓库"] ?? "未分类"));
    const scheduled = Number(r["拟到岗人次"] ?? 0) || 0;
    const noshow = Number(r["NoShow人次"] ?? 0) || 0;
    const old = whDetail.get(name) ?? { scheduled: 0, noshow: 0, accepted: 0, effective: 0 };
    old.scheduled += scheduled;
    old.noshow += noshow;
    old.accepted += Number(r["已接受人次"] ?? 0) || 0;
    old.effective += scheduled - noshow;
    whDetail.set(name, old);
  }
  const suppliersDetailed = suppliers.map((s) => {
    const d = supDetail.get(s.name);
    return { ...s, effectiveArrived: d?.effective ?? null, accepted: d?.accepted ?? null, noshow: d?.noshow ?? null, scheduled: d?.scheduled ?? null, share: total > 0 ? (s.failure / total) * 100 : 0 };
  });
  const warehousesDetailed = warehouses.map((w) => {
    const d = whDetail.get(w.name);
    return { ...w, effectiveArrived: d?.effective ?? null, accepted: d?.accepted ?? null, noshow: d?.noshow ?? null, scheduled: d?.scheduled ?? null, share: total > 0 ? (w.failure / total) * 100 : 0 };
  });
  // 原因维度没有按原因的到岗数，分母只能用全公司有效到岗，悬停卡里标明全公司，避免误会成该原因自己的到岗数
  // 占比 Share 不再列在主表，只放悬停卡，所以这里也传 share
  const reasonsDetailed = reasons.map((r) => ({
    ...r,
    effectiveArrived: totalEffective,
    effectiveLabel: "有效到岗（全公司） Effective Arrived (All)",
    share: total > 0 ? (r.failure / total) * 100 : 0,
  }));

  const topSup = suppliers[0];
  const topWh = warehouses[0];
  const topReason = reasons[0];

  const top3SupShare = total > 0
    ? (suppliers.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;
  const top3WhShare = total > 0
    ? (warehouses.slice(0, 3).reduce((s, r) => s + r.failure, 0) / total) * 100 : 0;

  // 散点图：按供应商，横轴拟到岗量，纵轴被退回率（被退回 ÷ 有效到岗，剔除 No Show）
  const scatterRows = sumByKey(filterByDateRange(supRows, start, end), "供应商", ["被退回人次", "拟到岗人次", "NoShow人次", "已接受人次"])
    .map((r) => {
      const scheduled = Number(r["拟到岗人次"] ?? 0) || 0;
      const sentBack = Number(r["被退回人次"] ?? 0) || 0;
      const noshow = Number(r["NoShow人次"] ?? 0) || 0;
      const effective = scheduled - noshow;
      return {
        name: String(r["供应商"] ?? "未分类"),
        scheduled,
        sentBack,
        rate: effective > 0 ? (sentBack / effective) * 100 : null,
        share: total > 0 ? (sentBack / total) * 100 : 0,
        effectiveArrived: effective,
        noshow,
        accepted: Number(r["已接受人次"] ?? 0) || 0,
      };
    })
    .filter((r) => r.name !== "未分类" && r.scheduled > 0);

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

          {/* Hero：供应商页同款白卡 */}
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">被退回概览 Sent-back Overview</p>
          <section className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">被退回总人次 Total Sent Back</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-rose-600">{formatNumber(total)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">口径：到了但不符合要求被退回的人次</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">被退回率 Sent-back Rate</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">
                {formatPercent(sentBackRate)}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                被退回 ÷ 有效到岗 = {formatNumber(total)} ÷ {formatNumber(totalEffective)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">涉及供应商 Suppliers</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{suppliers.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {topSup && <>最多 {topSup.name} {formatNumber(topSup.failure)} 人次 · 前三占比 {formatPercent(top3SupShare)}</>}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">涉及仓库 Warehouses</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{warehouses.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {topWh && <>最多 {topWh.name} {formatNumber(topWh.failure)} 人次 · 前三占比 {formatPercent(top3WhShare)}</>}
              </p>
            </div>
          </section>

          {/* 散点图：按供应商，拟到岗量 vs 被退回率 */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <h3 className="text-lg font-bold">拟到岗量 vs 被退回率 Scheduled vs Sent-back Rate</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-400">上面（退回率高）最值得看，圆点越大被退回越多</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                悬停圆点看详情
              </span>
            </div>
            <div className="mt-4">
              <SentBackScatter rows={scatterRows} />
            </div>
          </section>

          {/* 需要盯紧：一条紧凑预警横条 */}
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
                  被退回最多，{formatNumber(topSup.failure)} 人次，
                  占全部 {formatPercent(total > 0 ? (topSup.failure / total) * 100 : 0)}，优先处理。
                  {topWh && topWh.name !== topSup.name && (
                    <>
                      另 <strong className="text-amber-600">{topWh.name}</strong> 仓库被退回最多，
                      {formatNumber(topWh.failure)} 人次。
                    </>
                  )}
                  {topReason && (
                    <>
                      最多的退回原因是 <strong className="text-indigo-600">{topReason.name}</strong>，
                      {formatNumber(topReason.failure)} 人次。
                    </>
                  )}
                </p>
              </div>
            </section>
          )}

          {/* 明细：跟供应商/仓库表同一套格式，三张表 */}
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-bold">供应商排名 By Supplier</h3>
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-4"><SentBackTable items={suppliersDetailed} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-bold">仓库排名 By Warehouse</h3>
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-4"><SentBackTable items={warehousesDetailed} /></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <h3 className="text-lg font-bold">原因排名 By Reason</h3>
              <p className="mt-1 text-xs text-slate-400">按被退回人次排序 Rank by Sent-back Count</p>
              <div className="mt-4"><SentBackTable items={reasonsDetailed} /></div>
            </div>
          </section>

          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">被退回率 = 被退回人次 ÷ 有效到岗人次（剔除 No Show） · Sent-back rate = sent back ÷ effective arrived</p>
          </div>
        </div>
      </main>
    </div>
  );
}
