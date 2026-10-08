import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Funnel, {
  type FunnelData,
} from "@/components/Funnel";

import {
  getDashboardData,
  type CsvRow,
} from "@/lib/data";

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

function sumColumn(
  rows: CsvRow[],
  candidates: string[]
) {
  return rows.reduce((sum, row) => {
    return (
      sum +
      numberValue(
        getValue(row, candidates)
      )
    );
  }, 0);
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

function groupRows(
  rows: CsvRow[],
  groupCandidates: string[],
  valueCandidates: string[]
) {
  const groups = new Map<
    string,
    {
      name: string;
      value: number;
    }
  >();

  for (const row of rows) {
    const name =
      getValue(
        row,
        groupCandidates
      ) || "未分类";

    const value = numberValue(
      getValue(
        row,
        valueCandidates
      )
    );

    const current = groups.get(name);

    groups.set(name, {
      name,
      value:
        (current?.value ?? 0) +
        value,
    });
  }

  return Array.from(
    groups.values()
  );
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

function AlertIcon({
  type,
}: {
  type: "danger" | "warning" | "info";
}) {
  const styles = {
    danger:
      "bg-rose-100 text-rose-600",
    warning:
      "bg-amber-100 text-amber-600",
    info:
      "bg-violet-100 text-violet-600",
  };

  const symbols = {
    danger: "!",
    warning: "!",
    info: "i",
  };

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${styles[type]}`}
    >
      {symbols[type]}
    </div>
  );
}

/* =========================================================
   Page
========================================================= */

export default function Home() {
  const data = getDashboardData();

  const {
    demand,
    allocation,
    attendance,
    supplierSummary,
    warehouseSummary,
    warehouseAllocSummary,
    trialFailureSupplier,
    trialFailureWarehouse,
    arrivalSupplier,
    arrivalWarehouse,
    arrivalSummary,
    acceptanceSummary,
    arrivalTrackingSummary,
    arrivalTrackingWarehouse,
    arrivalTrackingSupplier,
    matchSupplierArrival,
    matchWarehouseArrival,
  } = data;

  /* =======================================================
     CORE METRICS
  ======================================================= */

  const totalDemand = sumColumn(
    demand,
    ["需求总人数"]
  );

  const totalFilled = sumColumn(
    allocation,
    [
      "供应商已派遣人数",
      "已派遣人数",
    ]
  );

  const totalRequested = sumColumn(
    allocation,
    [
      "供应商需派遣人数",
      "需求人数",
    ]
  );

  const totalUnfilled = sumColumn(
    allocation,
    [
      "供应商未派遣人数",
      "未派遣人数",
    ]
  );

  const fillRate =
    totalRequested > 0
      ? (totalFilled /
          totalRequested) *
        100
      : 0;

  /* =======================================================
     OT
  ======================================================= */

  const totalWorkHours = sumColumn(
    attendance,
    [
      "总工作时长",
      "工作时长",
      "总工时",
      "时长总计",
    ]
  );

  const totalOtHours = sumColumn(
    attendance,
    [
      "总加班时长",
      "加班时长",
      "加班工时",
      "OT时长",
    ]
  );

  const otRate =
    totalWorkHours > 0
      ? (totalOtHours /
          totalWorkHours) *
        100
      : 0;

  /* =======================================================
     Trial Failure
  ======================================================= */

  const trialFailureCount =
    sumColumn(
      trialFailureSupplier,
      [
        "试工不通过人数",
        "试工不通过",
      ]
    );

  /* =======================================================
     Supplier Ranking
  ======================================================= */

  // 到岗率：发单已派遣 × 到岗实到
  const supMatchMap = new Map<string, { arrived: number | null; arrivalRate: number | null }>(
    ((matchSupplierArrival ?? []) as CsvRow[]).map((r: CsvRow) => {
      const v = getValue(r, ["到岗率"]);
      return [
        getValue(r, ["供应商"]) || "未分类",
        {
          arrived: numberValue(getValue(r, ["实到"])),
          arrivalRate: v === null || v === undefined || v === "" ? null : Number(v),
        },
      ] as [string, { arrived: number | null; arrivalRate: number | null }];
    })
  );

  // 到岗表按供应商：实际到达、已接受
  const atSupMap = new Map<string, { actualArrived: number | null; accepted: number | null }>(
    ((arrivalTrackingSupplier ?? []) as CsvRow[]).map((r: CsvRow) => {
      const total = numberValue(getValue(r, ["到岗人次"]));
      const noshow = numberValue(getValue(r, ["NoShow人次"]));
      const accepted = numberValue(getValue(r, ["已接受人次"]));
      return [
        getValue(r, ["供应商"]) || "未分类",
        {
          actualArrived: total - noshow,
          accepted: accepted,
        },
      ] as [string, { actualArrived: number | null; accepted: number | null }];
    })
  );

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

  let suppliers: SupplierRow[] =
    supplierSummary.length > 0
      ? (supplierSummary as CsvRow[]).map((row: CsvRow) => {
          const name =
            getValue(row, ["供应商", "供应商名称"]) || "未分类";
          const requested = numberValue(
            getValue(row, ["需求人数", "供应商需派遣人数"])
          );
          const filled = numberValue(
            getValue(row, ["已派遣人数", "供应商已派遣人数"])
          );
          const rate = requested > 0 ? (filled / requested) * 100 : 0;
          const m = supMatchMap.get(name);
          const at = atSupMap.get(name);
          const accepted = at?.accepted ?? null;
          return {
            name,
            requested,
            filled,
            rate,
            dispatchRate: rate,
            arrived: m?.arrived ?? null,
            arrivalRate: m?.arrivalRate ?? null,
            actualArrived: at?.actualArrived ?? null,
            accepted: accepted,
            fulfillmentRate:
              accepted !== null && requested > 0
                ? (accepted / requested) * 100
                : null,
          };
        })
      : [];

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
  };

  const whMatchMap = new Map<string, { arrived: number | null; arrivalRate: number | null }>(
    ((matchWarehouseArrival ?? []) as CsvRow[]).map((r: CsvRow) => {
      const v = getValue(r, ["到岗率"]);
      return [
        getValue(r, ["仓库"]) || "未分类",
        {
          arrived: numberValue(getValue(r, ["实到"])),
          arrivalRate: v === null || v === undefined || v === "" ? null : Number(v),
        },
      ] as [string, { arrived: number | null; arrivalRate: number | null }];
    })
  );

  // 仓库表现改用发单详情口径（2026-10-07）：需求人数=已发单
  const whAllocRows =
    (warehouseAllocSummary ?? []).length > 0
      ? warehouseAllocSummary
      : warehouseSummary;
  let warehouses: WarehouseRow[] =
    whAllocRows.length > 0
      ? (whAllocRows as CsvRow[]).map((row: CsvRow) => {
          const name =
            getValue(row, ["仓库", "需求仓", "物理仓"]) || "未分类";
          const requested = numberValue(
            getValue(row, ["需求人数", "供应商需派遣人数"])
          );
          const filled = numberValue(
            getValue(row, ["已派遣人数", "供应商已派遣人数"])
          );
          const rate = requested > 0 ? (filled / requested) * 100 : 0;
          const m = whMatchMap.get(name);
          return {
            name,
            requested,
            filled,
            rate,
            arrived: m?.arrived ?? null,
            arrivalRate: m?.arrivalRate ?? null,
          };
        })
      : [];

  warehouses = warehouses
    .filter((x) => x.name !== "未分类")
    .sort((a, b) => b.rate - a.rate);

  /* =======================================================
     Fulfillment Funnel (SOP 口径)
  ======================================================= */

  // 到岗数据来自考勤表；lib/data.ts 需把 arrival_* 数据集暴露出来，
  // 没有考勤数据时这些数组为空，漏斗回到"待数据"状态
  const arrivalRows = arrivalSummary ?? [];
  const arrivalPersons =
    arrivalRows.length > 0
      ? numberValue(
          getValue(arrivalRows[0], [
            "到岗人数",
          ])
        )
      : null;
  const arrivalEvents =
    arrivalRows.length > 0
      ? numberValue(
          getValue(arrivalRows[0], [
            "到岗人次",
          ])
        )
      : null;
  const arrivalWithHours =
    arrivalRows.length > 0
      ? numberValue(
          getValue(arrivalRows[0], [
            "有工时人数",
          ])
        )
      : null;

  // 应到岗明细：用人员到岗表口径（不再用老考勤数据）
  const topArrivalWarehouses = (
    arrivalTrackingWarehouse ?? []
  )
    .map((row) => ({
      name:
        getValue(row, ["仓库"]) ||
        "未分类",
      count: numberValue(
        getValue(row, ["到岗人次"])
      ),
    }))
    .filter((x) => x.name !== "未分类")
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topArrivalSuppliers = (
    arrivalTrackingSupplier ?? []
  )
    .map((row) => ({
      name:
        getValue(row, ["供应商"]) ||
        "未分类",
      count: numberValue(
        getValue(row, ["到岗人次"])
      ),
    }))
    .filter((x) => x.name !== "未分类")
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 派遣状态口径的已确认/试工不通过/待确认（去重人数）
  const acceptanceRows = acceptanceSummary ?? [];
  const trialFailedPersons =
    acceptanceRows.length > 0
      ? numberValue(
          getValue(acceptanceRows[0], [
            "试工不通过人数",
          ])
        )
      : null;
  const pendingConfirmPersons =
    acceptanceRows.length > 0
      ? numberValue(
          getValue(acceptanceRows[0], [
            "待确认人数",
          ])
        )
      : null;

  // 已到岗/已接受：人员到岗表口径（用户确认）
  //   到岗 = NO SHOW 未勾选；已接受 = 到岗且无不符合要求原因
  const atSummaryRows = arrivalTrackingSummary ?? [];
  const atSummary = atSummaryRows[0] ?? {};
  const atArrived = numberValue(getValue(atSummary, ["到岗人次"]));
  const atAccepted = numberValue(getValue(atSummary, ["已接受人次"]));
  const atNoShow = numberValue(getValue(atSummary, ["NoShow人次"]));
  const atSentBack = numberValue(getValue(atSummary, ["被退回人次"]));
  const hasAtData = atSummaryRows.length > 0;
  const funnelData: FunnelData = {
    requested: totalDemand,
    issued: totalRequested,
    dispatched: totalFilled,
    dispatchedPersons: 0,
    arrived: hasAtData ? atArrived : null,
    arrivedEvents: hasAtData ? atArrived : null,
    arrivedWithHours: null,
    accepted: hasAtData ? atAccepted : null,
    trialFailed: trialFailedPersons,
    pendingConfirm: pendingConfirmPersons,
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
  };

  /* =======================================================
     Trial Failure Rankings
  ======================================================= */

  const trialWarehouses =
    trialFailureWarehouse
      .map((row) => ({
        name:
          getValue(row, [
            "物理仓",
            "需求仓",
            "仓库",
          ]) || "未分类",

        count: numberValue(
          getValue(row, [
            "试工不通过人数",
            "试工不通过",
          ])
        ),
      }))
      .filter(
        (x) => x.name !== "未分类"
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  const trialSuppliers =
    trialFailureSupplier
      .map((row) => ({
        name:
          getValue(row, [
            "供应商名称",
            "供应商",
          ]) || "未分类",

        count: numberValue(
          getValue(row, [
            "试工不通过人数",
            "试工不通过",
          ])
        ),
      }))
      .filter(
        (x) => x.name !== "未分类"
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  /* =======================================================
     Data Quality
  ======================================================= */

  const missingSupplierAllocations =
    allocation.filter(
      (row) =>
        !getValue(
          row,
          ["供应商"]
        ).trim()
    ).length;

  /* =======================================================
     Reporting Period
  ======================================================= */

  const demandDates = demand
    .map((row) =>
      getValue(row, [
        "需求日期",
        "日期",
      ])
    )
    .filter(Boolean)
    .sort();

  const startDate =
    demandDates[0] || "";

  const endDate =
    demandDates[
      demandDates.length - 1
    ] || "";

  const periodLabel =
    startDate && endDate
      ? `${formatDateLabel(
          startDate
        )} — ${formatDateLabel(
          endDate
        )}`
      : "统计周期不可用 Reporting Period unavailable";

  /* =======================================================
     Management Alerts
  ======================================================= */

  const lowestSupplier =
    suppliers.length > 0
      ? [...suppliers].sort(
          (a, b) =>
            a.rate - b.rate
        )[0]
      : null;

  const lowestWarehouse =
    warehouses.length > 0
      ? [...warehouses].sort(
          (a, b) =>
            a.rate - b.rate
        )[0]
      : null;

  const topTrialWarehouse =
    trialWarehouses[0] ?? null;

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

          {/* =================================================
              FULFILLMENT FUNNEL (SOP) — 首页先放漏斗
          ================================================= */}

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
                指标 Metrics
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                需求履约 Demand Fulfillment
              </h2>

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
              SUPPLIER + MANAGEMENT ALERTS
          ================================================= */}

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">

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

            {/* Management Alerts */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    管理预警 Management Alerts
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    需要运营关注的事项 Areas for review
                  </p>

                </div>

              </div>

              <div className="space-y-3 p-5">

                {/* Unfilled */}

                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">

                  <div className="flex items-start">

                    <AlertIcon type="danger" />

                    <div className="ml-3">

                      <p className="text-sm font-semibold text-slate-800">
                        未满足需求 Unfilled Demand
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        仍有{" "}
                        {formatNumber(totalUnfilled)}{" "}
                        个岗位未被满足（
                        {formatNumber(totalUnfilled)}{" "}
                        positions remain unfilled）。
                      </p>

                    </div>

                  </div>

                </div>

                {/* 需求日到场率 */}

                {hasAtData && totalDemand > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">

                    <div className="flex items-start">

                      <AlertIcon type="info" />

                      <div className="ml-3">

                        <p className="text-sm font-semibold text-slate-800">
                          需求日到场率 Scheduled Arrival Rate
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          应到岗{" "}
                          {formatNumber(atArrived)}{" "}
                          人中，扣除 No Show 后实际到场{" "}
                          <span className="font-semibold text-blue-700">
                            {formatNumber(
                              atArrived - atNoShow
                            )}
                          </span>{" "}
                          人，到场率{" "}
                          <span className="font-semibold text-blue-700">
                            {formatPercent(
                              atArrived > 0
                                ? ((atArrived - atNoShow) /
                                    atArrived) *
                                    100
                                : 0
                            )}
                          </span>
                          。
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* Missing Supplier */}

                {missingSupplierAllocations > 0 && (
                  <Link
                    href="/quality"
                    className="block rounded-xl border border-amber-100 bg-amber-50/60 p-4 transition hover:border-amber-200 hover:bg-amber-50"
                  >

                    <div className="flex items-start">

                      <AlertIcon type="warning" />

                      <div className="ml-3">

                        <p className="text-sm font-semibold text-slate-800">
                          供应商归属缺失 Missing Supplier Attribution
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {formatNumber(missingSupplierAllocations)}{" "}
                          条调配记录缺少供应商名称（
                          {formatNumber(missingSupplierAllocations)}{" "}
                          allocation records have no supplier name）。
                        </p>

                      </div>

                    </div>

                  </Link>
                )}

                {/* Trial Failure */}

                <Link
                  href="/trial"
                  className="block rounded-xl border border-violet-100 bg-violet-50/60 p-4 transition hover:border-violet-200 hover:bg-violet-50"
                >

                  <div className="flex items-start">

                    <AlertIcon type="info" />

                    <div className="ml-3">

                      <p className="text-sm font-semibold text-slate-800">
                        试工不通过 Trial Failure
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        发现{" "}
                        {formatNumber(trialFailureCount)}{" "}
                        条试工不通过记录（
                        {formatNumber(trialFailureCount)}{" "}
                        trial-failure records identified）。
                      </p>

                    </div>

                  </div>

                </Link>

                {/* No Show */}

                {hasAtData && (
                  <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">

                    <div className="flex items-start">

                      <AlertIcon type="warning" />

                      <div className="ml-3">

                        <p className="text-sm font-semibold text-slate-800">
                          No Show 未到岗 No-Show
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          应到岗{" "}
                          {formatNumber(atArrived)}{" "}
                          人中有{" "}
                          <span className="font-semibold text-orange-700">
                            {formatNumber(atNoShow)}
                          </span>{" "}
                          人没来，No Show 率{" "}
                          <span className="font-semibold text-orange-700">
                            {formatPercent(
                              atArrived > 0
                                ? (atNoShow / atArrived) * 100
                                : 0
                            )}
                          </span>
                          （{formatNumber(atNoShow)} of{" "}
                          {formatNumber(atArrived)}{" "}
                          scheduled did not show up）。
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* Lowest Warehouse */}

                {lowestWarehouse && (
                  <Link
                    href="/warehouse"
                    className="block rounded-xl border border-amber-100 bg-amber-50/60 p-4 transition hover:border-amber-200 hover:bg-amber-50"
                  >

                    <div className="flex items-start">

                      <AlertIcon type="warning" />

                      <div className="ml-3">

                        <p className="text-sm font-semibold text-slate-800">
                          仓库达成情况 Warehouse Fulfillment
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {lowestWarehouse.name} 达成率最低，为{" "}
                          <span className="font-semibold text-amber-700">
                            {formatPercent(lowestWarehouse.rate)}
                          </span>
                          （{lowestWarehouse.name} has the lowest fill
                          rate at {formatPercent(lowestWarehouse.rate)}
                          ）。
                        </p>

                      </div>

                    </div>

                  </Link>
                )}

                {/* Lowest Supplier */}

                {lowestSupplier && (
                  <Link
                    href="/supplier"
                    className="block rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
                  >

                    <div className="flex items-start">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
                        ↓
                      </div>

                      <div className="ml-3">

                        <p className="text-sm font-semibold text-slate-800">
                          供应商表现 Supplier Performance
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {lowestSupplier.name} 供应商达成率最低，为{" "}
                          <span className="font-semibold text-slate-700">
                            {formatPercent(lowestSupplier.rate)}
                          </span>
                          （{lowestSupplier.name} has the lowest
                          supplier fill rate at{" "}
                          {formatPercent(lowestSupplier.rate)}）。
                        </p>

                      </div>

                    </div>

                  </Link>
                )}

              </div>

            </div>

          </section>

          {/* =================================================
              WAREHOUSE
          ================================================= */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

              <div>

                <h3 className="font-bold text-slate-900">
                  仓库表现 Warehouse Performance
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  按派遣率排名 Ranked by Dispatched Rate
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

            <div className="overflow-x-auto">

              <table className="w-full min-w-[700px]">

                <thead>

                  <tr className="border-b border-slate-100 text-left">

                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      仓库 Warehouse
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      需求 Requested
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      已派遣 Dispatched
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      未派遣 Undispatched
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      派遣率 Dispatched Rate
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      到场率 Arrival Rate
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-400">
                        实际到场 ÷ 已派遣
                      </span>
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {warehouses
                    .slice(0, 10)
                    .map((warehouse, index) => {

                      const unfilled =
                        warehouse.requested -
                        warehouse.filled;

                      return (
                        <tr
                          key={`${warehouse.name}-${index}`}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                        >

                          <td className="px-6 py-4">

                            <div className="flex items-center">

                              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                                {index + 1}
                              </div>

                              <span className="text-sm font-semibold text-slate-700">
                                {warehouse.name}
                              </span>

                            </div>

                          </td>

                          <td className="px-6 py-4 text-right text-sm text-slate-600">
                            {formatNumber(warehouse.requested)}
                          </td>

                          <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">
                            {formatNumber(warehouse.filled)}
                          </td>

                          <td className="px-6 py-4 text-right text-sm font-medium text-rose-500">
                            {formatNumber(Math.max(unfilled, 0))}
                          </td>

                          <td className="px-6 py-4">

                            <div className="flex items-center justify-end gap-3">

                              <div className="hidden w-20 sm:block">

                                <MiniBar
                                  value={warehouse.rate}
                                  max={100}
                                />

                              </div>

                              <span
                                className={`w-14 text-right text-sm font-bold ${
                                  warehouse.rate >= 80
                                    ? "text-emerald-600"
                                    : warehouse.rate >= 60
                                      ? "text-amber-600"
                                      : "text-rose-600"
                                }`}
                              >
                                {formatPercent(warehouse.rate)}
                              </span>

                            </div>

                          </td>

                          <td className="px-6 py-4 text-right">
                            {warehouse.arrivalRate !== null ? (
                              <span
                                className={`text-sm font-bold ${
                                  warehouse.arrivalRate > 115 ||
                                  warehouse.arrivalRate < 70
                                    ? "text-amber-600"
                                    : "text-slate-700"
                                }`}
                              >
                                {formatPercent(
                                  warehouse.arrivalRate
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-300">
                                —
                              </span>
                            )}
                          </td>

                        </tr>
                      );
                    })}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              TRIAL FAILURE
          ================================================= */}

          <section className="mt-6 grid gap-6 lg:grid-cols-2">

            {/* Warehouse */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    各仓库试工不通过 Trial Failure by Warehouse
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    数据来源：临时工派遣表格 Source: Temp Dispatch Records
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

                <div className="space-y-4">

                  {trialWarehouses
                    .slice(0, 7)
                    .map((item, index) => {

                      const max =
                        trialWarehouses[0]?.count || 1;

                      return (
                        <div key={`${item.name}-${index}`}>

                          <div className="mb-1.5 flex items-center justify-between">

                            <span className="text-sm font-medium text-slate-600">
                              {item.name}
                            </span>

                            <span className="text-sm font-bold text-slate-800">
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

              </div>

            </div>

            {/* Supplier */}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

                <div>

                  <h3 className="font-bold text-slate-900">
                    各供应商试工不通过 Trial Failure by Supplier
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    数据来源：临时工派遣表格 Source: Temp Dispatch Records
                  </p>

                </div>

                <Link
                  href="/trial"
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                >
                  查看详情 View Details →
                </Link>

              </div>

              <div className="overflow-hidden">

                {trialSuppliers
                  .slice(0, 7)
                  .map((item, index) => (

                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center justify-between border-b border-slate-50 px-6 py-4 last:border-0"
                    >

                      <div className="flex items-center">

                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <span className="text-sm font-medium text-slate-700">
                          {item.name}
                        </span>

                      </div>

                      <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600">
                        {formatNumber(item.count)}
                      </span>

                    </div>

                  ))}

              </div>

            </div>

          </section>

          {/* =================================================
              FOOTNOTE
          ================================================= */}

          <div className="pb-8 pt-6 text-center">

            <p className="text-[11px] text-slate-400">
              人力分析平台 · 内部使用 Workforce Analytics Platform · Internal Use
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
