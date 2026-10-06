import Link from "next/link";
import Sidebar from "@/components/Sidebar";

import {
  getDashboardData,
  type CsvRow,
} from "@/lib/data";

/* =========================================================
   Helpers
========================================================= */

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
}: {
  value: number;
}) {
  const width = Math.max(
    0,
    Math.min(100, value)
  );

  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all"
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function RateBadge({
  rate,
}: {
  rate: number;
}) {
  const style =
    rate >= 80
      ? "bg-emerald-50 text-emerald-700"
      : rate >= 60
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";

  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${style}`}
    >
      {formatPercent(rate)}
    </span>
  );
}

/* =========================================================
   Page
========================================================= */

export default function SupplierPage() {
  const {
    demand,
    allocation,
    supplierSummary,
    supplierWarehouse,
    supplierJob,
  } = getDashboardData();

  /* =======================================================
     Supplier Summary
  ======================================================= */

  const suppliers = supplierSummary
    .map((row) => {
      const name =
        getValue(row, [
          "供应商",
          "供应商名称",
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
      (supplier) =>
        supplier.name !== "未分类"
    )
    .sort(
      (a, b) =>
        b.fillRate - a.fillRate
    );

  /* =======================================================
     Overall Metrics
  ======================================================= */

  const totalRequested =
    suppliers.reduce(
      (sum, item) =>
        sum + item.requested,
      0
    );

  const totalFilled =
    suppliers.reduce(
      (sum, item) =>
        sum + item.filled,
      0
    );

  const totalUnfilled =
    suppliers.reduce(
      (sum, item) =>
        sum + item.unfilled,
      0
    );

  const totalAllocations =
    suppliers.reduce(
      (sum, item) =>
        sum + item.allocations,
      0
    );

  const overallFillRate =
    totalRequested > 0
      ? (totalFilled /
          totalRequested) *
        100
      : 0;

  const missingSupplier =
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
      : "统计周期不可用 Reporting period unavailable";

  /* =======================================================
     Supplier × Warehouse
  ======================================================= */

  const warehouseRows =
    supplierWarehouse
      .map((row) => {
        const supplier =
          getValue(row, [
            "供应商",
            "供应商名称",
          ]) || "未分类";

        const warehouse =
          getValue(row, [
            "需求仓",
            "物理仓",
            "仓库",
          ]) || "未分类";

        const requested =
          numberValue(
            getValue(row, [
              "需求人数",
              "供应商需派遣人数",
            ])
          );

        const filled =
          numberValue(
            getValue(row, [
              "已派遣人数",
              "供应商已派遣人数",
            ])
          );

        const rate =
          requested > 0
            ? (filled / requested) *
              100
            : 0;

        return {
          supplier,
          warehouse,
          requested,
          filled,
          rate,
        };
      })
      .filter(
        (row) =>
          row.supplier !==
            "未分类" &&
          row.warehouse !==
            "未分类"
      )
      .sort(
        (a, b) =>
          b.requested - a.requested
      );

  /* =======================================================
     Supplier × Job
  ======================================================= */

  const jobRows =
    supplierJob
      .map((row) => {
        const supplier =
          getValue(row, [
            "供应商",
            "供应商名称",
          ]) || "未分类";

        const job =
          getValue(row, [
            "工种",
            "原始工种",
          ]) || "未分类";

        const requested =
          numberValue(
            getValue(row, [
              "需求人数",
              "供应商需派遣人数",
            ])
          );

        const filled =
          numberValue(
            getValue(row, [
              "已派遣人数",
              "供应商已派遣人数",
            ])
          );

        const rate =
          requested > 0
            ? (filled / requested) *
              100
            : 0;

        return {
          supplier,
          job,
          requested,
          filled,
          rate,
        };
      })
      .filter(
        (row) =>
          row.supplier !==
            "未分类" &&
          row.job !== "未分类"
      )
      .sort(
        (a, b) =>
          b.requested - a.requested
      );

  /* =======================================================
     Management Insights
  ======================================================= */

  const strongestSupplier =
    suppliers[0] ?? null;

  const weakestSupplier =
    [...suppliers].sort(
      (a, b) =>
        a.fillRate - b.fillRate
    )[0] ?? null;

  const largestExposureSupplier =
    [...suppliers].sort(
      (a, b) =>
        b.unfilled - a.unfilled
    )[0] ?? null;

  const largestAllocationSupplier =
    [...suppliers].sort(
      (a, b) =>
        b.allocations -
        a.allocations
    )[0] ?? null;

  const supplierPerformance =
    suppliers.map(
      (supplier) => ({
        ...supplier,
        exposureRate:
          supplier.requested > 0
            ? (supplier.unfilled /
                supplier.requested) *
              100
            : 0,
      })
    );

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar />

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="lg:pl-[250px]">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-8">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-medium text-slate-400">
                人力管理 Workforce Management
              </p>

              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                供应商分析 Supplier Analysis
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

          {/* Intro */}

          <div className="mb-7">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">

              <div>

                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  供应商表现 Supplier Performance
                </h2>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  按调配量、达成表现和未满足敞口对比各人力供应商。Compare staffing suppliers by allocation volume,
                  fulfillment performance, and unfilled exposure.
                </p>

              </div>

              <Link
                href="/"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                ← 返回总览 Back to Overview
              </Link>

            </div>

          </div>

          {/* =================================================
              KPI CARDS
          ================================================= */}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            {/* Suppliers */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                供应商 Suppliers
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight">
                {suppliers.length}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                有供应商归属 With supplier attribution
              </p>

            </div>

            {/* Requested */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                需求 Requested
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight">
                {formatNumber(totalRequested)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                供应商调配需求 Supplier allocation demand
              </p>

            </div>

            {/* Filled */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                已派遣 Filled
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-600">
                {formatNumber(totalFilled)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                已成功调配 Successfully allocated
              </p>

            </div>

            {/* Fill Rate */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                总体达成率 Overall Fill Rate
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-indigo-600">
                {totalRequested > 0
                  ? formatPercent(overallFillRate)
                  : "—"}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {formatNumber(totalFilled)}{" "}
                /{" "}
                {formatNumber(totalRequested)}
              </p>

            </div>

          </section>

          {/* =================================================
              MANAGEMENT SNAPSHOT
          ================================================= */}

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            {/* Best */}

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">

              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                最高达成率 Strongest Fill Rate
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {strongestSupplier?.name || "—"}
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {strongestSupplier
                  ? formatPercent(strongestSupplier.fillRate)
                  : "—"}
              </p>

            </div>

            {/* Weakest */}

            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">

              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                最低达成率 Lowest Fill Rate
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {weakestSupplier?.name || "—"}
              </p>

              <p className="mt-1 text-2xl font-bold text-rose-600">
                {weakestSupplier
                  ? formatPercent(weakestSupplier.fillRate)
                  : "—"}
              </p>

            </div>

            {/* Largest Exposure */}

            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">

              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                最大未满足敞口 Largest Unfilled Exposure
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {largestExposureSupplier?.name || "—"}
              </p>

              <p className="mt-1 text-2xl font-bold text-amber-600">
                {largestExposureSupplier
                  ? formatNumber(largestExposureSupplier.unfilled)
                  : "—"}
              </p>

            </div>

            {/* Allocation Volume */}

            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">

              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                最高调配量 Highest Allocation Volume
              </p>

              <p className="mt-3 text-lg font-bold text-slate-900">
                {largestAllocationSupplier?.name || "—"}
              </p>

              <p className="mt-1 text-2xl font-bold text-violet-600">
                {largestAllocationSupplier
                  ? formatNumber(largestAllocationSupplier.allocations)
                  : "—"}
              </p>

            </div>

          </section>

          {/* =================================================
              RANKING
          ================================================= */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

              <div>

                <h3 className="font-bold text-slate-900">
                  供应商排名 Supplier Ranking
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  按计算得出的供应商达成率排名 Ranked by calculated supplier fill rate
                </p>

              </div>

              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                {suppliers.length} 家供应商 suppliers
              </span>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead>

                  <tr className="border-b border-slate-100">

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      #
                    </th>

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      供应商 Supplier
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

                  </tr>

                </thead>

                <tbody>

                  {supplierPerformance.map((supplier, index) => (

                    <tr
                      key={`${supplier.name}-${index}`}
                      className="border-b border-slate-50 transition hover:bg-slate-50"
                    >

                      <td className="px-6 py-4">

                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            index === 0
                              ? "bg-emerald-100 text-emerald-700"
                              : index === supplierPerformance.length - 1
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {index + 1}
                        </div>

                      </td>

                      <td className="px-6 py-4">

                        <div>

                          <p className="text-sm font-semibold text-slate-800">
                            {supplier.name}
                          </p>

                          <div className="mt-1.5">
                            <MiniBar value={supplier.fillRate} />
                          </div>

                        </div>

                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatNumber(supplier.requested)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">
                        {formatNumber(supplier.filled)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-rose-500">
                        {formatNumber(supplier.unfilled)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatNumber(supplier.allocations)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <RateBadge rate={supplier.fillRate} />
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              SUPPLIER × WAREHOUSE
          ================================================= */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

            <div className="border-b border-slate-100 px-6 py-5">

              <h3 className="font-bold text-slate-900">
                供应商 × 仓库 Supplier × Warehouse
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                看各供应商在哪些仓库表现更好或更差。Identify where each supplier performs better or worse.
              </p>

            </div>

            <div className="max-h-[520px] overflow-auto">

              <table className="w-full min-w-[850px]">

                <thead className="sticky top-0 bg-white">

                  <tr className="border-b border-slate-100">

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      供应商 Supplier
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
                      达成率 Fill Rate
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {warehouseRows.slice(0, 50).map((row, index) => {

                    const unfilled = Math.max(
                      row.requested - row.filled,
                      0
                    );

                    return (
                      <tr
                        key={`${row.supplier}-${row.warehouse}-${index}`}
                        className="border-b border-slate-50 hover:bg-slate-50"
                      >

                        <td className="px-6 py-3.5 text-sm font-medium text-slate-700">
                          {row.supplier}
                        </td>

                        <td className="px-6 py-3.5 text-sm text-slate-500">
                          {row.warehouse}
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm text-slate-600">
                          {formatNumber(row.requested)}
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm font-semibold text-emerald-600">
                          {formatNumber(row.filled)}
                        </td>

                        <td className="px-6 py-3.5 text-right text-sm font-semibold text-rose-500">
                          {formatNumber(unfilled)}
                        </td>

                        <td className="px-6 py-3.5 text-right">

                          <RateBadge rate={row.rate} />

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              SUPPLIER × JOB
          ================================================= */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">

            <div className="border-b border-slate-100 px-6 py-5">

              <h3 className="font-bold text-slate-900">
                供应商 × 工种 Supplier × Job
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                对比各供应商在不同工种上的表现。Compare supplier performance across labor types.
              </p>

            </div>

            <div className="max-h-[520px] overflow-auto">

              <table className="w-full min-w-[800px]">

                <thead className="sticky top-0 bg-white">

                  <tr className="border-b border-slate-100">

                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      供应商 Supplier
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

                  {jobRows.slice(0, 50).map((row, index) => {

                    const unfilled = Math.max(
                      row.requested - row.filled,
                      0
                    );

                    return (
                      <tr
                        key={`${row.supplier}-${row.job}-${index}`}
                        className="border-b border-slate-50 hover:bg-slate-50"
                      >

                        <td className="px-6 py-3.5 text-sm font-medium text-slate-700">
                          {row.supplier}
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

                        <td className="px-6 py-3.5 text-right text-sm font-semibold text-rose-500">
                          {formatNumber(unfilled)}
                        </td>

                        <td className="px-6 py-3.5 text-right">

                          <RateBadge rate={row.rate} />

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              DATA QUALITY
          ================================================= */}

          <section className="mt-6 mb-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

              <div className="flex items-start">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-600">
                  !
                </div>

                <div className="ml-4">

                  <h3 className="font-bold text-slate-800">
                    数据质量提醒 Data Quality Notice
                  </h3>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">

                    {formatNumber(missingSupplier)}{" "}
                    条供应商调配记录缺少供应商归属（
                    {formatNumber(missingSupplier)}{" "}
                    supplier allocation records do not have supplier
                    attribution）。这些记录单独保留，未归属到任何供应商（These
                    records are retained separately and are not assigned
                    to any supplier）。

                  </p>

                </div>

              </div>

              <Link
                href="/quality"
                className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-amber-700 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100"
              >
                查看数据质量 Review Data Quality →
              </Link>

            </div>

          </section>

          {/* Footer */}

          <div className="pb-8 text-center">

            <p className="text-[11px] text-slate-400">
              人力分析平台 · 供应商分析 Workforce Analytics Platform · Supplier Analysis
            </p>

            <p className="mt-1 text-[10px] text-slate-300">
              达成率 = 供应商已派遣 ÷ 供应商需求。Fill rate = supplier filled ÷ supplier requested.
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}
