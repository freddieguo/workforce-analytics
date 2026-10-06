import Sidebar from "@/components/Sidebar";
import { getDashboardData, type CsvRow } from "@/lib/data";

/* =========================================================
 * HELPERS
 * ======================================================= */

function numberValue(value: string | undefined) {
  if (!value) return 0;

  const n = Number(
    value
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(
    Math.round(value)
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getValue(
  row: CsvRow,
  candidates: string[]
) {
  const keys = Object.keys(row);

  for (const candidate of candidates) {
    const exact = keys.find(
      (key) => key === candidate
    );

    if (exact) {
      return row[exact];
    }
  }

  for (const candidate of candidates) {
    const partial = keys.find((key) =>
      key.includes(candidate)
    );

    if (partial) {
      return row[partial];
    }
  }

  return "";
}

/* =========================================================
 * STATUS
 * ======================================================= */

type QualityStatus =
  | "good"
  | "warning"
  | "error";

function StatusBadge({
  status,
}: {
  status: QualityStatus;
}) {
  if (status === "good") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        健康 Healthy
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
        警告 Warning
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
      需要处理 Attention Required
    </span>
  );
}

function DatasetStatus({
  rows,
}: {
  rows: number;
}) {
  if (rows > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        可用 Available
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
      为空 Empty
    </span>
  );
}

/* =========================================================
 * PROGRESS BAR
 * ======================================================= */

function ProgressBar({
  value,
  max = 100,
  tone = "indigo",
}: {
  value: number;
  max?: number;
  tone?: "indigo" | "amber" | "rose" | "emerald";
}) {
  const width =
    max > 0
      ? Math.min(
          Math.max((value / max) * 100, 0),
          100
        )
      : 0;

  const toneClass = {
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
  }[tone];

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${toneClass}`}
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

/* =========================================================
 * PAGE
 * ======================================================= */

export default function DataQualityPage() {
  const data = getDashboardData();

  /* =======================================================
   * MISSING SUPPLIER
   * ===================================================== */

  const missingSupplier =
    data.missingSupplierAllocation ?? [];

  const allocationCount =
    data.allocation.length;

  const missingSupplierCount =
    missingSupplier.length;

  const attributedAllocationCount =
    Math.max(
      allocationCount -
        missingSupplierCount,
      0
    );

  const supplierCoverage =
    allocationCount > 0
      ? (attributedAllocationCount /
          allocationCount) *
        100
      : 0;

  const missingSupplierRate =
    allocationCount > 0
      ? (missingSupplierCount /
          allocationCount) *
        100
      : 0;

  /* =======================================================
   * DATASET INVENTORY
   *
   * These are actual processed datasets exposed by
   * getDashboardData().
   * ======================================================= */

  const datasets = [
    {
      name: "Demand",
      file: "demand.csv",
      rows: data.demand.length,
      description: "用工需求池 Demand pool",
      category: "核心 Core",
    },
    {
      name: "Dispatch",
      file: "dispatch.csv",
      rows: data.dispatch.length,
      description: "派遣人员明细 Dispatch details",
      category: "核心 Core",
    },
    {
      name: "Supplier Allocation",
      file: "supplier_allocation.csv",
      rows: data.allocation.length,
      description: "供应商需求分配 Supplier allocation",
      category: "核心 Core",
    },
    {
      name: "Supplier Summary",
      file: "supplier_summary.csv",
      rows: data.supplierSummary.length,
      description: "供应商汇总 Supplier summary",
      category: "供应商 Supplier",
    },
    {
      name: "Supplier × Warehouse",
      file: "supplier_warehouse.csv",
      rows: data.supplierWarehouse.length,
      description: "供应商仓库分析 Supplier × warehouse",
      category: "供应商 Supplier",
    },
    {
      name: "Supplier × Job",
      file: "supplier_job.csv",
      rows: data.supplierJob.length,
      description: "供应商工种分析 Supplier × job",
      category: "供应商 Supplier",
    },
    {
      name: "Warehouse Summary",
      file: "warehouse_summary.csv",
      rows: data.warehouseSummary.length,
      description: "仓库汇总 Warehouse summary",
      category: "仓库 Warehouse",
    },
    {
      name: "Warehouse × Job",
      file: "warehouse_job.csv",
      rows: data.warehouseJob.length,
      description: "仓库工种分析 Warehouse × job",
      category: "仓库 Warehouse",
    },
    {
      name: "OT Daily",
      file: "ot_daily.csv",
      rows: data.otDaily.length,
      description: "考勤 / OT 明细数据 Attendance / OT details",
      category: "加班 OT",
    },
    {
      name: "OT Warehouse",
      file: "ot_warehouse.csv",
      rows: data.otWarehouse.length,
      description: "仓库 OT 汇总 Warehouse OT summary",
      category: "加班 OT",
    },
    {
      name: "OT Supplier",
      file: "ot_supplier.csv",
      rows: data.otSupplier.length,
      description: "供应商 OT 汇总 Supplier OT summary",
      category: "加班 OT",
    },
    {
      name: "OT Job",
      file: "ot_job.csv",
      rows: data.otJob.length,
      description: "工种 OT 汇总 Job OT summary",
      category: "加班 OT",
    },
    {
      name: "Trial Failure",
      file: "trial_failure.csv",
      rows: data.trialFailure.length,
      description: "试工不通过记录 Trial failure records",
      category: "质量 Quality",
    },
    {
      name: "Trial Failure Daily",
      file: "trial_failure_daily.csv",
      rows: data.trialFailureDaily.length,
      description: "试工不通过日报 Trial failure daily",
      category: "质量 Quality",
    },
    {
      name: "Trial Failure Supplier",
      file: "trial_failure_supplier.csv",
      rows: data.trialFailureSupplier.length,
      description: "供应商试工不通过 Supplier trial failures",
      category: "质量 Quality",
    },
    {
      name: "Trial Failure Warehouse",
      file: "trial_failure_warehouse.csv",
      rows: data.trialFailureWarehouse.length,
      description: "仓库试工不通过 Warehouse trial failures",
      category: "质量 Quality",
    },
    {
      name: "Trial Failure Job",
      file: "trial_failure_job.csv",
      rows: data.trialFailureJob.length,
      description: "工种试工不通过 Job trial failures",
      category: "质量 Quality",
    },
  ];

  const availableDatasets =
    datasets.filter(
      (dataset) => dataset.rows > 0
    ).length;

  const emptyDatasets =
    datasets.filter(
      (dataset) => dataset.rows === 0
    );

  const datasetAvailability =
    datasets.length > 0
      ? (availableDatasets /
          datasets.length) *
        100
      : 0;

  /* =======================================================
   * QUALITY STATUS
   *
   * Supplier attribution is the primary quality issue
   * currently measurable from the processed data.
   * ======================================================= */

  let qualityStatus: QualityStatus =
    "good";

  if (
    emptyDatasets.length > 0 ||
    missingSupplierRate >= 10
  ) {
    qualityStatus = "error";
  } else if (
    missingSupplierRate > 0
  ) {
    qualityStatus = "warning";
  }

  /* =======================================================
   * MISSING SUPPLIER TABLE
   *
   * Sort by largest unfilled exposure first.
   * ===================================================== */

  const missingSupplierRows =
    missingSupplier
      .map((row, index) => {
        const requested = numberValue(
          getValue(row, [
            "供应商请求人数",
            "请求人数",
            "供应商需派遣人数",
          ])
        );

        const filled = numberValue(
          getValue(row, [
            "供应商已填人数",
            "已派遣人数",
            "供应商已派遣人数",
          ])
        );

        const unfilled = Math.max(
          requested - filled,
          0
        );

        return {
          row,
          index,
          requested,
          filled,
          unfilled,
        };
      })
      .sort(
        (a, b) =>
          b.unfilled - a.unfilled ||
          b.requested - a.requested
      );

  const totalMissingRequested =
    missingSupplierRows.reduce(
      (sum, item) =>
        sum + item.requested,
      0
    );

  const totalMissingFilled =
    missingSupplierRows.reduce(
      (sum, item) =>
        sum + item.filled,
      0
    );

  const totalMissingUnfilled =
    missingSupplierRows.reduce(
      (sum, item) =>
        sum + item.unfilled,
      0
    );

  /* =======================================================
   * QUALITY SIGNALS
   * ======================================================= */

  const qualitySignals = [
    {
      title: "供应商归属 Supplier Attribution",
      value:
        missingSupplierCount === 0
          ? "完整 Complete"
          : `${formatNumber(
              missingSupplierCount
            )} 缺失 missing`,
      description:
        "无法确认供应商归属的 Allocation 不应该被强行分配给某个供应商。Allocations without confirmed supplier attribution should not be force-assigned to a supplier.",
      tone:
        missingSupplierCount === 0
          ? "emerald"
          : missingSupplierRate >= 10
          ? "rose"
          : "amber",
    },
    {
      title: "数据集可用性 Dataset Availability",
      value: `${formatPercent(
        datasetAvailability
      )}`,
      description:
        "检查当前 dashboard 所依赖的 processed datasets 是否存在有效记录。Check whether the processed datasets this dashboard depends on have valid records.",
      tone:
        emptyDatasets.length === 0
          ? "emerald"
          : "rose",
    },
    {
      title: "调配去重 Allocation Deduplication",
      value: "已应用 Applied",
      description:
        "Supplier Allocation 按需求 + 供应商维度去重，避免员工明细重复放大需求。Supplier Allocation is deduplicated by demand + supplier to avoid employee-level records inflating demand.",
      tone: "emerald",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />

      <main className="lg:pl-[250px]">
        {/* =================================================
            HEADER
        ================================================= */}

        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                系统监控 System Monitoring
              </p>

              <h1 className="mt-1 text-xl font-bold tracking-tight">
                数据质量 Data Quality
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                数据完整性、归属质量与分析管道状态 Data integrity, attribution quality, and pipeline status
              </p>
            </div>

            <StatusBadge
              status={qualityStatus}
            />
          </div>
        </header>

        <div className="space-y-7 p-5 md:p-8">
          {/* =================================================
              OVERVIEW
          ================================================= */}

          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
              数据治理 Data Governance
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              这个数据分析值得信任吗？Is the analysis data ready to trust?
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              监控数据集可用性，识别可能影响供应商、仓库和人力分析的数据归属问题。Monitor dataset availability and identify data
              attribution issues that could affect supplier,
              warehouse, and labor analysis.
            </p>
          </section>

          {/* =================================================
              KPI
          ================================================= */}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Dataset Availability */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                数据集可用性 Dataset Availability
              </p>

              <p className="mt-3 text-3xl font-bold">
                {availableDatasets}
                <span className="ml-1 text-lg font-normal text-slate-400">
                  / {datasets.length}
                </span>
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {formatPercent(
                  datasetAvailability
                )}{" "}
                个数据集可用 datasets available
              </p>
            </div>

            {/* Allocation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                调配记录 Allocation Records
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatNumber(
                  allocationCount
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                去重后的供应商调配记录 Deduplicated supplier allocations
              </p>
            </div>

            {/* Missing Supplier */}
            <div
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                missingSupplierCount > 0
                  ? "border-amber-200"
                  : "border-slate-200"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                缺少供应商 Missing Supplier
              </p>

              <p
                className={`mt-3 text-3xl font-bold ${
                  missingSupplierCount > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {formatNumber(
                  missingSupplierCount
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {formatPercent(
                  missingSupplierRate
                )}{" "}
                占调配记录 of allocations
              </p>
            </div>

            {/* Supplier Coverage */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                供应商覆盖率 Supplier Coverage
              </p>

              <p
                className={`mt-3 text-3xl font-bold ${
                  supplierCoverage >= 90
                    ? "text-emerald-600"
                    : supplierCoverage >= 80
                    ? "text-amber-600"
                    : "text-rose-600"
                }`}
              >
                {formatPercent(
                  supplierCoverage
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {formatNumber(
                  attributedAllocationCount
                )}{" "}
                /{" "}
                {formatNumber(
                  allocationCount
                )}{" "}
                已归属 attributed
              </p>
            </div>
          </section>

          {/* =================================================
              QUALITY SUMMARY
          ================================================= */}

          <section className="grid gap-6 xl:grid-cols-3">
            {/* Main status */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    当前质量状态 Current Quality Status
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    {qualityStatus ===
                    "good"
                      ? "数据管道健康 Data pipeline is healthy"
                      : qualityStatus ===
                        "warning"
                      ? "一些归属问题需要检查 Some attribution issues need review"
                      : "数据质量问题需要处理 Data quality issues require attention"}
                  </h2>
                </div>

                <StatusBadge
                  status={qualityStatus}
                />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    供应商归属覆盖率 Supplier Attribution Coverage
                  </span>

                  <span className="text-xs font-bold text-slate-700">
                    {formatPercent(
                      supplierCoverage
                    )}
                  </span>
                </div>

                <ProgressBar
                  value={
                    supplierCoverage
                  }
                  tone={
                    supplierCoverage >=
                    90
                      ? "emerald"
                      : supplierCoverage >=
                        80
                      ? "amber"
                      : "rose"
                  }
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    总调配 Total Allocation
                  </p>

                  <p className="mt-2 text-lg font-bold">
                    {formatNumber(
                      allocationCount
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    已归属 Attributed
                  </p>

                  <p className="mt-2 text-lg font-bold text-emerald-700">
                    {formatNumber(
                      attributedAllocationCount
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                    缺失 Missing
                  </p>

                  <p className="mt-2 text-lg font-bold text-amber-700">
                    {formatNumber(
                      missingSupplierCount
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Primary issue */}
            <div
              className={`rounded-2xl border p-6 shadow-sm ${
                missingSupplierCount > 0
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-emerald-200 bg-emerald-50/60"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-widest ${
                  missingSupplierCount > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                主要数据问题 Primary Data Issue
              </p>

              <h3
                className={`mt-3 text-xl font-bold ${
                  missingSupplierCount > 0
                    ? "text-amber-900"
                    : "text-emerald-900"
                }`}
              >
                {missingSupplierCount > 0
                  ? "缺少供应商归属 Missing Supplier Attribution"
                  : "无归属缺口 No Attribution Gap"}
              </h3>

              <p
                className={`mt-2 text-sm leading-6 ${
                  missingSupplierCount > 0
                    ? "text-amber-800/80"
                    : "text-emerald-800/80"
                }`}
              >
                {missingSupplierCount > 0
                  ? `${formatNumber(
                      missingSupplierCount
                    )} 条调配记录目前无法归属到供应商。${formatNumber(
                      missingSupplierCount
                    )} allocation records cannot currently be attributed to a supplier.`
                  : "当前所有供应商调配记录都有供应商归属。All current supplier allocation records have supplier attribution."}
              </p>

              {missingSupplierCount >
                0 && (
                <div className="mt-5 rounded-xl bg-white/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                    缺失率 Missing Rate
                  </p>

                  <p className="mt-1 text-2xl font-bold text-amber-700">
                    {formatPercent(
                      missingSupplierRate
                    )}
                  </p>

                  <p className="mt-1 text-xs text-amber-700/70">
                    {formatNumber(
                      missingSupplierCount
                    )}{" "}
                    /{" "}
                    {formatNumber(
                      allocationCount
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* =================================================
              QUALITY SIGNALS
          ================================================= */}

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold">
                质量信号 Quality Signals
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                当前应用于处理后分析数据集的检查。Current checks applied to the processed analytical
                datasets.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {qualitySignals.map(
                (signal) => {
                  const toneMap = {
                    emerald:
                      "border-emerald-100 bg-emerald-50/50 text-emerald-700",
                    amber:
                      "border-amber-100 bg-amber-50/50 text-amber-700",
                    rose:
                      "border-rose-100 bg-rose-50/50 text-rose-700",
                  };

                  return (
                    <div
                      key={
                        signal.title
                      }
                      className={`rounded-2xl border p-5 ${toneMap[
                        signal.tone as keyof typeof toneMap
                      ]}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                            {signal.title}
                          </p>

                          <p className="mt-2 text-xl font-bold">
                            {signal.value}
                          </p>
                        </div>

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-sm font-bold">
                          ✓
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-5 opacity-75">
                        {
                          signal.description
                        }
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* =================================================
              DATA PIPELINE
          ================================================= */}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold">
                    数据管道 Data Pipeline
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    当前 dashboard 所使用的 processed datasets Processed datasets used by this dashboard
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {availableDatasets} /{" "}
                  {datasets.length} 可用 available
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {datasets.map(
                (dataset) => (
                  <div
                    key={dataset.file}
                    className="flex flex-col gap-4 px-6 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                          dataset.rows >
                          0
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {dataset.rows >
                        0
                          ? "✓"
                          : "!"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">
                            {
                              dataset.name
                            }
                          </span>

                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                            {
                              dataset.category
                            }
                          </span>
                        </div>

                        <div className="mt-1 truncate text-xs text-slate-400">
                          {
                            dataset.description
                          }{" "}
                          ·{" "}
                          {
                            dataset.file
                          }
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">
                          {formatNumber(
                            dataset.rows
                          )}
                        </p>

                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          行数 Rows
                        </p>
                      </div>

                      <DatasetStatus
                        rows={
                          dataset.rows
                        }
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* =================================================
              EMPTY DATASETS
          ================================================= */}

          {emptyDatasets.length >
            0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 font-bold text-rose-600">
                  !
                </div>

                <div>
                  <h2 className="font-bold text-rose-900">
                    发现空数据集 Empty Datasets Detected
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-rose-800/70">
                    以下 processed datasets 当前没有记录，相关页面或指标可能无法计算。The following processed datasets currently have no records; related pages or metrics may not be calculable.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {emptyDatasets.map(
                      (dataset) => (
                        <span
                          key={
                            dataset.file
                          }
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          {
                            dataset.name
                          }
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =================================================
              MISSING SUPPLIER
          ================================================= */}

          <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                    数据归属 Data Attribution
                  </p>

                  <h2 className="mt-1 font-bold text-amber-950">
                    缺少供应商归属 Missing Supplier Attribution
                  </h2>

                  <p className="mt-1 text-xs text-amber-800/70">
                    缺少供应商归属的需求分配记录 Allocation records missing supplier attribution
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white px-4 py-2.5 text-right shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      缺失 Missing
                    </p>

                    <p className="text-lg font-bold text-amber-700">
                      {formatNumber(
                        missingSupplierCount
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-4 py-2.5 text-right shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      比率 Rate
                    </p>

                    <p className="text-lg font-bold text-amber-700">
                      {formatPercent(
                        missingSupplierRate
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Exposure summary */}
            {missingSupplierCount >
              0 && (
              <div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    需求 Requested
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {formatNumber(
                      totalMissingRequested
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    已派遣 Filled
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {formatNumber(
                      totalMissingFilled
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                    未满足敞口 Unfilled Exposure
                  </p>

                  <p className="mt-2 text-xl font-bold text-amber-700">
                    {formatNumber(
                      totalMissingUnfilled
                    )}
                  </p>
                </div>
              </div>
            )}

            {missingSupplierCount ===
            0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-600">
                  ✓
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-700">
                  无缺少供应商归属 No missing supplier attribution
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  当前没有发现缺少供应商归属的 Allocation。No allocations missing supplier attribution were found.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          日期 Date
                        </th>

                        <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          仓库 Warehouse
                        </th>

                        <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          组 Group
                        </th>

                        <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          工种 Job
                        </th>

                        <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          班次 Shift
                        </th>

                        <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          需求 Requested
                        </th>

                        <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          已派遣 Filled
                        </th>

                        <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          未派遣 Unfilled
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {missingSupplierRows
                        .slice(0, 100)
                        .map(
                          ({
                            row,
                            index,
                            requested,
                            filled,
                            unfilled,
                          }) => (
                            <tr
                              key={`${getValue(
                                row,
                                [
                                  "需求日期",
                                  "日期",
                                ]
                              )}-${getValue(
                                row,
                                [
                                  "需求仓",
                                  "仓库",
                                ]
                              )}-${getValue(
                                row,
                                [
                                  "工种",
                                ]
                              )}-${index}`}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-6 py-3 text-sm text-slate-600">
                                {getValue(
                                  row,
                                  [
                                    "需求日期",
                                    "日期",
                                  ]
                                ) ||
                                  "—"}
                              </td>

                              <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                                {getValue(
                                  row,
                                  [
                                    "需求仓",
                                    "仓库",
                                  ]
                                ) ||
                                  "—"}
                              </td>

                              <td className="px-6 py-3 text-sm text-slate-600">
                                {getValue(
                                  row,
                                  [
                                    "需求组",
                                    "组",
                                  ]
                                ) ||
                                  "—"}
                              </td>

                              <td className="px-6 py-3 text-sm text-slate-600">
                                {getValue(
                                  row,
                                  [
                                    "工种",
                                  ]
                                ) ||
                                  "—"}
                              </td>

                              <td className="px-6 py-3 text-sm text-slate-600">
                                {getValue(
                                  row,
                                  [
                                    "班次",
                                  ]
                                ) ||
                                  "—"}
                              </td>

                              <td className="px-6 py-3 text-right text-sm text-slate-600">
                                {formatNumber(
                                  requested
                                )}
                              </td>

                              <td className="px-6 py-3 text-right text-sm text-slate-600">
                                {formatNumber(
                                  filled
                                )}
                              </td>

                              <td className="px-6 py-3 text-right">
                                <span
                                  className={`text-sm font-bold ${
                                    unfilled >
                                    0
                                      ? "text-amber-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {formatNumber(
                                    unfilled
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                    </tbody>
                  </table>
                </div>

                {missingSupplierCount >
                  100 && (
                  <div className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400">
                    当前显示影响最大的前 100 条，共{" "}
                    {formatNumber(
                      missingSupplierCount
                    )}{" "}
                    条记录。Showing the top 100 by impact,{" "}
                    {formatNumber(
                      missingSupplierCount
                    )}{" "}
                    records in total.
                  </div>
                )}
              </>
            )}
          </section>

          {/* =================================================
              DATA GOVERNANCE
          ================================================= */}

          <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              数据治理 Data Governance
            </p>

            <h2 className="mt-2 text-xl font-bold">
              当前数据质量规则 Current Data Quality Rules
            </h2>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              当前系统遵循以下规则，避免在缺少数据依据的情况下生成看起来精确但实际上不可靠的指标。The system follows these rules to avoid generating seemingly precise but unreliable metrics without data support.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Supplier Attribution */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-sm font-bold text-indigo-300">
                  01
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  供应商归属 Supplier Attribution
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  无法确认供应商归属的 Allocation
                  不应该被强行分配给某个供应商。Allocations without confirmed supplier attribution should not be force-assigned to a supplier.
                </p>
              </div>

              {/* Deduplication */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-300">
                  02
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  调配去重 Allocation Deduplication
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  同一需求可能对应多个员工记录，
                  Supplier Allocation
                  必须按照需求 + 供应商维度去重。One demand may map to multiple employee records;
                  Supplier Allocation must be deduplicated by demand + supplier.
                </p>
              </div>

              {/* Missing Data */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-sm font-bold text-amber-300">
                  03
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  缺失数据 Missing Data
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  缺失必要字段时，不应该生成看起来精确但实际上没有数据依据的指标。When required fields are missing, no seemingly precise metrics should be generated without data support.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                Data Quality
                页面只报告当前数据中可以验证的质量问题，不对无法从现有数据确认的业务原因做推断。The Data Quality
                page only reports verifiable quality issues in the current data, and does not infer business causes that cannot be confirmed from existing data.
              </p>
            </div>
          </section>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="pb-6 pt-1 text-center">
            <p className="text-[11px] text-slate-400">
              数据质量 · 人力分析 Data Quality · Workforce Analytics
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              处理后的分析数据集 · 供应商归属与管道监控 Processed analytical datasets · Supplier attribution
              and pipeline monitoring
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
