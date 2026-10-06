import Sidebar from "@/components/Sidebar";
import { getDashboardData } from "@/lib/data";

type Row = Record<string, string>;

function num(value: string | undefined) {
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

function getName(
  row: Row,
  candidates: string[],
  fallback = "Unknown"
) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function getFailure(row: Row) {
  return num(
    row["试工不通过人数"] ??
      row["人数"] ??
      row["试工不通过"] ??
      row["count"]
  );
}

function getReference(row: Row) {
  return num(
    row["派遣人数（参照）"] ??
      row["派遣人数"]
  );
}

function formatDateLabel(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function getReportingPeriod(rows: Row[]) {
  const dates = rows
    .map((row) =>
      row["日期"] ??
      row["考勤日期"] ??
      row["date"] ??
      ""
    )
    .filter(Boolean)
    .sort();

  if (dates.length === 0) {
    return "当前数据集 Current Dataset";
  }

  const first = dates[0];
  const last = dates[dates.length - 1];

  if (first === last) {
    return formatDateLabel(first);
  }

  return `${formatDateLabel(first)} — ${formatDateLabel(
    last
  )}`;
}

function ProgressBar({
  value,
  max,
  type = "failure",
}: {
  value: number;
  max: number;
  type?: "failure" | "neutral";
}) {
  const width =
    max > 0
      ? Math.max(
          3,
          Math.min(100, (value / max) * 100)
        )
      : 0;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${
          type === "failure"
            ? "bg-rose-400"
            : "bg-indigo-400"
        }`}
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function SeverityBadge({
  count,
  total,
}: {
  count: number;
  total: number;
}) {
  if (total <= 0) {
    return (
      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
        —
      </span>
    );
  }

  const share = count / total;

  if (share >= 0.2) {
    return (
      <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
        偏高 High
      </span>
    );
  }

  if (share >= 0.1) {
    return (
      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
        关注 Watch
      </span>
    );
  }

  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
      正常 Normal
    </span>
  );
}

export default function TrialFailurePage() {
  const data = getDashboardData();

  const supplierRows =
    data.trialFailureSupplier ?? [];

  const warehouseRows =
    data.trialFailureWarehouse ?? [];

  const jobRows =
    data.trialFailureJob ?? [];

  const supplierRef =
    data.trialFailureSupplierReference ?? [];

  const warehouseRef =
    data.trialFailureWarehouseReference ?? [];

  const jobRef =
    data.trialFailureJobReference ?? [];

  const dailyRows: Row[] = [];

  /*
   * ============================================
   * BASIC METRICS
   * ============================================
   */

  const totalFailure =
    data.trialFailure.reduce(
      (sum, row) =>
        sum + getFailure(row),
      0
    );

  const totalReference =
    supplierRef.reduce(
      (sum, row) =>
        sum + getReference(row),
      0
    );

  const reportingPeriod =
    getReportingPeriod(dailyRows);

  /*
   * ============================================
   * SUPPLIER
   * ============================================
   */

  const suppliers = supplierRows
    .map((row) => {
      const name = getName(row, [
        "供应商",
        "供应商名称",
      ]);

      const failure = getFailure(row);

      const reference = (() => {
        const refRow =
          supplierRef.find(
            (x) =>
              getName(x, [
                "供应商",
                "供应商名称",
              ]) === name
          );

        return refRow
          ? getReference(refRow)
          : 0;
      })();

      return {
        name,
        failure,
        reference,
      };
    })
    .sort(
      (a, b) =>
        b.failure - a.failure
    );

  const topSuppliers =
    suppliers.slice(0, 10);

  /*
   * ============================================
   * WAREHOUSE
   * ============================================
   */

  const warehouses = warehouseRows
    .map((row) => {
      const name = getName(row, [
        "仓库",
        "物理仓",
      ]);

      const failure = getFailure(row);

      const reference = (() => {
        const refRow =
          warehouseRef.find(
            (x) =>
              getName(x, [
                "仓库",
                "物理仓",
              ]) === name
          );

        return refRow
          ? getReference(refRow)
          : 0;
      })();

      return {
        name,
        failure,
        reference,
      };
    })
    .sort(
      (a, b) =>
        b.failure - a.failure
    );

  const topWarehouses =
    warehouses.slice(0, 10);

  /*
   * ============================================
   * JOB
   * ============================================
   */

  const jobs = jobRows
    .map((row) => {
      const name = getName(row, [
        "工种",
        "Job",
      ]);

      const failure = getFailure(row);

      const reference = (() => {
        const refRow =
          jobRef.find(
            (x) =>
              getName(x, [
                "工种",
                "Job",
              ]) === name
          );

        return refRow
          ? getReference(refRow)
          : 0;
      })();

      const share =
        totalFailure > 0
          ? (failure / totalFailure) *
            100
          : 0;

      return {
        name,
        failure,
        reference,
        share,
      };
    })
    .sort(
      (a, b) =>
        b.failure - a.failure
    );

  /*
   * ============================================
   * MANAGEMENT SIGNALS
   * ============================================
   */

  const topSupplier =
    suppliers[0];

  const topWarehouse =
    warehouses[0];

  const topJob =
    jobs[0];

  const topThreeSupplierFailure =
    suppliers
      .slice(0, 3)
      .reduce(
        (sum, row) =>
          sum + row.failure,
        0
      );

  const topThreeWarehouseFailure =
    warehouses
      .slice(0, 3)
      .reduce(
        (sum, row) =>
          sum + row.failure,
        0
      );

  const supplierConcentration =
    totalFailure > 0
      ? (topThreeSupplierFailure /
          totalFailure) *
        100
      : 0;

  const warehouseConcentration =
    totalFailure > 0
      ? (topThreeWarehouseFailure /
          totalFailure) *
        100
      : 0;

  /*
   * ============================================
   * UI
   * ============================================
   */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />

      <main className="ml-[250px] min-h-screen">
        {/* HEADER */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                劳动质量 Labor Quality
              </p>

              <h1 className="mt-1 text-xl font-bold tracking-tight">
                试工不通过分析 Trial Failure Analysis
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                试工不通过人员分析 Trial failure personnel analysis
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  统计周期 Reporting Period
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  {reportingPeriod}
                </p>
              </div>

              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="mr-2 h-2 w-2 rounded-full bg-slate-400" />

                <span className="text-xs font-semibold text-slate-600">
                  已处理数据 Processed Data
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-7 p-5 md:p-8">
          {/* INTRO */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
              劳动质量 Labor Quality
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              试工不通过集中在哪里？Where are trial failures concentrated?
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              找出试工不通过记录最多的供应商、仓库和工种。Identify which suppliers, warehouses, and job
              types account for the largest number of
              recorded trial failures.
            </p>
          </section>

          {/* KPI */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                试工不通过 Trial Failures
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatNumber(totalFailure)}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                试工不通过人数 Trial Failures
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                参照派遣 Reference Dispatch
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatNumber(totalReference)}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                派遣人数（参照）Reference Dispatch
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                供应商 Suppliers
              </p>

              <p className="mt-3 text-3xl font-bold">
                {supplierRows.length}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                有试工不通过记录 With trial-failure records
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                仓库 Warehouses
              </p>

              <p className="mt-3 text-3xl font-bold">
                {warehouseRows.length}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                有试工不通过记录 With trial-failure records
              </p>
            </div>
          </section>

          {/* DATA DEFINITION */}
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">
                !
              </div>

              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  数据说明 Data Definition
                </h3>

                <p className="mt-1 max-w-5xl text-xs leading-5 text-amber-800/80">
                  我们现在只知道"试工没通过的有多少人"，但不知道"到底有多少人参加了试工"。分母对不上，所以这个页面只展示不通过人数，不算不通过率——硬算会误导。
                  We know how many people failed the trial, but not how many actually took one. The denominator doesn't line up, so this page shows failure counts only — no failure rate, since it would mislead.
                </p>

                <p className="mt-2 text-xs font-medium text-amber-800">
                  想算真正的通过率，得先补上：这个人到岗了没、试工哪天开始哪天结束、结果是什么。To get a real rate, we'd need: did they onboard, trial start/end dates, and the outcome.
                </p>
              </div>
            </div>
          </section>

          {/* MANAGEMENT SNAPSHOT */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold">
                管理快照 Management Snapshot
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                快速定位当前试工不通过最集中的供应商、仓库和工种。Quickly locate the suppliers, warehouses, and job types with the most concentrated trial failures.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* TOP SUPPLIER */}
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Top 供应商 Top Supplier
                  </p>

                  <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                    供应商 SUPPLIER
                  </span>
                </div>

                {topSupplier ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {topSupplier.name}
                    </p>

                    <p className="mt-1 text-sm text-rose-500">
                      {formatNumber(topSupplier.failure)}{" "}
                      次试工不通过 trial failures
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* TOP WAREHOUSE */}
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Top 仓库 Top Warehouse
                  </p>

                  <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                    仓库 WAREHOUSE
                  </span>
                </div>

                {topWarehouse ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {topWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm text-rose-500">
                      {formatNumber(topWarehouse.failure)}{" "}
                      次试工不通过 trial failures
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* TOP JOB */}
              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Top 工种 Top Job
                  </p>

                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
                    工种 JOB
                  </span>
                </div>

                {topJob ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {topJob.name}
                    </p>

                    <p className="mt-1 text-sm text-amber-600">
                      {formatNumber(topJob.failure)}{" "}
                      次试工不通过 trial failures
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* CONCENTRATION */}
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    前三供应商占比 Top 3 Supplier Share
                  </p>

                  <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                    集中度 CONCENTRATION
                  </span>
                </div>

                <p className="mt-4 text-2xl font-bold text-indigo-600">
                  {supplierConcentration.toFixed(1)}%
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatNumber(topThreeSupplierFailure)}{" "}
                  /{" "}
                  {formatNumber(totalFailure)}{" "}
                  次不通过 failures
                </p>
              </div>
            </div>
          </section>

          {/* SUPPLIER + WAREHOUSE */}
          <section className="grid gap-6 xl:grid-cols-2">
            {/* SUPPLIER */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold">
                      供应商分析 Supplier Analysis
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      按供应商查看试工不通过人数 Trial failures by supplier
                    </p>
                  </div>

                  <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                    {supplierRows.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {topSuppliers.map((row, index) => {
                  const share =
                    totalFailure > 0
                      ? (row.failure / totalFailure) * 100
                      : 0;

                  return (
                    <div
                      key={`${row.name}-${index}`}
                      className="px-6 py-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-700">
                              {row.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              派遣人数（参照）Reference dispatch：
                              {formatNumber(row.reference)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-rose-500">
                            {formatNumber(row.failure)}
                          </p>

                          <p className="text-[10px] text-slate-400">
                            {share.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 pl-11">
                        <div className="flex-1">
                          <ProgressBar
                            value={row.failure}
                            max={topSuppliers[0]?.failure ?? 1}
                          />
                        </div>

                        <span className="w-10 text-right text-[10px] text-slate-400">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* WAREHOUSE */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold">
                      仓库分析 Warehouse Analysis
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      按仓库查看试工不通过人数 Trial failures by warehouse
                    </p>
                  </div>

                  <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                    {warehouseRows.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {topWarehouses.map((row, index) => {
                  const share =
                    totalFailure > 0
                      ? (row.failure / totalFailure) * 100
                      : 0;

                  return (
                    <div
                      key={`${row.name}-${index}`}
                      className="px-6 py-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-700">
                              {row.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              派遣人数（参照）Reference dispatch：
                              {formatNumber(row.reference)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-rose-500">
                            {formatNumber(row.failure)}
                          </p>

                          <p className="text-[10px] text-slate-400">
                            {share.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 pl-11">
                        <div className="flex-1">
                          <ProgressBar
                            value={row.failure}
                            max={topWarehouses[0]?.failure ?? 1}
                          />
                        </div>

                        <span className="w-10 text-right text-[10px] text-slate-400">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* JOB ANALYSIS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold">
                    各工种试工不通过 Trial Failure by Job
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    按工种分析试工不通过情况 Trial failures by job type
                  </p>
                </div>

                {topJob && (
                  <div className="hidden rounded-xl bg-rose-50 px-4 py-2 text-right sm:block">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                      最高不通过 Highest Failure
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-rose-600">
                      {topJob.name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      #
                    </th>

                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      工种 Job
                    </th>

                    <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      派遣参照 Dispatch Reference
                    </th>

                    <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      试工不通过 Trial Failure
                    </th>

                    <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      不通过占比 Share of Failures
                    </th>

                    <th className="px-6 py-4 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      信号 Signal
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {jobs.map((row, index) => (
                    <tr
                      key={`${row.name}-${index}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          {index + 1}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700">
                          {row.name}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-500">
                        {formatNumber(row.reference)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-rose-500">
                          {formatNumber(row.failure)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24">
                            <ProgressBar
                              value={row.failure}
                              max={totalFailure}
                            />
                          </div>

                          <span className="w-14 text-right text-xs font-semibold text-slate-600">
                            {row.share.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <SeverityBadge
                          count={row.failure}
                          total={totalFailure}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CONCENTRATION */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    供应商集中度 Supplier Concentration
                  </p>

                  <h3 className="mt-2 text-xl font-bold">
                    前三供应商 Top 3 suppliers
                  </h3>
                </div>

                <div className="text-2xl font-bold text-indigo-600">
                  {supplierConcentration.toFixed(1)}%
                </div>
              </div>

              <div className="mt-5">
                <ProgressBar
                  value={supplierConcentration}
                  max={100}
                  type="neutral"
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                前三供应商占 {formatNumber(topThreeSupplierFailure)}{" "}
                / {formatNumber(totalFailure)}{" "}
                条记录试工不通过。Top 3 suppliers account for{" "}
                {formatNumber(topThreeSupplierFailure)} of{" "}
                {formatNumber(totalFailure)} recorded trial failures.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    仓库集中度 Warehouse Concentration
                  </p>

                  <h3 className="mt-2 text-xl font-bold">
                    前三仓库 Top 3 warehouses
                  </h3>
                </div>

                <div className="text-2xl font-bold text-indigo-600">
                  {warehouseConcentration.toFixed(1)}%
                </div>
              </div>

              <div className="mt-5">
                <ProgressBar
                  value={warehouseConcentration}
                  max={100}
                  type="neutral"
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                前三仓库占 {formatNumber(topThreeWarehouseFailure)}{" "}
                / {formatNumber(totalFailure)}{" "}
                条记录试工不通过。Top 3 warehouses account for{" "}
                {formatNumber(topThreeWarehouseFailure)} of{" "}
                {formatNumber(totalFailure)} recorded trial failures.
              </p>
            </div>
          </section>

          {/* MANAGEMENT VIEW */}
          <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              管理视角 Management View
            </div>

            <h2 className="mt-2 text-xl font-bold">
              管理层应优先关注什么？What should management look at first?
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Supplier */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-sm text-rose-300">
                  01
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  供应商质量 Supplier Quality
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {topSupplier
                    ? `${topSupplier.name} 试工不通过记录数最高，为 ${formatNumber(
                        topSupplier.failure
                      )}（${topSupplier.name} has the highest recorded trial-failure count at ${formatNumber(
                        topSupplier.failure
                      )}）。`
                    : "暂无供应商层面不通过数据。No supplier-level failure data available."}
                </p>
              </div>

              {/* Warehouse */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-sm text-amber-300">
                  02
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  仓库集中度 Warehouse Concentration
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {topWarehouse
                    ? `${topWarehouse.name} 试工不通过记录数最高，为 ${formatNumber(
                        topWarehouse.failure
                      )}（${topWarehouse.name} has the highest recorded trial-failure count at ${formatNumber(
                        topWarehouse.failure
                      )}）。`
                    : "暂无仓库层面不通过数据。No warehouse-level failure data available."}
                </p>
              </div>

              {/* Job */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-sm text-indigo-300">
                  03
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  工种类型 Job Type
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {topJob
                    ? `${topJob.name} 占记录试工不通过的 ${topJob.share.toFixed(
                        1
                      )}%（${topJob.name} accounts for ${topJob.share.toFixed(
                        1
                      )}% of recorded trial failures）。`
                    : "暂无工种层面不通过数据。No job-level failure data available."}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                注意：这些观察描述的是记录试工不通过的分布，不应解读为供应商或仓库的不通过率，因为当前参照分母并非严格的试工人群。Important: these observations describe the
                distribution of recorded trial failures. They
                should not be interpreted as supplier or
                warehouse failure rates because the current
                reference denominator is not a strict trial
                population.
              </p>
            </div>
          </section>

          {/* FOOTER */}
          <div className="pb-6 pt-1 text-center">
            <p className="text-[11px] text-slate-400">
              试工不通过分析 · 基于当前处理后的人力数据 Trial Failure Analysis · Based on current
              processed labor data
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              参照派遣仅用于体现规模，不作为正式的试工不通过率分母。Reference dispatch is shown for scale only and
              is not used as a formal trial-failure denominator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
