import Sidebar from "@/components/Sidebar";
import { getDashboardData, type CsvRow } from "@/lib/data";

function numberValue(value: string | undefined) {
  if (!value) return 0;

  const n = Number(
    value.replace(/,/g, "").replace(/%/g, "").trim()
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

function getValue(
  row: CsvRow,
  candidates: string[]
) {
  const keys = Object.keys(row);

  for (const candidate of candidates) {
    const exact = keys.find(
      (key) => key === candidate
    );

    if (exact) return row[exact];
  }

  for (const candidate of candidates) {
    const partial = keys.find((key) =>
      key.includes(candidate)
    );

    if (partial) return row[partial];
  }

  return "";
}

function MiniBar({
  value,
  type = "normal",
}: {
  value: number;
  type?: "normal" | "danger";
}) {
  const width = Math.max(
    0,
    Math.min(100, value)
  );

  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${
          type === "danger"
            ? "bg-rose-400"
            : "bg-indigo-500"
        }`}
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function StatusBadge({
  fillRate,
}: {
  fillRate: number;
}) {
  if (fillRate >= 80) {
    return (
      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        强劲 Strong
      </span>
    );
  }

  if (fillRate >= 60) {
    return (
      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        关注 Watch
      </span>
    );
  }

  return (
    <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
      注意 Attention
    </span>
  );
}

export default function WarehousePage() {
  const {
    demand,
    warehouseSummary,
    warehouseJob,
  } = getDashboardData();

  /*
   * ============================================
   * WAREHOUSE SUMMARY
   * ============================================
   */

  const warehouses = warehouseSummary
    .map((row) => {
      const name =
        getValue(row, [
          "需求仓",
          "物理仓",
          "仓库",
        ]) || "未分类";

      const requested = numberValue(
        getValue(row, [
          "需求人数",
          "供应商需派遣人数",
        ])
      );

      const filled = numberValue(
        getValue(row, [
          "已派遣人数",
          "供应商已派遣人数",
        ])
      );

      const unfilled = numberValue(
        getValue(row, [
          "未派遣人数",
          "供应商未派遣人数",
        ])
      );

      const allocations = numberValue(
        getValue(row, [
          "分配次数",
        ])
      );

      const fillRate =
        requested > 0
          ? (filled / requested) * 100
          : 0;

      return {
        name,
        requested,
        filled,
        unfilled,
        allocations,
        fillRate,
      };
    })
    .filter(
      (warehouse) =>
        warehouse.name !== "未分类"
    )
    .sort(
      (a, b) =>
        b.requested - a.requested
    );

  /*
   * ============================================
   * TOTALS
   * ============================================
   */

  const totalRequested = warehouses.reduce(
    (sum, warehouse) =>
      sum + warehouse.requested,
    0
  );

  const totalFilled = warehouses.reduce(
    (sum, warehouse) =>
      sum + warehouse.filled,
    0
  );

  const totalUnfilled = warehouses.reduce(
    (sum, warehouse) =>
      sum + warehouse.unfilled,
    0
  );

  const overallFillRate =
    totalRequested > 0
      ? (totalFilled / totalRequested) * 100
      : 0;

  /*
   * ============================================
   * REPORTING PERIOD
   * ============================================
   */

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
      : "统计周期不可用 Reporting period unavailable";

  /*
   * ============================================
   * MANAGEMENT SNAPSHOT
   * ============================================
   */

  const largestDemandWarehouse =
    [...warehouses].sort(
      (a, b) =>
        b.requested - a.requested
    )[0];

  const largestUnfilledWarehouse =
    [...warehouses].sort(
      (a, b) =>
        b.unfilled - a.unfilled
    )[0];

  const lowestFillWarehouse =
    [...warehouses]
      .filter(
        (warehouse) =>
          warehouse.requested > 0
      )
      .sort(
        (a, b) =>
          a.fillRate - b.fillRate
      )[0];

  /*
   * High-volume warehouse:
   * avoid allowing very small demand
   * to dominate the performance view.
   */
  const highVolumeWarehouses =
    warehouses.filter(
      (warehouse) =>
        warehouse.requested >= 20
    );

  const bestHighVolumeWarehouse =
    [...highVolumeWarehouses].sort(
      (a, b) =>
        b.fillRate - a.fillRate
    )[0];

  /*
   * ============================================
   * HIGH / LOW PERFORMANCE
   * ============================================
   */

  const rankedWarehouses = [
    ...warehouses,
  ].sort(
    (a, b) =>
      b.fillRate - a.fillRate
  );

  const topWarehouses =
    [...rankedWarehouses]
      .filter(
        (warehouse) =>
          warehouse.requested >= 20
      )
      .slice(0, 5);

  /*
   * Attention view:
   * prioritize low fill rate while
   * keeping meaningful demand volume.
   */
  const bottomWarehouses =
    [...warehouses]
      .filter(
        (warehouse) =>
          warehouse.requested >= 20
      )
      .sort((a, b) => {
        if (a.fillRate !== b.fillRate) {
          return a.fillRate - b.fillRate;
        }

        return b.unfilled - a.unfilled;
      })
      .slice(0, 5);

  /*
   * ============================================
   * WAREHOUSE × JOB
   * ============================================
   */

  const jobRows = warehouseJob
    .map((row) => {
      const warehouse =
        getValue(row, [
          "需求仓",
          "物理仓",
          "仓库",
        ]) || "未分类";

      const job =
        getValue(row, [
          "工种",
          "原始工种",
        ]) || "未分类";

      const requested = numberValue(
        getValue(row, [
          "需求人数",
          "供应商需派遣人数",
        ])
      );

      const filled = numberValue(
        getValue(row, [
          "已派遣人数",
          "供应商已派遣人数",
        ])
      );

      const unfilledFromSource =
        getValue(row, [
          "未派遣人数",
          "供应商未派遣人数",
        ]);

      const unfilled =
        unfilledFromSource !== ""
          ? numberValue(unfilledFromSource)
          : Math.max(
              requested - filled,
              0
            );

      const fillRate =
        requested > 0
          ? (filled / requested) * 100
          : 0;

      return {
        warehouse,
        job,
        requested,
        filled,
        unfilled,
        fillRate,
      };
    })
    .filter(
      (row) =>
        row.warehouse !== "未分类" &&
        row.job !== "未分类"
    )
    .sort((a, b) => {
      if (b.unfilled !== a.unfilled) {
        return b.unfilled - a.unfilled;
      }

      return b.requested - a.requested;
    });

  /*
   * ============================================
   * MAIN
   * ============================================
   */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />

      <main className="ml-[250px] min-h-screen">
        {/* HEADER */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">
                人力管理 Workforce Management
              </p>

              <h1 className="mt-0.5 text-xl font-bold tracking-tight">
                仓库分析 Warehouse Analysis
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

              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="mr-2 h-2 w-2 rounded-full bg-slate-400" />

                <span className="text-xs font-semibold text-slate-600">
                  已处理数据 Processed Data
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="px-5 py-7 md:px-8">
          {/* TITLE */}
          <div className="mb-7">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-500">
              仓库表现 Warehouse Performance
            </p>

            <h2 className="text-2xl font-bold tracking-tight">
              仓库需求达成 Warehouse Demand Fulfillment
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              对比各仓库的人力需求达成情况，找出未满足需求集中的地方。Compare labor demand fulfillment across warehouses
              and identify where unfilled demand is concentrated.
            </p>
          </div>

          {/* KPI */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                仓库 Warehouses
              </p>

              <p className="mt-3 text-3xl font-bold">
                {warehouses.length}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                有记录需求 With recorded demand
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                需求总数 Demand Requested
              </p>

              <p className="mt-3 text-3xl font-bold">
                {formatNumber(totalRequested)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                供应商调配总需求 Total supplier allocation demand
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                未满足需求 Unfilled Demand
              </p>

              <p className="mt-3 text-3xl font-bold text-rose-500">
                {formatNumber(totalUnfilled)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                待满足的调配需求 Outstanding allocation demand
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                总体达成率 Overall Fill Rate
              </p>

              <p className="mt-3 text-3xl font-bold text-indigo-600">
                {formatPercent(overallFillRate)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {formatNumber(totalFilled)}{" "}
                /{" "}
                {formatNumber(totalRequested)}
              </p>
            </div>
          </section>

          {/* MANAGEMENT SNAPSHOT */}
          <section className="mt-6">
            <div className="mb-4">
              <h3 className="font-bold">
                仓库管理快照 Warehouse Management Snapshot
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                来自当前调配数据的关键仓库信号。Key warehouse-level signals from the current
                allocation data.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Largest Demand */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    最大需求 Largest Demand
                  </p>

                  <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                    体量 VOLUME
                  </span>
                </div>

                {largestDemandWarehouse ? (
                  <>
                    <p className="mt-4 text-xl font-bold">
                      {largestDemandWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatNumber(largestDemandWarehouse.requested)}{" "}
                      需求 requested
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Largest Unfilled */}
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    最大未满足 Largest Unfilled
                  </p>

                  <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                    缺口 GAP
                  </span>
                </div>

                {largestUnfilledWarehouse ? (
                  <>
                    <p className="mt-4 text-xl font-bold">
                      {largestUnfilledWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm text-rose-500">
                      {formatNumber(largestUnfilledWarehouse.unfilled)}{" "}
                      未满足 unfilled
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Lowest Fill Rate */}
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    最低达成率 Lowest Fill Rate
                  </p>

                  <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                    风险 RISK
                  </span>
                </div>

                {lowestFillWarehouse ? (
                  <>
                    <p className="mt-4 text-xl font-bold">
                      {lowestFillWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm text-rose-500">
                      {formatPercent(lowestFillWarehouse.fillRate)}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    无法计算 Not calculable
                  </p>
                )}
              </div>

              {/* Best High Volume */}
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    高体量最佳 Best High-Volume
                  </p>

                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                    ≥20
                  </span>
                </div>

                {bestHighVolumeWarehouse ? (
                  <>
                    <p className="mt-4 text-xl font-bold">
                      {bestHighVolumeWarehouse.name}
                    </p>

                    <p className="mt-1 text-sm text-emerald-600">
                      {formatPercent(bestHighVolumeWarehouse.fillRate)}{" "}
                      达成率 fill rate
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    没有仓库达到阈值 No warehouse meets threshold
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* PERFORMANCE CARDS */}
          <section className="mt-7 grid gap-6 xl:grid-cols-2">
            {/* STRONGEST */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  最强仓库 Strongest Warehouses
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  需求至少20人的仓库中达成率最高的。Highest fill rates among warehouses with
                  at least 20 requested positions.
                </p>
              </div>

              <div className="p-6">
                {topWarehouses.length > 0 ? (
                  <div className="space-y-5">
                    {topWarehouses.map((warehouse, index) => (
                      <div key={warehouse.name}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600">
                              {index + 1}
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-700">
                                {warehouse.name}
                              </p>

                              <p className="text-[11px] text-slate-400">
                                {formatNumber(warehouse.filled)}{" "}
                                /{" "}
                                {formatNumber(warehouse.requested)}{" "}
                                已派遣 filled
                              </p>
                            </div>
                          </div>

                          <span className="text-sm font-bold text-emerald-600">
                            {formatPercent(warehouse.fillRate)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <MiniBar value={warehouse.fillRate} />

                          <span className="text-[11px] text-slate-400">
                            {formatNumber(warehouse.unfilled)}{" "}
                            未满足 unfilled
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    没有符合条件的仓库数据。No qualifying warehouse data.
                  </p>
                )}
              </div>
            </div>

            {/* ATTENTION */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h3 className="font-bold">
                  需要关注的仓库 Warehouses Requiring Attention
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  有一定需求体量的最低达成率。Lowest fill rates with meaningful demand
                  volume.
                </p>
              </div>

              <div className="p-6">
                {bottomWarehouses.length > 0 ? (
                  <div className="space-y-5">
                    {bottomWarehouses.map((warehouse) => (
                      <div key={warehouse.name}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-600">
                              !
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-700">
                                {warehouse.name}
                              </p>

                              <p className="text-[11px] text-slate-400">
                                {formatNumber(warehouse.unfilled)}{" "}
                                未满足 unfilled
                              </p>
                            </div>
                          </div>

                          <span className="text-sm font-bold text-rose-600">
                            {formatPercent(warehouse.fillRate)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <MiniBar
                            value={warehouse.fillRate}
                            type="danger"
                          />

                          <span className="text-[11px] text-slate-400">
                            {formatNumber(warehouse.requested)}{" "}
                            需求 requested
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    没有符合条件的仓库数据。No qualifying warehouse data.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* MAIN TABLE */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-bold">
                  仓库排名 Warehouse Ranking
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  仓库层面的需求达成与缺口。Warehouse-level demand fulfillment and
                  outstanding gaps.
                </p>
              </div>

              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                {warehouses.length} 个仓库 warehouses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      #
                    </th>

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      仓库 Warehouse
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      需求 Requested
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      已派遣 Filled
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      未派遣 Unfilled
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      调配次数 Allocations
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      达成率 Fill Rate
                    </th>

                    <th className="px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      状态 Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {warehouses.map((warehouse, index) => (
                    <tr
                      key={warehouse.name}
                      className="border-b border-slate-50 transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-indigo-400" />

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

                      <td className="px-6 py-4 text-right text-sm font-semibold text-rose-500">
                        {formatNumber(warehouse.unfilled)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatNumber(warehouse.allocations)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <MiniBar value={warehouse.fillRate} />

                          <span
                            className={`w-14 text-right text-sm font-bold ${
                              warehouse.fillRate >= 80
                                ? "text-emerald-600"
                                : warehouse.fillRate >= 60
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {formatPercent(warehouse.fillRate)}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge fillRate={warehouse.fillRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* LARGEST LABOR GAPS */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold">
                    各仓库工种最大人力缺口 Largest Labor Gaps by Warehouse & Job
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    按未满足需求排序，突出最大的运营缺口。Sorted by unfilled demand to highlight
                    the largest operational gaps.
                  </p>
                </div>

                <span className="hidden rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 sm:block">
                  未满足降序 Unfilled DESC
                </span>
              </div>
            </div>

            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      #
                    </th>

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      仓库 Warehouse
                    </th>

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      工种 Job
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      需求 Requested
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      已派遣 Filled
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      未派遣 Unfilled
                    </th>

                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      达成率 Fill Rate
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {jobRows.slice(0, 50).map((row, index) => (
                    <tr
                      key={`${row.warehouse}-${row.job}-${index}`}
                      className="border-b border-slate-50 hover:bg-slate-50"
                    >
                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">
                        {row.warehouse}
                      </td>

                      <td className="px-6 py-3.5 text-sm text-slate-500">
                        {row.job}
                      </td>

                      <td className="px-6 py-3.5 text-right text-sm text-slate-600">
                        {formatNumber(row.requested)}
                      </td>

                      <td className="px-6 py-3.5 text-right text-sm font-semibold text-emerald-600">
                        {formatNumber(row.filled)}
                      </td>

                      <td className="px-6 py-3.5 text-right text-sm font-bold text-rose-500">
                        {formatNumber(row.unfilled)}
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-3">
                          <MiniBar
                            value={row.fillRate}
                            type={row.fillRate < 60 ? "danger" : "normal"}
                          />

                          <span
                            className={`w-14 text-right text-sm font-bold ${
                              row.fillRate >= 80
                                ? "text-emerald-600"
                                : row.fillRate >= 60
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {row.requested > 0
                              ? formatPercent(row.fillRate)
                              : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {jobRows.length > 50 && (
              <div className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400">
                展示前50个人力缺口 · 共{jobRows.length}个仓库-工种组合 Showing top 50 labor gaps ·{" "}
                {jobRows.length} total warehouse-job combinations
              </div>
            )}
          </section>

          {/* DATA QUALITY NOTE */}
          <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">
                !
              </div>

              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  数据解读 Data Interpretation
                </h3>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-amber-800/80">
                  达成率 = 已派遣 ÷ 需求，基于供应商调配数据计算，不应解读为实际员工出勤或仓库在场人数。Fill Rate is calculated as filled ÷ requested
                  using supplier allocation data. It should
                  not be interpreted as actual employee
                  attendance or warehouse staffing on-site.
                </p>

                <p className="mt-2 text-xs leading-5 text-amber-800/80">
                  实际出勤和工时分析请看加班/考勤分析。For actual attendance and work-hour analysis,
                  refer to the OT / attendance analysis.
                </p>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <div className="pb-8 pt-7 text-center">
            <p className="text-[11px] text-slate-400">
              人力分析平台 · 仓库分析 Workforce Analytics Platform · Warehouse Analysis
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              达成率 = 已派遣 ÷ 需求 Fill Rate = Filled ÷ Requested
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
