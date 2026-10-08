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

export default function SupplierPage() {
  const { demand, supplierSummary, matchSupplierArrival, arrivalTrackingSupplier } = getDashboardData();

  // 到场率：发单已派遣 × 到岗实到
  const supMatchMap = new Map<string, { arrivalRate: number | null }>(
    (((matchSupplierArrival ?? []) as CsvRow[]).map((r: CsvRow) => {
      const v = getValue(r, ["到岗率"]);
      return [
        getValue(r, ["供应商"]) || "未分类",
        { arrivalRate: v === null || v === undefined || v === "" ? null : Number(v) },
      ] as [string, { arrivalRate: number | null }];
    }))
  );

  // 到岗表按供应商：实际到场、已接受
  const atSupMap = new Map<string, { actualArrived: number; accepted: number }>(
    (((arrivalTrackingSupplier ?? []) as CsvRow[]).map((r: CsvRow) => {
      const total = numberValue(getValue(r, ["到岗人次"]));
      const noshow = numberValue(getValue(r, ["NoShow人次"]));
      const accepted = numberValue(getValue(r, ["已接受人次"]));
      return [
        getValue(r, ["供应商"]) || "未分类",
        { actualArrived: total - noshow, accepted },
      ] as [string, { actualArrived: number; accepted: number }];
    }))
  );

  const suppliers: SupplierRow[] = (supplierSummary as CsvRow[])
    .map((row) => {
      const name = getValue(row, ["供应商", "供应商名称"]) || "未分类";
      const requested = numberValue(getValue(row, ["需求人数", "供应商需派遣人数"]));
      const filled = numberValue(getValue(row, ["已派遣人数", "供应商已派遣人数"]));
      const unfilled = Math.max(requested - filled, 0);
      const dispatchRate = requested > 0 ? (filled / requested) * 100 : 0;
      const m = supMatchMap.get(name);
      const at = atSupMap.get(name);
      const accepted = at?.accepted ?? null;
      return {
        name,
        requested,
        filled,
        unfilled,
        dispatchRate,
        actualArrived: at?.actualArrived ?? null,
        arrivalRate: m?.arrivalRate ?? null,
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
  const overallFulfillment = totalRequested > 0 ? (totalAccepted / totalRequested) * 100 : 0;

  const best = suppliers[0] ?? null;
  const worst = [...suppliers].sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999))[0] ?? null;
  const largestGap = [...suppliers].sort((a, b) => b.unfilled - a.unfilled)[0] ?? null;

  const demandDates = (demand as CsvRow[]).map((r) => getValue(r, ["需求日期", "日期"])).filter(Boolean).sort();
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
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">供应商分析 Supplier Analysis</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">{periodLabel}</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* Hero insights */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">供应商表现 Supplier Performance</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {suppliers.length} 家供应商
              </h2>
              <p className="mt-1 text-sm font-medium text-indigo-200">
                {suppliers.length} suppliers
              </p>
              <p className="mt-3 text-sm leading-6 text-indigo-100">
                {formatNumber(totalAccepted)} / {formatNumber(totalRequested)} 人次最终被接受。
                {best?.fulfillmentRate != null && <>达成率最高的是 <strong className="text-white">{best.name}</strong>（{formatPercent(best.fulfillmentRate)}），</>}
                {worst?.fulfillmentRate != null && <>最低的是 <strong className="text-white">{worst.name}</strong>（{formatPercent(worst.fulfillmentRate)}）。</>}
              </p>
              <div className="mt-6 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalRequested)}</p>
                  <p className="mt-1 text-xs text-indigo-200">已发单<br />Requested</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalFilled)}</p>
                  <p className="mt-1 text-xs text-indigo-200">已派遣<br />Dispatched</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalArrived)}</p>
                  <p className="mt-1 text-xs text-indigo-200">实际到场<br />Arrived</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalAccepted)}</p>
                  <p className="mt-1 text-xs text-indigo-200">已接受<br />Accepted</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight cards */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {best?.fulfillmentRate != null && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">🏆 达成率最高 Best</p>
                <p className="mt-3 truncate text-lg font-bold">{best.name}</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatPercent(best.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(best.accepted ?? 0)} / {formatNumber(best.requested)} 已接受 accepted</p>
              </div>
            )}
            {worst?.fulfillmentRate != null && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">⚠️ 达成率最低 Attention</p>
                <p className="mt-3 truncate text-lg font-bold">{worst.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatPercent(worst.fulfillmentRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(worst.accepted ?? 0)} / {formatNumber(worst.requested)} 已接受 accepted</p>
              </div>
            )}
            {largestGap && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">📊 最大缺口 Largest Gap</p>
                <p className="mt-3 truncate text-lg font-bold">{largestGap.name}</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{formatNumber(largestGap.unfilled)}</p>
                <p className="mt-2 text-xs text-slate-500">未派遣 Undispatched · 缺口率 Gap rate {formatPercent(100 - largestGap.dispatchRate)}</p>
              </div>
            )}
          </section>

          {/* Visual ranking */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">供应商排名 Supplier Ranking</h3>
                <p className="mt-1 text-xs text-slate-400">按达成率从高到低排序 Rank by Fulfillment Rate (High to Low) · 数据来源：用工需求池（发单详情）+ 人员到岗表 Source: Labor Demand Pool + Arrival Tracking</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{suppliers.length} 家 suppliers</span>
            </div>

            <div className="mt-6 space-y-5">
              {suppliers.map((s, i) => {
                const fr = s.fulfillmentRate ?? 0;
                const barColor = fr >= 80 ? "from-emerald-400 to-emerald-600"
                  : fr >= 60 ? "from-amber-400 to-amber-600"
                  : "from-rose-400 to-rose-600";
                const textColor = fr >= 80 ? "text-emerald-600"
                  : fr >= 60 ? "text-amber-600" : "text-rose-600";
                const arrivalAbnormal = s.arrivalRate !== null && (s.arrivalRate > 115 || s.arrivalRate < 70);
                return (
                  <div key={s.name} className="group rounded-2xl border border-slate-100 p-4 transition hover:border-indigo-100 hover:bg-indigo-50/30 md:p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                        }`}>{i + 1}</span>
                        <span className="truncate text-sm font-semibold">{s.name}</span>
                      </div>
                      <span className={`ml-4 shrink-0 text-lg font-bold ${textColor}`}>
                        {s.fulfillmentRate !== null ? formatPercent(s.fulfillmentRate) : "—"}
                      </span>
                    </div>
                    <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                        style={{ width: `${Math.min(fr, 100)}%` }}
                      />
                    </div>
                    <div className="ml-11 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 md:grid-cols-4">
                      <span>{formatNumber(s.requested)} 已发单 Issued</span>
                      <span>
                        {formatNumber(s.filled)} 已派遣 Dispatched
                        <span className="text-slate-500"> ({formatPercent(s.dispatchRate)})</span>
                      </span>
                      {s.actualArrived !== null ? (
                        <span>
                          {formatNumber(s.actualArrived)} 实际到场 Arrived
                          {s.arrivalRate !== null && (
                            <span className={arrivalAbnormal ? "font-semibold text-amber-600" : "text-slate-500"}>
                              {" "}({formatPercent(s.arrivalRate)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">实际到场 —</span>
                      )}
                      {s.accepted !== null ? (
                        <span className="font-medium text-emerald-600">
                          {formatNumber(s.accepted)} 已接受 Accepted
                        </span>
                      ) : (
                        <span className="text-slate-300">已接受 —</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
