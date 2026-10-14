import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import Funnel, { type FunnelData } from "@/components/Funnel";

import {
  getDashboardData,
  type CsvRow,
} from "@/lib/data";
import {
  resolveRange,
  filterByDateRange,
  sumByKey,
  getSavedRange,
} from "@/lib/dateRange";

/* =========================================================
   Helpers
========================================================= */

function numberValue(value: string | undefined) {
  if (!value) return 0;

  const cleaned = value
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const n = Number(cleaned);

  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(
    Math.round(value)
  );
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function findKey(
  row: CsvRow,
  candidates: string[]
): string | undefined {
  const keys = Object.keys(row);

  for (const candidate of candidates) {
    const exact = keys.find(
      (key) => key === candidate
    );

    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const partial = keys.find((key) =>
      key.includes(candidate)
    );

    if (partial) return partial;
  }

  return undefined;
}

function getValue(
  row: CsvRow,
  candidates: string[]
) {
  const key = findKey(row, candidates);

  return key ? row[key] : "";
}

function formatDateLabel(value: string) {
  if (!value) return "—";

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return value;

  const [, year, month, day] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/* =========================================================
   Small UI Components
========================================================= */

function MiniBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const width =
    max > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (value / max) * 100
          )
        )
      : 0;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all"
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

/* =========================================================
   Page
========================================================= */


