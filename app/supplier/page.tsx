import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import SupplierTable from "@/components/SupplierTable";
import SupplierScatter from "@/components/SupplierScatter";
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

type SupplierRow = {
  name: string;
  requested: number;
  filled: number;
  unfilled: number;
  dispatchRate: number;
  actualArrived: number | null;
  arrivalRate: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
};

export default async function SupplierPage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  const { allocDailySupplier, arrivalTrackingDailySupplier, demandDaily, allocDaily } = getDashboardData();

  // 日期范围：跟别的页对齐（需求 + 发单 + 到岗的日期并集）
  const allocRows = ((allocDailySupplier ?? []) as CsvRow[]);
  const atRows = ((arrivalTrackingDailySupplier ?? []) as CsvRow[]);
  const { start, end, min, max } = resolveRange(
    [...allocRows.map((r) => getValue(r, ["日期"])),
     ...atRows.map((r) => getValue(r, ["日期"])),
     ...((demandDaily ?? []) as CsvRow[]).map((r) => getValue(r, ["日期"])),
     ...((allocDaily ?? []) as CsvRow[]).map((r) => getValue(r, ["日期"]))],
    startParam,
    endParam
  );

  // 选定范围内按供应商汇总：发单（已发单/已派遣）+ 到岗（到岗/NoShow/已接受）
  const allocBySup = new Map<string, Record<string, unknown>>(
    sumByKey(filterByDateRange(allocRows, start, end), "供应商",
      ["已发单人数", "已派遣人数", "未派遣人数"])
      .map((r) => [String(r["供应商"]), r])
  );
  const atBySup = new Map<string, Record<string, unknown>>(
    sumByKey(filterByDateRange(atRows, start, end), "供应商",
      ["到岗人次", "NoShow人次", "已接受人次"])
      .map((r) => [String(r["供应商"]), r])
  );

  const suppliers: SupplierRow[] = [...allocBySup.keys()]
    .map((name) => {
      const a = allocBySup.get(name)!;
      const at = atBySup.get(name);
      const requested = Number(a["已发单人数"] ?? 0);
      const filled = Number(a["已派遣人数"] ?? 0);
      const unfilled = Math.max(requested - filled, 0);
      const dispatchRate = requested > 0 ? (filled / requested) * 100 : 0;
      const total = at ? Number(at["到岗人次"] ?? 0) : 0;
      const noshow = at ? Number(at["NoShow人次"] ?? 0) : 0;
      const actualArrived = at ? total - noshow : null;
      const accepted = at ? Number(at["已接受人次"] ?? 0) : null;
      const arrivalRate = actualArrived !== null && filled > 0
        ? (actualArrived / filled) * 100 : null;
      return {
        name,
        requested,
        filled,
        unfilled,
        dispatchRate,
        actualArrived,
        arrivalRate,
        accepted,
        fulfillmentRate: accepted !== null && requested > 0 ? (accepted / requested) * 100 : null,
      };
    })
    .filter((s) => s.name !== "未分类")
    .sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1));

  const totalRequested = suppliers.reduce((s, x) => s + x.requested, 0);
  const totalFilled = suppliers.reduce((s, x) => s + x.filled, 0);
  const totalArrived = suppliers.reduce((s, x) => s + (x.actualArrived ?? 0), 0);
  const totalAccepted = suppliers.reduce((s, x) => s + (x.accepted ?? 0), 0);
  const best = suppliers[0] ?? null;
  const worst = [...suppliers].sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  const largestGap = [...suppliers].sort((a, b) => b.unfilled - a.unfilled)[0] ?? null;

  /* 需要盯紧：自动挑问题 */
  // 1. 最危险：量大（>=150）但达成率最低
  const dangerous = suppliers
    .filter((s) => s.fulfillmentRate !== null && s.requested >= 150)
    .sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  // 2. 样本小但达成率虚高：量小（<150）但达成率>=80
  const inflated = suppliers
    .filter((s) => s.fulfillmentRate !== null && s.requested < 150 && (s.fulfillmentRate ?? 0) >= 80)
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
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">供应商分析 Supplier Analysis</h1>
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

          {/* Hero：首页指标卡风格 */}
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">供应商概览 Supplier Overview</p>
          <section className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">供应商数量 Suppliers</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{suppliers.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">家供应商参与派遣</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">达成率 Fulfillment</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">
                {totalRequested > 0 ? formatPercent((totalAccepted / totalRequested) * 100) : "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                已接受 ÷ 已发单 = {formatNumber(totalAccepted)} ÷ {formatNumber(totalRequested)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">已派遣 Dispatched</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{formatNumber(totalFilled)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                派遣率 {totalRequested > 0 ? formatPercent((totalFilled / totalRequested) * 100) : "—"}
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

          {/* 散点图：发单量 vs 达成率 */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <h3 className="text-lg font-bold">发单量 vs 达成率 Volume vs Fulfillment</h3>
            <p className="mt-1 text-xs text-slate-400">右下（量大率低）最危险 · 悬停圆点看详情</p>
            <div className="mt-4">
              <SupplierScatter suppliers={suppliers} />
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
                  （发单 {formatNumber(dangerous.requested)} 人次）达成率仅{" "}
                  <strong className="text-rose-600">{formatPercent(dangerous.fulfillmentRate ?? 0)}</strong>
                  ，量大率低优先处理。
                  {largestGap && largestGap.name !== dangerous.name && (
                    <>
                      另 <strong className="text-amber-600">{largestGap.name}</strong> 缺口最大，
                      {formatNumber(largestGap.unfilled)} 人次没派出去。
                    </>
                  )}
                  {inflated && (
                    <>
                      <strong className="text-indigo-600">{inflated.name}</strong> 达成率{" "}
                      {formatPercent(inflated.fulfillmentRate ?? 0)} 看着高但只做了{" "}
                      {formatNumber(inflated.requested)} 单，样本小别当主力。
                    </>
                  )}
                </p>
              </div>
            </section>
          )}

          {/* 供应商明细：表格 + 小bar + 排序切换 + 悬停详情 */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <h3 className="text-lg font-bold">供应商明细 Supplier Details</h3>
            <div className="mt-4">
              <SupplierTable suppliers={suppliers} />
            </div>
          </section>

          {/* Footer */}
          <div className="pb-8 pt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← 返回总览 Back to Overview</Link>
            <p className="mt-3 text-[11px] text-slate-400">达成率 = 已接受 ÷ 已发单 · Fulfillment rate = accepted ÷ issued</p>
          </div>
        </div>
      </main>
    </div>
  );
}
