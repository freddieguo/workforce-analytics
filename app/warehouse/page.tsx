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

type WarehouseRow = {
  name: string;
  requested: number;
  filled: number;
  unfilled: number;
  rate: number;
  arrived: number | null;
  arrivalRate: number | null;
  accepted: number | null;
  acceptanceRate: number | null;
};

/* 仓库名归一化：中文"洛杉矶19号仓(TT)" vs 英文"Los Angeles Warehouse 19 (TT)"/"LA-21"
   按编号+括号后缀匹配，如 19|TT */
function warehouseKey(name: string): string {
  const num = name.match(/(\d+)/)?.[1] ?? "";
  let suffix = name.match(/\(([^)]+)\)/)?.[1]?.toUpperCase().trim() ?? "";
  // 中文后缀转英文缩写：中邮=CP
  const suffixMap: Record<string, string> = { "中邮": "CP" };
  suffix = suffixMap[suffix] ?? suffix;
  return `${num}|${suffix}`;
}

export default function WarehousePage() {
  const { demand, warehouseAllocSummary, warehouseSummary, matchWarehouseArrival, arrivalTrackingWarehouse } = getDashboardData();

  // 用发单详情口径（与首页一致）
  const whRows = (warehouseAllocSummary ?? []).length > 0 ? warehouseAllocSummary : warehouseSummary;

  // 到场率：发单已派遣 × 到岗实到
  const whMatchMap = new Map<string, { arrived: number; arrivalRate: number | null }>(
    ((((matchWarehouseArrival ?? []) as CsvRow[]).map((r: CsvRow) => {
      const v = getValue(r, ["到岗率"]);
      return [
        getValue(r, ["仓库"]) || "未分类",
        {
          arrived: numberValue(getValue(r, ["实到"])),
          arrivalRate: v === null || v === undefined || v === "" ? null : Number(v),
        },
      ] as [string, { arrived: number; arrivalRate: number | null }];
    })))
  );

  // 到岗表按仓库：实际到场、已接受（按归一化key匹配中英文仓名）
  const atWhMap = new Map<string, { actualArrived: number; accepted: number }>();
  for (const r of ((arrivalTrackingWarehouse ?? []) as CsvRow[])) {
    const total = numberValue(getValue(r, ["到岗人次"]));
    const noshow = numberValue(getValue(r, ["NoShow人次"]));
    const accepted = numberValue(getValue(r, ["已接受人次"]));
    const key = warehouseKey(getValue(r, ["仓库"]) || "");
    if (key && !key.startsWith("|")) {
      atWhMap.set(key, { actualArrived: total - noshow, accepted });
    }
  }
  // 查不到带后缀的key时，回退到只按编号匹配
  function findAtData(name: string) {
    const key = warehouseKey(name);
    return atWhMap.get(key) ?? atWhMap.get(key.split("|")[0] + "|") ?? null;
  }

  const warehouses: WarehouseRow[] = (whRows as CsvRow[])
    .map((row) => {
      const name = getValue(row, ["仓库", "需求仓", "物理仓"]) || "未分类";
      const requested = numberValue(getValue(row, ["需求人数", "供应商需派遣人数"]));
      const filled = numberValue(getValue(row, ["已派遣人数", "供应商已派遣人数"]));
      const unfilled = Math.max(requested - filled, 0);
      const rate = requested > 0 ? (filled / requested) * 100 : 0;
      const m = whMatchMap.get(name);
      const at = findAtData(name);
      const actualArrived = at?.actualArrived ?? null;
      const accepted = at?.accepted ?? null;
      return {
        name,
        requested,
        filled,
        unfilled,
        rate,
        arrived: m?.arrived ?? actualArrived,
        arrivalRate: m?.arrivalRate ?? null,
        accepted,
        acceptanceRate:
          accepted !== null && requested > 0
            ? (accepted / requested) * 100
            : null,
      };
    })
    .filter((w) => w.name !== "未分类")
    .sort((a, b) => (b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1));

  const totalRequested = warehouses.reduce((s, x) => s + x.requested, 0);
  const totalFilled = warehouses.reduce((s, x) => s + x.filled, 0);
  const totalUnfilled = warehouses.reduce((s, x) => s + x.unfilled, 0);
  const totalArrived = warehouses.reduce((s, x) => s + (x.arrived ?? 0), 0);
  const totalAccepted = warehouses.reduce((s, x) => s + (x.accepted ?? 0), 0);
  const overallFulfillment = totalRequested > 0 ? (totalAccepted / totalRequested) * 100 : 0;

  const best = warehouses[0] ?? null;
  const worst = [...warehouses].sort((a, b) => (a.acceptanceRate ?? 999) - (b.acceptanceRate ?? 999))[0] ?? null;
  const largestGap = [...warehouses].sort((a, b) => b.unfilled - a.unfilled)[0] ?? null;

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
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">仓库分析 Warehouse Analysis</h1>
            </div>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">统计周期 Reporting Period</p>
              <p className="text-sm font-semibold text-slate-700">{periodLabel}</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-7 md:px-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">仓库表现 Warehouse Performance</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {warehouses.length} 个仓库 · 总体达成率 {formatPercent(overallFulfillment)}
              </h2>
              <p className="mt-1 text-sm font-medium text-teal-200">
                {warehouses.length} warehouses · Overall fulfillment rate {formatPercent(overallFulfillment)}
              </p>
              <p className="mt-3 text-sm leading-6 text-teal-100">
                {formatNumber(totalAccepted)} / {formatNumber(totalRequested)} 人次最终被接受，
                还有 {formatNumber(totalUnfilled)} 人次没派出去。
                {best?.acceptanceRate != null && <>达成率最高的是 <strong className="text-white">{best.name}</strong>（{formatPercent(best.acceptanceRate)}），</>}
                {worst?.acceptanceRate != null && <>最低的是 <strong className="text-white">{worst.name}</strong>（{formatPercent(worst.acceptanceRate)}），</>}
                {largestGap && <>未派遣缺口最大的是 <strong className="text-white">{largestGap.name}</strong>（{formatNumber(largestGap.unfilled)} 人次）。</>}
              </p>
              <div className="mt-6 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalRequested)}</p>
                  <p className="mt-1 text-xs text-teal-200">总需求<br />Requested</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalFilled)}</p>
                  <p className="mt-1 text-xs text-teal-200">已派遣<br />Dispatched</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalArrived)}</p>
                  <p className="mt-1 text-xs text-teal-200">实际到场<br />Arrived</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{formatNumber(totalUnfilled)}</p>
                  <p className="mt-1 text-xs text-teal-200">未派遣缺口<br />Gap</p>
                </div>
              </div>
            </div>
          </section>

          {/* Spotlight */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {best && best.acceptanceRate != null && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">🏆 达成率最高 Best</p>
                <p className="mt-3 truncate text-lg font-bold">{best.name}</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatPercent(best.acceptanceRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(best.accepted ?? 0)} / {formatNumber(best.requested)} 已接受 accepted</p>
              </div>
            )}
            {worst && worst.acceptanceRate != null && (
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">⚠️ 达成率最低 Attention</p>
                <p className="mt-3 truncate text-lg font-bold">{worst.name}</p>
                <p className="mt-1 text-3xl font-bold text-rose-600">{formatPercent(worst.acceptanceRate)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(worst.accepted ?? 0)} / {formatNumber(worst.requested)} 已接受 accepted</p>
              </div>
            )}
            {largestGap && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">📊 最大缺口 Largest Gap</p>
                <p className="mt-3 truncate text-lg font-bold">{largestGap.name}</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{formatNumber(largestGap.unfilled)}</p>
                <p className="mt-2 text-xs text-slate-500">未派遣 Undispatched · 需求 Requested {formatNumber(largestGap.requested)}</p>
              </div>
            )}
          </section>

          {/* Warehouse cards */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">仓库排名 Warehouse Ranking</h3>
                <p className="mt-1 text-xs text-slate-400">按达成率从高到低排序 Rank by Fulfillment Rate (High to Low) · 数据来源：用工需求池（发单详情）+ 人员到岗表 Source: Labor Demand Pool + Arrival Tracking</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{warehouses.length} 个 warehouses</span>
            </div>

            <div className="mt-6 space-y-5">
              {warehouses.map((w, i) => {
                const fr = w.acceptanceRate ?? 0;
                const barColor = fr >= 80 ? "from-emerald-400 to-emerald-600"
                  : fr >= 60 ? "from-amber-400 to-amber-600"
                  : "from-rose-400 to-rose-600";
                const textColor = fr >= 80 ? "text-emerald-600"
                  : fr >= 60 ? "text-amber-600" : "text-rose-600";
                const arrivalAbnormal = w.arrivalRate !== null && (w.arrivalRate > 115 || w.arrivalRate < 70);
                return (
                  <div key={w.name} className="group rounded-2xl border border-slate-100 p-4 transition hover:border-teal-100 hover:bg-teal-50/30 md:p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                        }`}>{i + 1}</span>
                        <span className="truncate text-sm font-semibold">{w.name}</span>
                      </div>
                      <span className={`ml-4 shrink-0 text-lg font-bold ${textColor}`}>
                        {w.acceptanceRate !== null ? formatPercent(w.acceptanceRate) : "—"}
                      </span>
                    </div>
                    <div className="ml-11 mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                        style={{ width: `${Math.min(fr, 100)}%` }}
                      />
                    </div>
                    <div className="ml-11 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 md:grid-cols-5">
                      <span>{formatNumber(w.requested)} 已发单 Issued</span>
                      <span>
                        {formatNumber(w.filled)} 已派遣 Dispatched
                        <span className="text-slate-500"> ({formatPercent(w.rate)})</span>
                      </span>
                      {w.arrived !== null ? (
                        <span>
                          {formatNumber(w.arrived)} 实际到场 Arrived
                          {w.arrivalRate !== null && (
                            <span className={arrivalAbnormal ? "font-semibold text-amber-600" : "text-slate-500"}>
                              {" "}({formatPercent(w.arrivalRate)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">实际到场 —</span>
                      )}
                      {w.accepted !== null ? (
                        <span className="font-medium text-emerald-600">
                          {formatNumber(w.accepted)} 已接受 Accepted
                        </span>
                      ) : (
                        <span className="text-slate-300">已接受 —</span>
                      )}
                      <span className="font-medium text-rose-500">
                        {formatNumber(w.unfilled)} 未派遣缺口 Gap
                      </span>
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