export default async function Home({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  const data = getDashboardData();

  const {
    allocation,
    demandDaily,
    allocDaily,
    allocDailySupplier,
    allocDailyWarehouse,
    arrivalTrackingDaily,
    arrivalTrackingDailySupplier,
    arrivalTrackingDailyWarehouse,
  } = data;

  /* =======================================================
     日期范围：各维度按自己的日期算（需求/发单按需求日期，到岗按到岗日期）
  ======================================================= */

  const demandDailyRows = ((demandDaily ?? []) as CsvRow[]);
  const allocDailyRows = ((allocDaily ?? []) as CsvRow[]);
  const atDailyRows = ((arrivalTrackingDaily ?? []) as CsvRow[]);
  const { start, end, min, max } = resolveRange(
    [
      ...demandDailyRows.map((r) => getValue(r, ["日期"])),
      ...allocDailyRows.map((r) => getValue(r, ["日期"])),
      ...atDailyRows.map((r) => getValue(r, ["日期"])),
    ],
    startParam,
    endParam
  );

  const demandInRange = filterByDateRange(demandDailyRows, start, end);
  const allocInRange = filterByDateRange(allocDailyRows, start, end);
  const atInRange = filterByDateRange(atDailyRows, start, end);

  /* =======================================================
     CORE METRICS
  ======================================================= */

  const totalDemand = demandInRange.reduce(
    (s, r) => s + numberValue(getValue(r, ["需求人数"])),
    0
  );

  const totalFilled = allocInRange.reduce(
    (s, r) => s + numberValue(getValue(r, ["已派遣人数"])),
    0
  );

  const totalRequested = allocInRange.reduce(
    (s, r) => s + numberValue(getValue(r, ["已发单人数"])),
    0
  );



  /* =======================================================
     Supplier Ranking
  ======================================================= */

  type SupplierRow = {
    name: string;
    requested: number;
    filled: number;
    rate: number;
    dispatchRate: number | null;
    arrived: number | null;
    arrivalRate: number | null;
    actualArrived: number | null;
    accepted: number | null;
    fulfillmentRate: number | null;
  };

  // 选定范围内按供应商汇总：发单（已发单/已派遣）+ 到岗（到岗/NoShow/已接受）
  const allocBySup = new Map<string, Record<string, unknown>>(
    sumByKey(
      filterByDateRange(
        ((allocDailySupplier ?? []) as CsvRow[]),
        start,
        end
      ),
      "供应商",
      ["已发单人数", "已派遣人数", "未派遣人数"]
    ).map((r) => [String(r["供应商"]), r])
  );
  const atBySup = new Map<string, Record<string, unknown>>(
    sumByKey(
      filterByDateRange(
        ((arrivalTrackingDailySupplier ?? []) as CsvRow[]),
        start,
        end
      ),
      "供应商",
      ["到岗人次", "NoShow人次", "已接受人次"]
    ).map((r) => [String(r["供应商"]), r])
  );

  let suppliers: SupplierRow[] = [...allocBySup.keys()].map((name) => {
    const a = allocBySup.get(name)!;
    const at = atBySup.get(name);
    const requested = Number(a["已发单人数"] ?? 0);
    const filled = Number(a["已派遣人数"] ?? 0);
    const rate = requested > 0 ? (filled / requested) * 100 : 0;
    // 实际到场 = 到岗人次 − NoShow人次；到场率 = 实际到场 ÷ 已派遣
    const total = at ? Number(at["到岗人次"] ?? 0) : 0;
    const noshow = at ? Number(at["NoShow人次"] ?? 0) : 0;
    // 没派人（已派遣=0）就一定没人到场、没人接受：没到岗数据时按 0 算，不按 null 当无数据
    const actualArrived = at ? total - noshow : filled === 0 ? 0 : null;
    const accepted = at
      ? Number(at["已接受人次"] ?? 0)
      : filled === 0
        ? 0
        : null;
    const arrivalRate =
      actualArrived !== null && filled > 0
        ? (actualArrived / filled) * 100
        : null;
    return {
      name,
      requested,
      filled,
      rate,
      dispatchRate: rate,
      arrived: actualArrived,
      arrivalRate,
      actualArrived,
      accepted,
      fulfillmentRate:
        accepted !== null && requested > 0
          ? (accepted / requested) * 100
          : null,
    };
  });

  suppliers = suppliers
    .filter((x) => x.name !== "未分类")
    .sort(
      (a, b) =>
        (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1)
    );

  /* =======================================================
     Warehouse Ranking
  ======================================================= */

  type WarehouseRow = {
    name: string;
    requested: number;
    filled: number;
    rate: number;
    arrived: number | null;
    arrivalRate: number | null;
    accepted: number | null;
    fulfillmentRate: number | null;
  };

  /* 仓库名归一化：中文"洛杉矶19号仓(TT)" vs 英文"Los Angeles Warehouse 19 (TT)"/"LA-21"
     按编号+括号后缀匹配，如 19|TT */
  const warehouseKey = (name: string): string => {
    const num = name.match(/(\d+)/)?.[1] ?? "";
    let suffix = name.match(/\(([^)]+)\)/)?.[1]?.toUpperCase().trim() ?? "";
    const suffixMap: Record<string, string> = { "中邮": "CP" };
    suffix = suffixMap[suffix] ?? suffix;
    return `${num}|${suffix}`;
  };
  /* 到岗表仓库名（英文）-> 中文显示：Los Angeles-8 / LA-21 -> 洛杉矶8号仓 / 洛杉矶21号仓；(CP)->(中邮) */
  const normalizeWarehouseDisplay = (name: string): string => {
    const num = name.match(/(\d+)/)?.[1] ?? "";
    if (!num) return name;
    let suffix = name.match(/\(([^)]+)\)/)?.[1] ?? "";
    if (suffix.toUpperCase() === "CP") suffix = "中邮";
    let s = `洛杉矶${num}号仓`;
    if (suffix) s += `(${suffix})`;
    return s;
  };

  // 选定范围内按仓库汇总：发单（已发单/已派遣）+ 到岗（到岗/NoShow）
  const allocByWh = new Map<string, Record<string, unknown>>(
    sumByKey(
      filterByDateRange(
        ((allocDailyWarehouse ?? []) as CsvRow[]),
        start,
        end
      ),
      "仓库",
      ["已发单人数", "已派遣人数", "未派遣人数"]
    ).map((r) => [String(r["仓库"]), r])
  );
  // 到岗表按仓库：实际到场 + 已接受（按归一化key匹配中英文仓名）
  const atWhMap = new Map<
    string,
    { actualArrived: number; accepted: number }
  >();
  for (const r of sumByKey(
    filterByDateRange(
      ((arrivalTrackingDailyWarehouse ?? []) as CsvRow[]),
      start,
      end
    ),
    "仓库",
    ["到岗人次", "NoShow人次", "已接受人次"]
  )) {
    const key = warehouseKey(String(r["仓库"] ?? ""));
    if (key && !key.startsWith("|")) {
      // 同一个归一化 key 可能来自中英文两个原始仓名，要累加不能覆盖
      const prev = atWhMap.get(key);
      atWhMap.set(key, {
        actualArrived:
          (prev?.actualArrived ?? 0) +
          Number(r["到岗人次"] ?? 0) -
          Number(r["NoShow人次"] ?? 0),
        accepted:
          (prev?.accepted ?? 0) + Number(r["已接受人次"] ?? 0),
      });
    }
  }
  // 查不到带后缀的key时，回退到只按编号匹配
  const findAtWhData = (name: string) => {
    const key = warehouseKey(name);
    return atWhMap.get(key) ?? atWhMap.get(key.split("|")[0] + "|") ?? null;
  };

  let warehouses: WarehouseRow[] = [...allocByWh.keys()].map((name) => {
    const a = allocByWh.get(name)!;
    const requested = Number(a["已发单人数"] ?? 0);
    const filled = Number(a["已派遣人数"] ?? 0);
    const rate = requested > 0 ? (filled / requested) * 100 : 0;
    const at = findAtWhData(name);
    // 没派人（已派遣=0）就一定没人到场：没到岗数据时按 0 算
    const arrived = at?.actualArrived ?? (filled === 0 ? 0 : null);
    const arrivalRate =
      arrived !== null && filled > 0 ? (arrived / filled) * 100 : null;
    const accepted = at?.accepted ?? (filled === 0 ? 0 : null);
    return {
      name,
      requested,
      filled,
      rate,
      arrived,
      arrivalRate,
      accepted,
      fulfillmentRate:
        accepted !== null && requested > 0
          ? (accepted / requested) * 100
          : null,
    };
  });

  warehouses = warehouses
    .filter((x) => x.name !== "未分类")
    .sort(
      (a, b) =>
        (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1)
    );

  /* =======================================================
     Fulfillment Funnel (SOP 口径)
  ======================================================= */

  // 选定范围内到岗合计：人员到岗表口径（用户确认）
  //   到岗 = NO SHOW 未勾选；已接受 = 到岗且无不符合要求原因
  const sumAt = (col: string) =>
    atInRange.reduce((s, r) => s + numberValue(getValue(r, [col])), 0);
  const atArrived = sumAt("到岗人次");
  const atAccepted = sumAt("已接受人次");
  const atNoShow = sumAt("NoShow人次");
  const atSentBack = sumAt("被退回人次");
  const hasAtData = atInRange.length > 0;

  // 应到岗明细：选定范围内按仓库/供应商汇总（到岗人次 Top 5）
  // 仓库名统一成“洛杉矶X号仓”：到岗表英文仓名（Los Angeles-8 / LA-9 等）先转中文再按名汇总，同一仓不同写法合并
  const topArrivalWarehouses = (() => {
    const m = new Map<string, number>();
    for (const r of sumByKey(
      filterByDateRange(
        ((arrivalTrackingDailyWarehouse ?? []) as CsvRow[]),
        start,
        end
      ),
      "仓库",
      ["到岗人次"]
    )) {
      const display = normalizeWarehouseDisplay(
        String(r["仓库"] ?? "未分类")
      );
      m.set(display, (m.get(display) ?? 0) + Number(r["到岗人次"] ?? 0));
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .filter((x) => x.name !== "未分类")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();

  const topArrivalSuppliers = sumByKey(
    filterByDateRange(
      ((arrivalTrackingDailySupplier ?? []) as CsvRow[]),
      start,
      end
    ),
    "供应商",
    ["到岗人次"]
  )
    .map((r) => ({
      name: String(r["供应商"] ?? "未分类"),
      count: Number(r["到岗人次"] ?? 0),
    }))
    .filter((x) => x.name !== "未分类")
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  /* =======================================================
     Management Alerts 数据（传给 Funnel，放在流失分析下方折叠区）
  ======================================================= */

  // 未满足需求 = 需求 − 已接受（需求最终没人上岗的岗位数；为负时按 0 计）
  const totalUnfilled = Math.max(0, totalDemand - atAccepted);

  const lowestSupplier =
    suppliers.length > 0
      ? [...suppliers].sort(
          (a, b) =>
            (a.fulfillmentRate ?? Infinity) -
            (b.fulfillmentRate ?? Infinity)
        )[0]
      : null;

  const lowestWarehouse =
    warehouses.length > 0
      ? [...warehouses].sort(
          (a, b) =>
            (a.fulfillmentRate ?? Infinity) -
            (b.fulfillmentRate ?? Infinity)
        )[0]
      : null;

  const funnelData: FunnelData = {
    requested: totalDemand,
    issued: totalRequested,
    dispatched: totalFilled,
    dispatchedPersons: 0,
    arrived: hasAtData ? atArrived : null,
    arrivedEvents: hasAtData ? atArrived : null,
    arrivedWithHours: null,
    accepted: hasAtData ? atAccepted : null,
    trialFailed: null,
    pendingConfirm: null,
    noShowPending: hasAtData ? atNoShow : null,
    sentBack: hasAtData ? atSentBack : null,
    topWarehouses: [...warehouses]
      .sort(
        (a, b) =>
          b.requested - a.requested
      )
      .slice(0, 5),
    topSuppliers: [...suppliers]
      .sort(
        (a, b) => b.filled - a.filled
      )
      .slice(0, 5),
    topArrivalWarehouses,
    topArrivalSuppliers,
    unfilled: totalUnfilled,
    lowestWarehouseName: lowestWarehouse?.name ?? null,
    lowestWarehouseRate: lowestWarehouse?.fulfillmentRate ?? null,
    lowestSupplierName: lowestSupplier?.name ?? null,
    lowestSupplierRate: lowestSupplier?.fulfillmentRate ?? null,
  };

  /* =======================================================
     Trial Failure Rankings → 改为被退回口径（人员到岗数据）
  ======================================================= */

  const trialWarehouses = (() => {
    const m = new Map<string, number>();
    for (const r of sumByKey(
      filterByDateRange(
        ((arrivalTrackingDailyWarehouse ?? []) as CsvRow[]),
        start,
        end
      ),
      "仓库",
      ["被退回人次"]
    )) {
      const display = normalizeWarehouseDisplay(String(r["仓库"] ?? "未分类"));
      m.set(display, (m.get(display) ?? 0) + Number(r["被退回人次"] ?? 0));
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .filter((x) => x.name !== "未分类")
      .sort((a, b) => b.count - a.count);
  })();

  const trialSuppliers = sumByKey(
    filterByDateRange(
      ((arrivalTrackingDailySupplier ?? []) as CsvRow[]),
      start,
      end
    ),
    "供应商",
    ["被退回人次"]
  )
    .map((r) => ({
      name: String(r["供应商"] ?? "未分类"),
      count: Number(r["被退回人次"] ?? 0),
    }))
    .filter((x) => x.name !== "未分类")
    .sort((a, b) => b.count - a.count);

  const trialFailureCount = trialSuppliers.reduce(
    (s, r) => s + r.count,
    0
  );

  /* =======================================================
     Data Quality
  ======================================================= */

  const missingSupplierAllocations = (
    (allocation ?? []) as CsvRow[]
  ).filter(
    (row) =>
      !getValue(row, ["供应商"]).trim() &&
      (!start || !end ||
        (getValue(row, ["需求日期"]) >= start &&
          getValue(row, ["需求日期"]) <= end))
  ).length;

  /* =======================================================
     Reporting Period
  ======================================================= */

  const periodLabel =
    start && end
      ? `${formatDateLabel(start)} — ${formatDateLabel(end)}`
      : "统计周期不可用 Reporting Period unavailable";

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">

      {/* Sidebar */}

      <Sidebar />

      {/* Main */}

      <main className="lg:pl-[250px]">

        {/* =================================================
            TOP BAR
        ================================================= */}

        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-medium text-slate-400">
                人力管理 Workforce Management
              </p>

              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                管理总览 Management Overview
              </h1>
            </div>

            <div className="flex items-center gap-3">

              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">

                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  统计周期 Reporting Period
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  {periodLabel}
                </p>

              </div>

              <div className="flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">

                <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-emerald-700">
                  已处理数据 Processed Data
                </span>

              </div>

            </div>

          </div>

        </header>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="px-5 py-7 md:px-8">

          {/* 日期筛选 */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <DateRangePicker start={start} end={end} min={min} max={max} />
          </div>

          {/* =================================================
              指标 METRICS + SOP 比率卡片（最上面）
          ================================================= */}

          <section>
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
                指标 Metrics
              </p>
            </div>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                zh: "派遣率",
                en: "Dispatch Rate",
                value:
                  totalRequested > 0
                    ? formatPercent(
                        (totalFilled / totalRequested) *
                          100
                      )
                    : "N/A",
                formula: `已派遣 ÷ 已发单 = ${formatNumber(
                  totalFilled
                )} ÷ ${formatNumber(totalRequested)}`,
                plain:
                  totalRequested > 0
                    ? `每 100 个已发单人次，约 ${Math.round(
                        (totalFilled / totalRequested) *
                          100
                      )} 人次实际派出。`
                    : "待发单数据：分母需要发单详情。",
                ok: totalRequested > 0,
              },
              {
                zh: "接受率",
                en: "Acceptance Rate",
                value:
                  hasAtData && atArrived > 0
                    ? formatPercent(
                        (atAccepted / atArrived) *
                          100
                      )
                    : "N/A",
                formula: hasAtData
                  ? `已接受 ÷ 应到岗 = ${formatNumber(
                      atAccepted
                    )} ÷ ${formatNumber(atArrived)}`
                  : "已接受 ÷ 应到岗",
                plain: hasAtData
                  ? `每 100 个应到岗的人，约 ${Math.round(
                      atArrived > 0
                        ? (atAccepted / atArrived) *
                            100
                        : 0
                    )} 人最终上岗。`
                  : "待数据：分子需要已接受的人数。",
                ok: hasAtData,
              },
              {
                zh: "需求满足率",
                en: "Demand Fulfillment",
                value:
                  hasAtData && totalDemand > 0
                    ? formatPercent(
                        (atAccepted / totalDemand) *
                          100
                      )
                    : "N/A",
                formula: hasAtData
                  ? `已接受 ÷ 需求 = ${formatNumber(
                      atAccepted
                    )} ÷ ${formatNumber(totalDemand)}`
                  : "已接受 ÷ 需求",
                plain:
                  hasAtData && totalDemand > 0
                    ? `每 100 个需求名额，最终约 ${Math.round(
                        (atAccepted / totalDemand) *
                          100
                      )} 人上岗。`
                    : "待数据：分子需要已接受的人数。",
                ok: hasAtData,
              },
            ].map((m) => (
              <div
                key={m.en}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {m.zh} {m.en}
                </p>
                <p
                  className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${
                    m.ok
                      ? "text-slate-900"
                      : "text-slate-300"
                  }`}
                >
                  {m.value}
                </p>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {m.formula}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {m.plain}
                </p>
              </div>
            ))}
          </div>
          </section>

          {/* =================================================
              需求 Demand（真实地图：Leaflet + OpenStreetMap 瓦片，气泡=需求量，颜色=达成率）
          ================================================= */}

          <section className="mt-6">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
                需求 Demand
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                哪里要人多，一眼看出来。圈越大，要的人越多；绿的做得好，红的要盯紧。
                <br />
                See where demand is highest at a glance. Bigger bubble = more demand; green is on track, red needs attention.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h3 className="font-bold text-slate-900">
                    各仓库需求分布 Demand by Warehouse
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    数据来源：用工需求池（发单详情） Source: Labor Demand Pool
                  </p>
                </div>
                <Link
                  href="/warehouse"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看全部 View All →
                </Link>
              </div>
              <div className="p-6">
                {(() => {
                  const locations = [
                    { ids: "CA #1 · #17", nums: [1, 17], address: "1375 E Locust St, Ontario", lat: 34.04666, lng: -117.62496 },
                    { ids: "CA #2 · #8", nums: [2, 8], address: "2221 E Remington Ave, Chino", lat: 33.97743, lng: -117.60234 },
                    { ids: "CA #5", nums: [5], address: "13725 Pipeline Ave, Chino", lat: 34.00215, lng: -117.71408 },
                    { ids: "CA #6", nums: [6], address: "14310 Ramona Ave, Chino", lat: 33.99265, lng: -117.70765 },
                    { ids: "CA #7", nums: [7], address: "4705 Walker Ave, Ontario", lat: 33.98731, lng: -117.61782 },
                    { ids: "LA #9 · #27", nums: [9, 27], address: "171 Marcellin Dr, City of Industry", lat: 34.0108, lng: -117.82885 },
                    { ids: "CA #10", nums: [10], address: "14779 Bar Harbor Rd, Fontana", lat: 34.11589, lng: -117.48169 },
                    { ids: "CA #18 · #19", nums: [18, 19], address: "1420 Tamarind Ave, Rialto", lat: 34.12497, lng: -117.42297 },
                    { ids: "CA #20", nums: [20], address: "11296 Harrel St, Jurupa Valley", lat: 34.0096, lng: -117.53005 },
                    { ids: "CA #21", nums: [21], address: "8375 Sultana Ave, Fontana", lat: 34.10416, lng: -117.46729 },
                    { ids: "CA #25", nums: [25], address: "11260 Cedar Ave, Bloomington", lat: 34.05051, lng: -117.39859 },
                    { ids: "CA #28", nums: [28], address: "855 W Valley Blvd, Bloomington", lat: 34.06977, lng: -117.38558 },
                    { ids: "CA #29", nums: [29], address: "5331 S Carpenter Ave, Ontario", lat: 33.98694, lng: -117.60688 },
                    { ids: "CA #30", nums: [30], address: "21661 Barton Rd, Colton", lat: 34.03373, lng: -117.33186 },
                    { ids: "CA #31", nums: [31], address: "1002 S Carnegie Ave, Ontario", lat: 34.0528, lng: -117.57008 },
                  ];
                  const points = locations.map((loc) => {
                    const matched = warehouses.filter((w) => {
                      const n = Number(w.name.match(/(\d+)/)?.[1] ?? -1);
                      return loc.nums.includes(n);
                    });
                    const demand = matched.reduce((s, w) => s + w.requested, 0);
                    const accepted = matched.reduce((s, w) => s + (w.accepted ?? 0), 0);
                    const fulfillment = demand > 0 ? (accepted / demand) * 100 : null;
                    return { ...loc, demand, accepted, fulfillment };
                  });
                  const maxDemand = Math.max(1, ...points.map((p) => p.demand));
                  const mapHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;padding:0}#map{background:#e8eef5}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var points=${JSON.stringify(points)};var maxDemand=${maxDemand};var map=L.map('map').setView([34.05,-117.58],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);var bounds=[];points.forEach(function(p){var color=p.fulfillment===null?'#94a3b8':p.fulfillment>=60?'#10b981':p.fulfillment>=40?'#f59e0b':'#f43f5e';var r=p.demand>0?6+(p.demand/maxDemand)*14:6;var c=L.circleMarker([p.lat,p.lng],{radius:r,fillColor:color,color:'#fff',weight:2,fillOpacity:0.85}).addTo(map);c.bindPopup('<b>'+p.ids+'</b><br>'+p.address+'<br>需求 '+p.demand+' · 已接受 '+p.accepted+' · '+(p.fulfillment!==null?'达成率 '+p.fulfillment.toFixed(1)+'%':'达成率 —'));bounds.push([p.lat,p.lng]);});if(bounds.length){map.fitBounds(bounds,{padding:[16,16]});}</script></body></html>`;
                  return (
                    <div>
                      <iframe
                        title="仓库地理分布 Warehouse Map"
                        srcDoc={mapHtml}
                        className="w-full rounded-xl border border-slate-200"
                        style={{ height: "460px" }}
                      />
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>气泡大小(Bubble size) = 需求量(demand)</span>
                        <span>绿 ≥60% · 黄 40-60% · 红 &lt;40% · 灰 无数据</span>
                        <span>同一地址多仓合并为一个点</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
                需求履约 Demand Fulfillment
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                从需求到上岗的完整链条：仓库发需求 →
                HR部门发单 → 供应商已派遣 →
                应到岗（人员到岗跟进表） →
                已接受。应到岗的表格里分出 No
                Show（没来）和被退回（不合格），剩下的是已接受。点击每个阶段查看明细。
                <br />
                The full chain from request to
                onboarding: warehouse requests →
                HR issues orders → supplier
                dispatch → scheduled arrivals
                (arrival tracking sheet) →
                accepted. Arrival records split
                into No-Show and Sent Back
                (disqualified); the rest are
                accepted. Click each stage for
                details.
              </p>
            </div>


            <Funnel data={funnelData} />
          </section>


          {/* =================================================
              ACCEPTED COUNT
          ================================================= */}

          <section className="mt-6">

            <div className="grid gap-4 md:grid-cols-3">

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  已接受人数 Accepted
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {formatNumber(atAccepted)}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    人
                  </span>
                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  需求满足率 Demand Fulfillment
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {hasAtData && totalDemand > 0
                    ? formatPercent(
                        (atAccepted / totalDemand) * 100
                      )
                    : "N/A"}
                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  未满足需求 Unfilled Demand
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {formatNumber(totalUnfilled)}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    人
                  </span>
                </p>

              </div>

            </div>

            {/* 已接受 vs 未满足 可视化条 */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-600">
                  已接受 Accepted {formatNumber(atAccepted)} 人
                </span>
                <span className="font-semibold text-rose-600">
                  未满足 Unfilled {formatNumber(totalUnfilled)} 人
                </span>
              </div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${
                      hasAtData && totalDemand > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (atAccepted / totalDemand) * 100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
                <div
                  className="h-full bg-rose-400"
                  style={{
                    width: `${
                      hasAtData && totalDemand > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (totalUnfilled / totalDemand) * 100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {hasAtData && totalDemand > 0
                  ? `需求 Demand ${formatNumber(totalDemand)} 人`
                  : "待数据 Pending：需要到岗数据才能算。"}
              </p>
            </div>

          </section>

          {/* =================================================
              SUPPLIER + WAREHOUSE
          ================================================= */}

          <section className="mt-6 grid gap-6 lg:grid-cols-2">

            {/* Supplier */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    供应商表现 Supplier Performance
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    按需求满足率排名 Ranked by Demand Fulfillment Rate
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    数据来源：用工需求池（发单详情） Source: Labor Demand Pool
                  </p>

                </div>

                <Link
                  href="/supplier"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看全部 View All →
                </Link>

              </div>

              <div className="divide-y divide-slate-100">

                {suppliers
                  .slice(0, 7)
                  .map((supplier, index) => (

                    <div
                      key={`${supplier.name}-${index}`}
                      className="px-6 py-4"
                    >

                      <div className="flex items-center gap-4">

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="mb-2 flex items-center justify-between">

                            <p className="truncate text-sm font-semibold text-slate-800">
                              {supplier.name}
                            </p>

                            <p className="ml-4 text-sm font-bold text-slate-900">
                              {supplier.fulfillmentRate !==
                              null
                                ? formatPercent(
                                    supplier.fulfillmentRate
                                  )
                                : "—"}
                            </p>

                          </div>

                          <MiniBar
                            value={
                              supplier.fulfillmentRate ??
                              0
                            }
                            max={100}
                          />

                          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">

                            <span>
                              {formatNumber(supplier.requested)}{" "}
                              已发单 Issued
                            </span>

                            <span>
                              {formatNumber(supplier.filled)}{" "}
                              已派遣 Dispatched
                              {supplier.dispatchRate !==
                                null && (
                                <span className="text-slate-500">
                                  {" "}
                                  (
                                  {formatPercent(
                                    supplier.dispatchRate
                                  )}
                                  )
                                </span>
                              )}
                            </span>

                            {supplier.actualArrived !== null && (
                              <span>
                                {formatNumber(
                                  supplier.actualArrived
                                )}{" "}
                                实际到场 Arrived
                                {supplier.arrivalRate !== null && (
                                  <span
                                    className={
                                      supplier.arrivalRate >
                                        115 ||
                                      supplier.arrivalRate <
                                        70
                                        ? "font-semibold text-amber-600"
                                        : "text-slate-500"
                                    }
                                  >
                                    {" "}
                                    (
                                    {formatPercent(
                                      supplier.arrivalRate
                                    )}
                                    )
                                  </span>
                                )}
                              </span>
                            )}

                            {supplier.accepted !== null && (
                              <span className="font-medium text-emerald-600">
                                {formatNumber(
                                  supplier.accepted
                                )}{" "}
                                已接受 Accepted
                              </span>
                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                  ))}

              </div>

            </div>

            {/* Warehouse */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    仓库表现 Warehouse Performance
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    按需求满足率排名 Ranked by Demand Fulfillment Rate
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    数据来源：用工需求池（发单详情） Source: Labor Demand Pool
                  </p>

                </div>

                <Link
                  href="/warehouse"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看全部 View All →
                </Link>

              </div>

              <div className="divide-y divide-slate-100">

                {warehouses
                  .slice(0, 7)
                  .map((warehouse, index) => (

                    <div
                      key={`${warehouse.name}-${index}`}
                      className="px-6 py-4"
                    >

                      <div className="flex items-center gap-4">

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="mb-2 flex items-center justify-between">

                            <p className="truncate text-sm font-semibold text-slate-800">
                              {warehouse.name}
                            </p>

                            <p className="ml-4 text-sm font-bold text-slate-900">
                              {warehouse.fulfillmentRate !==
                              null
                                ? formatPercent(
                                    warehouse.fulfillmentRate
                                  )
                                : "—"}
                            </p>

                          </div>

                          <MiniBar
                            value={
                              warehouse.fulfillmentRate ??
                              0
                            }
                            max={100}
                          />

                          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">

                            <span>
                              {formatNumber(warehouse.requested)}{" "}
                              已发单 Issued
                            </span>

                            <span>
                              {formatNumber(warehouse.filled)}{" "}
                              已派遣 Dispatched
                              <span className="text-slate-500">
                                {" "}
                                (
                                {formatPercent(
                                  warehouse.rate
                                )}
                                )
                              </span>
                            </span>

                            {warehouse.arrived !== null && (
                              <span>
                                {formatNumber(
                                  warehouse.arrived
                                )}{" "}
                                实际到场 Arrived
                                {warehouse.arrivalRate !== null && (
                                  <span
                                    className={
                                      warehouse.arrivalRate >
                                        115 ||
                                      warehouse.arrivalRate <
                                        70
                                        ? "font-semibold text-amber-600"
                                        : "text-slate-500"
                                    }
                                  >
                                    {" "}
                                    (
                                    {formatPercent(
                                      warehouse.arrivalRate
                                    )}
                                    )
                                  </span>
                                )}
                              </span>
                            )}

                            {warehouse.accepted !== null && (
                              <span className="font-medium text-emerald-600">
                                {formatNumber(
                                  warehouse.accepted
                                )}{" "}
                                已接受 Accepted
                              </span>
                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                  ))}

              </div>

            </div>

          </section>

          {/* =================================================
              TRIAL FAILURE
          ================================================= */}

          <section className="mt-6 grid gap-6 lg:grid-cols-2">

            {/* Supplier */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    各供应商被退回 Sent Back by Supplier
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    共被退回 {formatNumber(trialFailureCount)} 人次 · 数据来源：人员到岗表 Source: Arrival Tracking
                  </p>

                </div>

                <Link
                  href="/trial"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看详情 View Details →
                </Link>

              </div>

              <div className="p-6">
                {/* Top 3 放大卡 */}
                <div className="grid gap-3 grid-cols-3">
                  {trialSuppliers.slice(0, 3).map((item, index) => {
                    const max = trialSuppliers[0]?.count || 1;
                    const share =
                      trialFailureCount > 0
                        ? (item.count / trialFailureCount) * 100
                        : 0;
                    const rankBg =
                      index === 0
                        ? "#e11d48"
                        : index === 1
                          ? "#f43f5e"
                          : "#fb7185";
                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="rounded-xl border border-rose-100 bg-rose-50/60 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: rankBg }}
                          >
                            {index + 1}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                            {formatPercent(share)}
                          </span>
                        </div>
                        <p
                          className="mt-2 truncate text-sm font-semibold text-slate-800"
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-rose-600">
                          {formatNumber(item.count)}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            人次
                          </span>
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-rose-400"
                            style={{
                              width: `${(item.count / max) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 其余列表 4-7 */}
                {trialSuppliers.slice(3, 7).length > 0 && (
                  <div className="mt-5 space-y-4">
                    {trialSuppliers.slice(3, 7).map((item, index) => {
                      const max = trialSuppliers[0]?.count || 1;
                      return (
                        <div key={`${item.name}-${index + 3}`}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">
                                {index + 4}
                              </span>
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="ml-3 shrink-0 text-sm font-bold text-slate-800">
                              {formatNumber(item.count)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-rose-400"
                              style={{
                                width: `${(item.count / max) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Warehouse */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    各仓库被退回 Sent Back by Warehouse
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    共被退回 {formatNumber(trialFailureCount)} 人次 · 数据来源：人员到岗表 Source: Arrival Tracking
                  </p>

                </div>

                <Link
                  href="/trial"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看详情 View Details →
                </Link>

              </div>

              <div className="p-6">
                {/* Top 3 放大卡 */}
                <div className="grid gap-3 grid-cols-3">
                  {trialWarehouses.slice(0, 3).map((item, index) => {
                    const max = trialWarehouses[0]?.count || 1;
                    const share =
                      trialFailureCount > 0
                        ? (item.count / trialFailureCount) * 100
                        : 0;
                    const rankBg =
                      index === 0
                        ? "#e11d48"
                        : index === 1
                          ? "#f43f5e"
                          : "#fb7185";
                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="rounded-xl border border-rose-100 bg-rose-50/60 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: rankBg }}
                          >
                            {index + 1}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                            {formatPercent(share)}
                          </span>
                        </div>
                        <p
                          className="mt-2 truncate text-sm font-semibold text-slate-800"
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-rose-600">
                          {formatNumber(item.count)}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            人次
                          </span>
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-rose-400"
                            style={{
                              width: `${(item.count / max) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 其余列表 4-7 */}
                {trialWarehouses.slice(3, 7).length > 0 && (
                  <div className="mt-5 space-y-4">
                    {trialWarehouses.slice(3, 7).map((item, index) => {
                      const max = trialWarehouses[0]?.count || 1;
                      return (
                        <div key={`${item.name}-${index + 3}`}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">
                                {index + 4}
                              </span>
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="ml-3 shrink-0 text-sm font-bold text-slate-800">
                              {formatNumber(item.count)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-rose-400"
                              style={{
                                width: `${(item.count / max) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </section>

          {/* =================================================
              FOOTNOTE
          ================================================= */}

          <div className="pb-8 pt-6 text-center">

            <p className="text-[11px] text-slate-400">
              内部使用· Internal Use Only
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              指标根据处理后的源数据计算。Metrics are calculated from processed source data.
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}
