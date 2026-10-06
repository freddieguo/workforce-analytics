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

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function getValue(
  row: CsvRow,
  candidates: string[]
) {
  const keys = Object.keys(row);

  // Exact match first
  for (const candidate of candidates) {
    const exact = keys.find(
      (key) => key === candidate
    );

    if (exact) {
      return row[exact];
    }
  }

  // Partial match second
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

function formatDate(value: string) {
  if (!value) return "";

  // Parse date-only strings as local time to avoid the UTC timezone shift
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  const date = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function shortDate(value: string) {
  if (!value) return "";

  // Parse date-only strings as local time to avoid the UTC timezone shift
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  const date = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(5);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getReportingPeriod(
  rows: CsvRow[]
) {
  const dates = rows
    .map((row) =>
      getValue(row, [
        "日期",
        "考勤日期",
      ])
    )
    .filter(Boolean)
    .sort();

  if (dates.length === 0) {
    return "当前数据集 Current Dataset";
  }

  const first = dates[0];
  const last = dates[dates.length - 1];

  if (first === last) {
    return formatDate(first);
  }

  return `${formatDate(first)} — ${formatDate(
    last
  )}`;
}

function getRate(
  otHours: number,
  workHours: number
) {
  return workHours > 0
    ? (otHours / workHours) * 100
    : 0;
}

function getRateClass(rate: number) {
  if (rate >= 10) {
    return "text-rose-600";
  }

  if (rate >= 7) {
    return "text-amber-600";
  }

  return "text-emerald-600";
}

function getRateBg(rate: number) {
  if (rate >= 10) {
    return "bg-rose-50";
  }

  if (rate >= 7) {
    return "bg-amber-50";
  }

  return "bg-emerald-50";
}

function getRateLabel(rate: number) {
  if (rate >= 10) {
    return "偏高 High";
  }

  if (rate >= 7) {
    return "关注 Watch";
  }

  return "正常 Normal";
}

/* =========================================================
 * BAR
 * ======================================================= */

function Bar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const width =
    max > 0
      ? Math.min(
          Math.max((value / max) * 100, 2),
          100
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
 * RATE BADGE
 * ======================================================= */

function RateBadge({
  rate,
}: {
  rate: number;
}) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${getRateBg(
        rate
      )} ${getRateClass(rate)}`}
    >
      {getRateLabel(rate)}
    </span>
  );
}

/* =========================================================
 * PAGE
 * ======================================================= */

export default function OTPage() {
  const {
    otDaily,
    otWarehouse,
    otSupplier,
    otJob,
  } = getDashboardData();

  /* =======================================================
   * DAILY OT
   *
   * IMPORTANT:
   * otDaily currently contains attendance-level records.
   * We MUST aggregate these rows by date before showing
   * a "Daily OT Trend".
   * ===================================================== */

  const dailyMap = new Map<
    string,
    {
      date: string;
      workHours: number;
      otHours: number;
    }
  >();

  for (const row of otDaily) {
    const date = getValue(row, [
      "日期",
      "考勤日期",
    ]);

    if (!date) continue;

    const workHours = numberValue(
      getValue(row, [
        "工作时长",
        "总工作时长",
        "总工时",
        "时长总计",
      ])
    );

    const otHours = numberValue(
      getValue(row, [
        "加班时长",
        "加班工时",
        "OT时长",
        "OT",
      ])
    );

    const existing = dailyMap.get(date);

    if (existing) {
      existing.workHours += workHours;
      existing.otHours += otHours;
    } else {
      dailyMap.set(date, {
        date,
        workHours,
        otHours,
      });
    }
  }

  const daily = Array.from(
    dailyMap.values()
  )
    .map((row) => ({
      ...row,
      rate: getRate(
        row.otHours,
        row.workHours
      ),
    }))
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    );

  /* =======================================================
   * TOTALS
   * ===================================================== */

  const totalWorkHours = daily.reduce(
    (sum, row) =>
      sum + row.workHours,
    0
  );

  const totalOtHours = daily.reduce(
    (sum, row) =>
      sum + row.otHours,
    0
  );

  const otRate = getRate(
    totalOtHours,
    totalWorkHours
  );

  const reportingPeriod =
    getReportingPeriod(otDaily);

  /* =======================================================
   * WAREHOUSE
   * ===================================================== */

  const warehouses = otWarehouse
    .map((row) => {
      const name =
        getValue(row, [
          "仓库",
          "物理仓",
          "需求仓",
        ]) || "未分类";

      const workHours =
        numberValue(
          getValue(row, [
            "工作时长",
            "总工作时长",
            "总工时",
            "时长总计",
          ])
        );

      const otHours =
        numberValue(
          getValue(row, [
            "加班时长",
            "加班工时",
            "OT时长",
            "OT",
          ])
        );

      const rate = getRate(
        otHours,
        workHours
      );

      return {
        name,
        workHours,
        otHours,
        rate,
      };
    })
    .filter(
      (row) => row.name !== "未分类"
    )
    .map((row) => ({
      ...row,
      share:
        totalOtHours > 0
          ? (row.otHours /
              totalOtHours) *
            100
          : 0,
    }));

  const warehousesByRate = [
    ...warehouses,
  ].sort(
    (a, b) => b.rate - a.rate
  );

  const warehousesByHours = [
    ...warehouses,
  ].sort(
    (a, b) =>
      b.otHours - a.otHours
  );

  /* =======================================================
   * SUPPLIER
   * ===================================================== */

  const suppliers = otSupplier
    .map((row) => {
      const name =
        getValue(row, [
          "供应商",
          "供应商名称",
        ]) || "未分类";

      const workHours =
        numberValue(
          getValue(row, [
            "工作时长",
            "总工作时长",
            "总工时",
            "时长总计",
          ])
        );

      const otHours =
        numberValue(
          getValue(row, [
            "加班时长",
            "加班工时",
            "OT时长",
            "OT",
          ])
        );

      const rate = getRate(
        otHours,
        workHours
      );

      return {
        name,
        workHours,
        otHours,
        rate,
      };
    })
    .filter(
      (row) => row.name !== "未分类"
    )
    .map((row) => ({
      ...row,
      share:
        totalOtHours > 0
          ? (row.otHours /
              totalOtHours) *
            100
          : 0,
    }));

  const suppliersByRate = [
    ...suppliers,
  ].sort(
    (a, b) => b.rate - a.rate
  );

  const suppliersByHours = [
    ...suppliers,
  ].sort(
    (a, b) =>
      b.otHours - a.otHours
  );

  /* =======================================================
   * JOB
   * ===================================================== */

  const jobs = otJob
    .map((row) => {
      const name =
        getValue(row, [
          "工种",
          "工作类型",
          "job",
        ]) || "未分类";

      const workHours =
        numberValue(
          getValue(row, [
            "工作时长",
            "总工作时长",
            "总工时",
            "时长总计",
          ])
        );

      const otHours =
        numberValue(
          getValue(row, [
            "加班时长",
            "加班工时",
            "OT时长",
            "OT",
          ])
        );

      const rate = getRate(
        otHours,
        workHours
      );

      return {
        name,
        workHours,
        otHours,
        rate,
      };
    })
    .filter(
      (row) => row.name !== "未分类"
    )
    .map((row) => ({
      ...row,
      share:
        totalOtHours > 0
          ? (row.otHours /
              totalOtHours) *
            100
          : 0,
    }))
    .sort(
      (a, b) =>
        b.otHours - a.otHours
    );

  /* =======================================================
   * MANAGEMENT SNAPSHOT
   * ===================================================== */

  const highestRateWarehouse =
    warehousesByRate[0];

  const largestOtWarehouse =
    warehousesByHours[0];

  const highestRateSupplier =
    suppliersByRate[0];

  const largestOtSupplier =
    suppliersByHours[0];

  const largestOtJob =
    jobs[0];

  const highestRateJob =
    [...jobs].sort(
      (a, b) => b.rate - a.rate
    )[0];

  const highestOtDay =
    [...daily].sort(
      (a, b) =>
        b.otHours - a.otHours
    )[0];

  const highestRateDay =
    [...daily].sort(
      (a, b) =>
        b.rate - a.rate
    )[0];

  /* =======================================================
   * DAILY CHART
   * ===================================================== */

  const maxDailyRate = Math.max(
    ...daily.map(
      (row) => row.rate
    ),
    1
  );

  /* =======================================================
   * WAREHOUSE CHART
   * ===================================================== */

  const maxWarehouseRate =
    Math.max(
      ...warehouses.map(
        (row) => row.rate
      ),
      1
    );

  const maxWarehouseOtHours =
    Math.max(
      ...warehouses.map(
        (row) => row.otHours
      ),
      1
    );

  /* =======================================================
   * SUPPLIER CHART
   * ===================================================== */

  const maxSupplierRate =
    Math.max(
      ...suppliers.map(
        (row) => row.rate
      ),
      1
    );

  const maxSupplierOtHours =
    Math.max(
      ...suppliers.map(
        (row) => row.otHours
      ),
      1
    );

  /* =======================================================
   * UI
   * ===================================================== */

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
              <p className="text-xs font-medium text-slate-400">
                人力管理 Workforce Management
              </p>

              <h1 className="mt-0.5 text-xl font-bold tracking-tight">
                加班分析 OT Analysis
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Reporting Period */}
              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  统计周期 Reporting Period
                </p>

                <p className="text-sm font-semibold text-slate-700">
                  {reportingPeriod}
                </p>
              </div>

              {/* Data Status */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="mr-2 h-2 w-2 rounded-full bg-slate-400" />

                <span className="text-xs font-semibold text-slate-600">
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
          {/* INTRO */}
          <section className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
              人力成本与敞口 Labor Cost & Exposure
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              加班表现 Overtime Performance
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              监控各仓库、供应商、工种及各统计日的加班敞口。Monitor overtime exposure across warehouses,
              suppliers, job types, and individual reporting
              days.
            </p>
          </section>

          {/* =================================================
              KPI
          ================================================= */}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* OT RATE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                加班率 OT Rate
              </p>

              <p
                className={`mt-3 text-3xl font-bold ${getRateClass(
                  otRate
                )}`}
              >
                {formatPercent(otRate)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {formatDecimal(totalOtHours)}{" "}
                /{" "}
                {formatDecimal(totalWorkHours)}
              </p>
            </div>

            {/* OT HOURS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                加班时长 OT Hours
              </p>

              <p className="mt-3 text-3xl font-bold text-amber-600">
                {formatDecimal(totalOtHours)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                记录的加班时长 Recorded overtime hours
              </p>
            </div>

            {/* WORK HOURS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                工作时长 Work Hours
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatDecimal(totalWorkHours)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                记录的工作时长 Recorded work hours
              </p>
            </div>

            {/* DAYS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                统计天数 Reporting Days
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatNumber(daily.length)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                考勤数据中的去重日期 Unique dates in attendance data
              </p>
            </div>
          </section>

          {/* =================================================
              MANAGEMENT SNAPSHOT
          ================================================= */}

          <section className="mt-7">
            <div className="mb-4">
              <h3 className="font-bold">
                加班管理快照 OT Management Snapshot
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                将比率信号与绝对加班敞口分开，避免小体量数据误导。Separate rate-based signals from absolute OT
                exposure to avoid misleading small-volume results.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Highest Rate Warehouse */}
              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    最高加班率 Highest OT Rate
                  </p>

                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
                    仓库 WAREHOUSE
                  </span>
                </div>

                {highestRateWarehouse ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {highestRateWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-amber-600">
                      {formatPercent(highestRateWarehouse.rate)}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatDecimal(highestRateWarehouse.otHours)}{" "}
                      加班时长 OT hours
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Largest OT Exposure */}
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    最大加班敞口 Largest OT Exposure
                  </p>

                  <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                    仓库 WAREHOUSE
                  </span>
                </div>

                {largestOtWarehouse ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {largestOtWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-rose-600">
                      {formatDecimal(largestOtWarehouse.otHours)}{" "}
                      加班时长 OT hours
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatPercent(largestOtWarehouse.rate)}{" "}
                      加班率 OT rate
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Highest Supplier */}
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    供应商最高比率 Highest Supplier Rate
                  </p>

                  <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                    供应商 SUPPLIER
                  </span>
                </div>

                {highestRateSupplier ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {highestRateSupplier.name}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-indigo-600">
                      {formatPercent(highestRateSupplier.rate)}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatDecimal(highestRateSupplier.otHours)}{" "}
                      加班时长 OT hours
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Highest Job */}
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    加班最多工种 Largest OT Job
                  </p>

                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                    工种 JOB
                  </span>
                </div>

                {largestOtJob ? (
                  <>
                    <p className="mt-4 truncate text-xl font-bold">
                      {largestOtJob.name}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-emerald-600">
                      {formatDecimal(largestOtJob.otHours)}{" "}
                      加班时长 OT hours
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatPercent(largestOtJob.share)}{" "}
                      占总加班 of total OT
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* =================================================
              DAILY OT TREND
          ================================================= */}

          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold">
                    每日加班趋势 Daily OT Trend
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    每日加班率按日期汇总所有考勤记录后计算。Daily OT rate calculated after aggregating all
                    attendance records for each date.
                  </p>
                </div>

                <div className="hidden rounded-xl bg-slate-50 px-4 py-2 text-right sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    总体 Overall
                  </p>

                  <p className={`text-sm font-bold ${getRateClass(otRate)}`}>
                    {formatPercent(otRate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {daily.length > 0 ? (
                <>
                  <div className="flex h-[300px] items-end gap-1 overflow-x-auto">
                    {daily.map((day) => {
                      const height = (day.rate / maxDailyRate) * 100;

                      return (
                        <div
                          key={day.date}
                          className="group flex h-full min-w-[26px] flex-1 flex-col justify-end"
                        >
                          <div className="relative flex flex-1 items-end">
                            <div
                              className={`w-full rounded-t-md transition-all ${
                                day.rate >= 10
                                  ? "bg-rose-400 group-hover:bg-rose-500"
                                  : day.rate >= 7
                                  ? "bg-amber-400 group-hover:bg-amber-500"
                                  : "bg-indigo-400 group-hover:bg-indigo-500"
                              }`}
                              style={{
                                height: `${Math.max(height, 3)}%`,
                              }}
                            />

                            <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                              <div className="font-semibold">
                                {formatDate(day.date)}
                              </div>

                              <div className="mt-1">
                                加班率 OT Rate: {formatPercent(day.rate)}
                              </div>

                              <div>
                                加班时长 OT Hours: {formatDecimal(day.otHours)}
                              </div>

                              <div>
                                工作时长 Work Hours:{" "}
                                {formatDecimal(day.workHours)}
                              </div>
                            </div>
                          </div>

                          <p className="mt-2 rotate-[-45deg] whitespace-nowrap text-[9px] text-slate-400">
                            {shortDate(day.date)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        单日最高比率 Highest Daily Rate
                      </p>

                      <p className="mt-2 text-lg font-bold text-rose-600">
                        {highestRateDay
                          ? formatPercent(highestRateDay.rate)
                          : "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {highestRateDay
                          ? formatDate(highestRateDay.date)
                          : ""}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        单日最多加班 Largest Daily OT
                      </p>

                      <p className="mt-2 text-lg font-bold text-amber-600">
                        {highestOtDay
                          ? formatDecimal(highestOtDay.otHours)
                          : "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {highestOtDay
                          ? formatDate(highestOtDay.date)
                          : ""}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        统计天数 Reporting Days
                      </p>

                      <p className="mt-2 text-lg font-bold">
                        {formatNumber(daily.length)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        去重日期 Unique dates
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                  暂无每日加班数据。No daily OT data available.
                </div>
              )}
            </div>
          </section>

          {/* =================================================
              WAREHOUSE ANALYSIS
          ================================================= */}

          <section className="mt-7 grid gap-6 xl:grid-cols-2">
            {/* Highest Rate */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  仓库 — 最高加班率 Warehouse — Highest OT Rate
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  比率视角。小体量仓库可能排名靠前。Rate-based view. Small-volume warehouses can
                  rank higher.
                </p>
              </div>

              <div className="divide-y divide-slate-50">
                {warehousesByRate.slice(0, 10).map((warehouse, index) => (
                  <div
                    key={`${warehouse.name}-rate`}
                    className="px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {warehouse.name}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatDecimal(warehouse.workHours)}{" "}
                            工作时长 work hours
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 text-sm font-bold ${getRateClass(
                          warehouse.rate
                        )}`}
                      >
                        {formatPercent(warehouse.rate)}
                      </span>
                    </div>

                    <Bar value={warehouse.rate} max={maxWarehouseRate} />

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {formatDecimal(warehouse.otHours)}{" "}
                        加班时长 OT hours
                      </span>

                      <span>
                        {formatPercent(warehouse.share)}{" "}
                        占总加班 of total OT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Largest Exposure */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  仓库 — 最大加班敞口 Warehouse — Largest OT Exposure
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  绝对加班时长，用于识别最大的工作量敞口。Absolute OT hours. Useful for identifying the
                  largest workload exposure.
                </p>
              </div>

              <div className="divide-y divide-slate-50">
                {warehousesByHours.slice(0, 10).map((warehouse, index) => (
                  <div
                    key={`${warehouse.name}-hours`}
                    className="px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[11px] font-bold text-rose-600">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {warehouse.name}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatPercent(warehouse.rate)}{" "}
                            加班率 OT rate
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-rose-600">
                        {formatDecimal(warehouse.otHours)}
                      </span>
                    </div>

                    <Bar value={warehouse.otHours} max={maxWarehouseOtHours} />

                    <div className="mt-2 text-[11px] text-slate-400">
                      {formatPercent(warehouse.share)}{" "}
                      占总加班时长 of total OT hours
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* =================================================
              SUPPLIER ANALYSIS
          ================================================= */}

          <section className="mt-7 grid gap-6 xl:grid-cols-2">
            {/* Supplier Rate */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  供应商 — 最高加班率 Supplier — Highest OT Rate
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  加班敞口的比率视角。Rate-based view of overtime exposure.
                </p>
              </div>

              <div className="divide-y divide-slate-50">
                {suppliersByRate.slice(0, 10).map((supplier, index) => (
                  <div
                    key={`${supplier.name}-rate`}
                    className="px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {supplier.name}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatDecimal(supplier.workHours)}{" "}
                            工作时长 work hours
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 text-sm font-bold ${getRateClass(
                          supplier.rate
                        )}`}
                      >
                        {formatPercent(supplier.rate)}
                      </span>
                    </div>

                    <Bar value={supplier.rate} max={maxSupplierRate} />

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {formatDecimal(supplier.otHours)}{" "}
                        加班时长 OT hours
                      </span>

                      <span>
                        {formatPercent(supplier.share)}{" "}
                        占总加班 of total OT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier Exposure */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  供应商 — 最大加班敞口 Supplier — Largest OT Exposure
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  贡献绝对加班时长最多的供应商。Suppliers contributing the largest absolute
                  OT hours.
                </p>
              </div>

              <div className="divide-y divide-slate-50">
                {suppliersByHours.slice(0, 10).map((supplier, index) => (
                  <div
                    key={`${supplier.name}-hours`}
                    className="px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[11px] font-bold text-rose-600">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {supplier.name}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatPercent(supplier.rate)}{" "}
                            加班率 OT rate
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-rose-600">
                        {formatDecimal(supplier.otHours)}
                      </span>
                    </div>

                    <Bar value={supplier.otHours} max={maxSupplierOtHours} />

                    <div className="mt-2 text-[11px] text-slate-400">
                      {formatPercent(supplier.share)}{" "}
                      占总加班时长 of total OT hours
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* =================================================
              JOB ANALYSIS
          ================================================= */}

          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold">
                    各工种加班 OT by Job
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    按绝对加班时长排序的各工种加班敞口。Overtime exposure by labor type, sorted by
                    absolute OT hours.
                  </p>
                </div>

                {largestOtJob && (
                  <div className="hidden rounded-xl bg-rose-50 px-4 py-2 text-right sm:block">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                      最大加班敞口 Largest OT Exposure
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-rose-600">
                      {largestOtJob.name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      #
                    </th>

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      工种 Job
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      工作时长 Work Hours
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      加班时长 OT Hours
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      加班率 OT Rate
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      加班占比 OT Share
                    </th>

                    <th className="px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      信号 Signal
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {jobs.map((job, index) => (
                    <tr
                      key={`${job.name}-${index}`}
                      className="border-b border-slate-50 transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                          {index + 1}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700">
                          {job.name}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatDecimal(job.workHours)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">
                        {formatDecimal(job.otHours)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-sm font-bold ${getRateClass(
                            job.rate
                          )}`}
                        >
                          {formatPercent(job.rate)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24">
                            <Bar value={job.share} max={100} />
                          </div>

                          <span className="w-14 text-right text-xs font-semibold text-slate-600">
                            {formatPercent(job.share)}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <RateBadge rate={job.rate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* =================================================
              MANAGEMENT INTERPRETATION
          ================================================= */}

          <section className="mt-7 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              管理视角 Management View
            </p>

            <h3 className="mt-2 text-xl font-bold">
              管理层应优先关注什么？What should management look at first?
            </h3>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Daily */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-sm font-bold text-indigo-300">
                  01
                </div>

                <h4 className="mt-4 text-sm font-semibold">
                  每日敞口 Daily Exposure
                </h4>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {highestRateDay
                    ? `${formatDate(
                        highestRateDay.date
                      )} 单日加班率最高，为 ${formatPercent(
                        highestRateDay.rate
                      )}（${formatDate(
                        highestRateDay.date
                      )} recorded the highest daily OT rate at ${formatPercent(
                        highestRateDay.rate
                      )}）。`
                    : "暂无每日加班数据。No daily OT data available."}
                </p>
              </div>

              {/* Warehouse */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-sm font-bold text-rose-300">
                  02
                </div>

                <h4 className="mt-4 text-sm font-semibold">
                  仓库敞口 Warehouse Exposure
                </h4>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {largestOtWarehouse
                    ? `${largestOtWarehouse.name} 贡献了 ${formatDecimal(
                        largestOtWarehouse.otHours
                      )} 加班时长，为仓库层面最大敞口（${
                        largestOtWarehouse.name
                      } contributed ${formatDecimal(
                        largestOtWarehouse.otHours
                      )} OT hours, the largest warehouse-level exposure）。`
                    : "暂无仓库加班数据。No warehouse OT data available."}
                </p>
              </div>

              {/* Job */}
              <div className="rounded-2xl bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-sm font-bold text-amber-300">
                  03
                </div>

                <h4 className="mt-4 text-sm font-semibold">
                  工种敞口 Job Exposure
                </h4>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {largestOtJob
                    ? `${largestOtJob.name} 贡献了 ${formatDecimal(
                        largestOtJob.otHours
                      )} 加班时长，占总加班 ${formatPercent(
                        largestOtJob.share
                      )}（${largestOtJob.name} contributed ${formatDecimal(
                        largestOtJob.otHours
                      )} OT hours, representing ${formatPercent(
                        largestOtJob.share
                      )} of total OT）。`
                    : "暂无工种加班数据。No job-level OT data available."}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                加班率 = 记录的加班时长 ÷ 记录的工作时长。加班时长单独展示，因为高比率可能源于较小的分母。OT Rate is calculated as recorded OT hours
                divided by recorded work hours. OT Hours are
                shown separately because a high percentage can
                result from a small work-hour denominator.
              </p>
            </div>
          </section>

          {/* =================================================
              DATA NOTE
          ================================================= */}

          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                i
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-700">
                  加班数据定义 OT Data Definition
                </h3>

                <p className="mt-1 max-w-5xl text-xs leading-5 text-slate-500">
                  加班率 = 记录的加班时长 ÷ 记录的工作时长。每日数值按日期汇总考勤记录后计算。仓库、供应商和工种数值根据各自处理后的加班数据集计算。OT Rate = Recorded OT Hours ÷ Recorded Work
                  Hours. Daily values are calculated after
                  aggregating attendance records by date.
                  Warehouse, supplier, and job values are
                  calculated from their corresponding processed
                  OT datasets.
                </p>
              </div>
            </div>
          </section>

          {/* FOOTER */}

          <div className="pb-8 pt-6 text-center">
            <p className="text-[11px] text-slate-400">
              人力分析平台 · 加班分析 Workforce Analytics Platform · OT Analysis
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              加班率 = 记录的加班时长 ÷ 记录的工作时长 OT Rate = Recorded OT Hours ÷ Recorded Work Hours
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
