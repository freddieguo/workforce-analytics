"use client";

import {
  useEffect,
  useState,
} from "react";

/* =========================================================
 * Funnel — 履约漏斗（SOP 口径）
 *
 * 主漏斗：需求 REQUESTED → 已派遣 DISPATCHED
 *          → 已到岗 ARRIVED → 已接受 ACCEPTED
 * 分支：未到岗 NO-SHOW（自已派遣）、退回 SENT BACK（自已到岗）
 *
 * 口径规则（SOP）：
 *  - 每个比率都展示分子、分母、公式
 *  - 分母为 0 显示 N/A，不编数字
 *  - 超发（已发单 > 需求）如实展示，不截断
 *  - 到岗来自考勤表（有数据时显示，无数据时如实显示"待数据"）；
 *    已接受用派遣状态"已确认"做代理口径；未到岗/退回仍待数据
 * ======================================================= */

export type FunnelDatum = {
  name: string;
  requested: number;
  filled: number;
};

export type ArrivalDatum = {
  name: string;
  count: number;
};

export type FunnelData = {
  requested: number;
  issued: number;
  /** 已派遣（发单详情口径，人次）。注意：需求池漏记，派遣表实有 2813 人，见 dispatchedPersons。 */
  dispatched: number;
  /** 已派遣人数（人头口径：派遣表去重）；没有数据时为 0 */
  dispatchedPersons: number;
  /** 到岗人数（全周期去重）；没有考勤数据时为 null */
  arrived: number | null;
  /** 到岗人次；没有考勤数据时为 null */
  arrivedEvents: number | null;
  /** 有工时人数；没有考勤数据时为 null */
  arrivedWithHours: number | null;
  /** 已接受人数 = 到岗且派遣状态已确认（去重）；没有数据时为 null */
  accepted: number | null;
  /** 试工不通过人数（去重）；没有派遣数据时为 null */
  trialFailed: number | null;
  /** 待确认人数（去重）；没有派遣数据时为 null */
  pendingConfirm: number | null;
  /** 未到岗待核实人数 = 派了但没打卡（去重）；没有数据时为 null */
  noShowPending: number | null;
  /** 到岗且试工不通过人数（去重）；没有数据时为 null */
  sentBack: number | null;
  topWarehouses: FunnelDatum[];
  topSuppliers: FunnelDatum[];
  /** 按到岗人次排的 Top 5 */
  topArrivalWarehouses: ArrivalDatum[];
  topArrivalSuppliers: ArrivalDatum[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(
    Math.round(value)
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

type StageId =
  | "requested"
  | "issued"
  | "dispatched"
  | "arrived"
  | "accepted";

const STAGE_META: Record<
  StageId,
  {
    zh: string;
    en: string;
    unit: string;
    plain: string;
  }
> = {
  requested: {
    zh: "需求",
    en: "REQUESTED",
    unit: "slots",
    plain:
      "仓库提的需求名额，一共要这么多人。",
  },
  issued: {
    zh: "已发单",
    en: "ISSUED",
    unit: "events",
    plain:
      "已经正式发给供应商的需求总量。",
  },
  dispatched: {
    zh: "已派遣",
    en: "DISPATCHED",
    unit: "events",
    plain: "供应商实际派出的人次（发单详情口径）。",
  },
  arrived: {
    zh: "应到岗",
    en: "ARRIVED",
    unit: "people",
    plain:
      "当天应该到岗的人（人员到岗表有 OTWS ID 的全量记录）。其中 No Show 没来，被退回的不合格，剩下的是已接受。",
  },
  accepted: {
    zh: "已接受",
    en: "ACCEPTED",
    unit: "people",
    plain:
      "应到岗 − No Show − 被退回，剩下的就是已接受（人次）。",
  },
};

export default function Funnel({
  data,
}: {
  data: FunnelData;
}) {
  const [selected, setSelected] =
    useState<StageId>("requested");
  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() =>
      setMounted(true)
    );
    return () =>
      cancelAnimationFrame(t);
  }, []);

  const {
    requested,
    issued,
    dispatched,
    dispatchedPersons,
    arrived,
    arrivedEvents,
    arrivedWithHours,
    accepted,
    trialFailed,
    pendingConfirm,
    noShowPending,
    sentBack,
  } = data;

  const stages: {
    id: StageId;
    value: number | null;
  }[] = [
    { id: "requested", value: requested },
    { id: "issued", value: issued },
    { id: "dispatched", value: dispatched },
    { id: "arrived", value: arrived },
    { id: "accepted", value: accepted },
  ];

  const tone: Record<
    StageId,
    string
  > = {
    requested:
      "from-slate-700 to-slate-900",
    issued:
      "from-indigo-600 to-indigo-700",
    dispatched:
      "from-teal-600 to-teal-700",
    arrived:
      "from-blue-600 to-blue-700",
    accepted:
      "from-emerald-600 to-emerald-700",
  };

  /* 每行底纹：极淡的阶段色，全幅无断边 */
  const wash: Record<
    StageId,
    string
  > = {
    requested:
      "linear-gradient(90deg, rgba(71,85,105,0.07), rgba(71,85,105,0.02))",
    issued:
      "linear-gradient(90deg, rgba(79,70,229,0.07), rgba(79,70,229,0.02))",
    dispatched:
      "linear-gradient(90deg, rgba(13,148,136,0.07), rgba(13,148,136,0.02))",
    arrived:
      "linear-gradient(90deg, rgba(37,99,235,0.07), rgba(37,99,235,0.02))",
    accepted:
      "linear-gradient(90deg, rgba(5,150,105,0.07), rgba(5,150,105,0.02))",
  };

  const detail = STAGE_META[selected];

  // 流失分析：各环节流失人数
  const lossIssued =
    requested !== null && issued !== null
      ? requested - issued
      : null;
  const lossDispatch =
    issued !== null && dispatched !== null
      ? issued - dispatched
      : null;
  const lossArrived =
    dispatched !== null && arrived !== null
      ? dispatched - arrived
      : null;
  const lossAccepted =
    arrived !== null && accepted !== null
      ? arrived - accepted
      : null;
  const losses = [
    {
      zh: "超发",
      en: "OVER ISSUED",
      value:
        lossIssued !== null
          ? -lossIssued
          : null,
      note: "已发单 − 需求",
      color: "from-violet-400 to-violet-500",
    },
    {
      zh: "未派遣",
      en: "UNDISPATCHED",
      value: lossDispatch,
      note: "已发单 − 已派遣",
      color: "from-slate-400 to-slate-500",
    },
    {
      zh: "到岗差异",
      en: "ARRIVAL GAP",
      value:
        lossArrived !== null
          ? -lossArrived
          : null,
      note: "到岗 − 已派遣（两份表口径不同）",
      color: "from-sky-400 to-sky-500",
    },
    {
      zh: "未接受",
      en: "NOT ACCEPTED",
      value: lossAccepted,
      note: "No Show 281 + 被退回 228",
      color: "from-amber-400 to-amber-500",
    },
  ].filter((l) => l.value !== null);
  const maxLoss = Math.max(
    1,
    ...losses.map((l) =>
      Math.abs(l.value as number)
    )
  );
  const totalLoss = losses
    .filter((l) => (l.value as number) > 0)
    .reduce(
      (s, l) => s + (l.value as number),
      0
    );

  const maxStage = Math.max(
    1,
    ...stages.map((s) => s.value ?? 0)
  );

  return (
    <div>
      {/* ============ 横向漏斗（从上到下） + 流失分析 ============ */}
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-2.5">
            {stages.map((stage) => {
              const meta =
                STAGE_META[stage.id];
              const isActive =
                selected === stage.id;
              const pending =
                stage.value === null;
              const pct = pending
                ? 0
                : Math.max(
                    4,
                    ((stage.value as number) /
                      maxStage) *
                      100
                  );
              return (
                <button
                  key={stage.id}
                  onClick={() =>
                    setSelected(stage.id)
                  }
                  className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 border border-slate-200/80 shadow-sm ${
                    isActive
                      ? "ring-4 ring-indigo-300 ring-offset-2"
                      : "hover:shadow-md"
                  } ${
                    pending
                      ? "border-dashed border-slate-300 bg-slate-50"
                      : "bg-white hover:-translate-y-0.5"
                  }`}
                  style={
                    pending
                      ? undefined
                      : {
                          background: wash[stage.id],
                        }
                  }
                >
                  <div className="relative w-36 shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      {meta.zh}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {meta.en}
                    </p>
                  </div>
                  <div className="relative h-10 flex-1 overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                    {!pending && (
                      <div
                        className={`flex h-full items-center justify-end rounded-xl bg-gradient-to-r pr-3 shadow-sm transition-all duration-1000 ${tone[stage.id]}`}
                        style={{
                          width: mounted
                            ? `${pct}%`
                            : "0%",
                        }}
                      >
                        <span className="text-sm font-bold tabular-nums text-white drop-shadow">
                          {formatNumber(
                            stage.value as number
                          )}
                        </span>
                      </div>
                    )}
                    {pending && (
                      <div className="flex h-full items-center px-4 text-sm font-semibold text-slate-400">
                        待数据 Pending
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ============ 分支：No Show / 被退回（左侧列下方） ============ */}
          <div className="mt-3 grid shrink-0 gap-3 md:grid-cols-2">
            {[
              {
                zh: "No Show",
                en: "NO-SHOW",
                value: noShowPending,
                plain:
                  "应到岗但没来的人。从应到岗分支出来，不算在已接受里。",
                pending: "需要到岗表核对 confirmed absent",
              },
              {
                zh: "被退回",
                en: "SENT BACK",
                value: sentBack,
                plain:
                  "来了但不符合要求被退回的人。从应到岗分支出来，不算在已接受里。明细去试工页看。",
                pending: "需要到岗表核对 documented reason",
              },
            ].map((b) => (
              <div
                key={b.en}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  b.value !== null
                    ? "border-orange-200 bg-orange-50/60"
                    : "border-dashed border-orange-200 bg-orange-50/60"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-base font-bold text-white">
                  {b.value !== null
                    ? formatNumber(b.value)
                    : "!"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-orange-900">
                    {b.zh} {b.en}
                    <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">
                      {b.value !== null
                        ? "待核实 Pending"
                        : "待数据 Pending"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-orange-800/70">
                    {b.plain}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ============ 流失分析（右侧等高） ============ */}
        <aside className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/80 to-indigo-50/40 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-100/50 blur-3xl" />

          <div className="relative flex items-baseline justify-between border-b border-slate-200/70 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              流失分析{" "}
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Loss Analysis
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              共流失{" "}
              <b className="text-sm text-slate-900 tabular-nums">
                {formatNumber(totalLoss)}
              </b>
            </p>
          </div>

          <div className="relative flex flex-1 flex-col justify-center gap-4 py-4">
            {losses.map((l) => {
              const v = l.value as number;
              const isGain = v < 0;
              const pct = mounted
                ? Math.min(
                    100,
                    (Math.abs(v) / maxLoss) * 100
                  )
                : 0;
              return (
                <div key={l.en}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {l.zh}{" "}
                      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        {l.en}
                      </span>
                    </span>
                    <b
                      className={`text-base tabular-nums ${
                        isGain
                          ? "text-emerald-600"
                          : "text-slate-900"
                      }`}
                    >
                      {isGain ? "+" : ""}
                      {formatNumber(v)}
                    </b>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200/60 shadow-inner">
                    <div
                      className={`relative h-full rounded-full bg-gradient-to-r shadow-sm transition-all duration-1000 ease-out ${
                        isGain
                          ? "from-emerald-400 to-teal-500"
                          : l.color
                      }`}
                      style={{ width: `${pct}%` }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/25" />
                    </div>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {l.note}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="relative flex gap-2.5 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-3.5 text-[11px] leading-5 text-amber-900 shadow-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white shadow">
              !
            </span>
            <p>
              <strong className="text-amber-800">
                关键洞察 Key Insight：
              </strong>
              最大流失在发单→派遣（
              {formatNumber(lossDispatch ?? 0)}
              人没派出去），其次是到岗→接受（
              {formatNumber(lossAccepted ?? 0)}
              人）。发单比需求多
              {formatNumber(
                Math.abs(lossIssued ?? 0)
              )}
              人（超发），到岗比已派遣多
              {formatNumber(
                Math.abs(lossArrived ?? 0)
              )}
              人，是两份表口径不同，不是算错。
            </p>
          </div>
        </aside>
      </div>

      {/* ============ 明细面板 ============ */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {detail.zh} {detail.en} · 明细
            Details
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {detail.plain}
          </p>
        </div>

        <div className="px-6 py-5">
          {selected === "requested" && (
            <div className="space-y-3">
              {data.topWarehouses.map(
                (w) => (
                  <div
                    key={w.name}
                    className="flex items-center gap-4"
                  >
                    <span className="w-36 shrink-0 truncate text-sm font-medium text-slate-700">
                      {w.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-slate-700 transition-all duration-700 ${
                          mounted
                            ? ""
                            : "w-0"
                        }`}
                        style={{
                          width: mounted
                            ? `${
                                (w.requested /
                                  Math.max(
                                    data
                                      .topWarehouses[0]
                                      .requested,
                                    1
                                  )) *
                                100
                              }%`
                            : "0%",
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                      {formatNumber(
                        w.requested
                      )}
                    </span>
                  </div>
                )
              )}
              <p className="pt-1 text-xs text-slate-400">
                需求最多的 5 个仓库 Top 5
                warehouses by requested
              </p>
            </div>
          )}

          {selected === "dispatched" && (
            <div className="space-y-3">
              {data.topSuppliers.map(
                (s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-4"
                  >
                    <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                      {s.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all duration-700"
                        style={{
                          width: mounted
                            ? `${
                                (s.filled /
                                  Math.max(
                                    data
                                      .topSuppliers[0]
                                      .filled,
                                    1
                                  )) *
                                100
                              }%`
                            : "0%",
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                      {formatNumber(
                        s.filled
                      )}
                    </span>
                  </div>
                )
              )}
              <p className="pt-1 text-xs text-slate-400">
                派出人数最多的 5 家供应商 Top
                5 suppliers by dispatched
              </p>
            </div>
          )}

          {selected === "arrived" &&
            arrived !== null && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-6 rounded-xl bg-blue-50 p-5">
                  <div>
                    <p className="text-xs text-slate-500">
                      应到岗 Scheduled
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(arrived)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      人员到岗表有 OTWS
                      ID 的全量记录（人次）。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      No Show 没来
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(
                        noShowPending ?? 0
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      应到岗但没来的人次。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      被退回 Sent back
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(
                        sentBack ?? 0
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      来了但不符合要求被退回的人次。
                    </p>
                  </div>
                </div>
                {data.topArrivalWarehouses
                  .length > 0 && (
                  <div className="space-y-3">
                    {data.topArrivalWarehouses.map(
                      (w) => (
                        <div
                          key={w.name}
                          className="flex items-center gap-4"
                        >
                          <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                            {w.name}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-700"
                              style={{
                                width: mounted
                                  ? `${
                                      (w.count /
                                        Math.max(
                                          data
                                            .topArrivalWarehouses[0]
                                            .count,
                                          1
                                        )) *
                                      100
                                    }%`
                                  : "0%",
                              }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                            {formatNumber(
                              w.count
                            )}
                          </span>
                        </div>
                      )
                    )}
                    <p className="pt-1 text-xs text-slate-400">
                      到岗人次最多的 5 个仓库 Top
                      5 warehouses by arrival
                      events
                    </p>
                  </div>
                )}
                {data.topArrivalSuppliers
                  .length > 0 && (
                  <div className="space-y-3">
                    {data.topArrivalSuppliers.map(
                      (s) => (
                        <div
                          key={s.name}
                          className="flex items-center gap-4"
                        >
                          <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                            {s.name}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-700"
                              style={{
                                width: mounted
                                  ? `${
                                      (s.count /
                                        Math.max(
                                          data
                                            .topArrivalSuppliers[0]
                                            .count,
                                          1
                                        )) *
                                      100
                                    }%`
                                  : "0%",
                              }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                            {formatNumber(
                              s.count
                            )}
                          </span>
                        </div>
                      )
                    )}
                    <p className="pt-1 text-xs text-slate-400">
                      到岗人次最多的 5 家供应商 Top
                      5 suppliers by arrival
                      events
                    </p>
                  </div>
                )}
              </div>
            )}

          {selected === "accepted" &&
            accepted !== null && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-6 rounded-xl bg-emerald-50 p-5">
                  <div>
                    <p className="text-xs text-slate-500">
                      已接受 Accepted
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(accepted)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      应到岗 − No Show −
                      被退回，剩下的人次。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      No Show 没来
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(
                        noShowPending ?? 0
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      应到岗但没来的人次。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      被退回 Sent back
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(
                        sentBack ?? 0
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      来了但不符合要求被退回的人次。
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  口径说明：人员到岗表口径，有 OTWS
                  ID 的算应到岗；No
                  Show 勾选的算没来，有不符合要求原因的算被退回。
                </p>
              </div>
            )}

          {(selected === "accepted" &&
            accepted === null) ||
          (selected === "arrived" &&
            arrived === null) ? (
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-700">
                为什么算不出来 Why unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {selected === "arrived"
                  ? "已到岗需要打卡、签到或经核实的到岗证据。当前考勤文件是空的，没有到岗证据就不能算——按 SOP，缺考勤只能记为待核实，不能当成未到岗。需要考勤数据 Need attendance records with arrival evidence."
                  : "已接受需要仓库的验收确认。打卡只能证明人来过、干过活，不能自动等于仓库接收。需要仓库验收记录 Need warehouse acceptance records."}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ============ SOP 比率卡片（人头口径，同一批人） ============ */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            zh: "派遣率",
            en: "Dispatch Rate",
            value:
              issued !== null &&
              issued > 0
                ? formatPercent(
                    (dispatched / issued) *
                      100
                  )
                : "N/A",
            formula:
              issued !== null
                ? `${formatNumber(
                    dispatched
                  )} ÷ ${formatNumber(
                    issued
                  )}`
                : "D ÷ I",
            plain:
              issued !== null && issued > 0
                ? `每 100 个已发单人次，约 ${Math.round(
                    (dispatched / issued) *
                      100
                  )} 人次实际派出。`
                : "待发单数据：分母需要发单详情。",
            ok:
              issued !== null &&
              issued > 0,
          },
          {
            zh: "接受率",
            en: "Acceptance Rate",
            value:
              accepted !== null &&
              arrived !== null &&
              arrived > 0
                ? formatPercent(
                    (accepted / arrived) *
                      100
                  )
                : "N/A",
            formula:
              accepted !== null &&
              arrived !== null
                ? `${formatNumber(
                    accepted
                  )} ÷ ${formatNumber(
                    arrived
                  )}`
                : "K ÷ A",
            plain:
              accepted !== null &&
              arrived !== null
                ? `每 100 个到岗的人，约 ${Math.round(
                    arrived > 0
                      ? (accepted / arrived) *
                          100
                      : 0
                  )} 人被接受。`
                : "待数据：分子需要已接受的人数。",
            ok:
              accepted !== null &&
              arrived !== null,
          },
          {
            zh: "实际达成率",
            en: "Actual Fulfillment",
            value:
              accepted !== null &&
              requested > 0
                ? formatPercent(
                    (accepted / requested) *
                      100
                  )
                : "N/A",
            formula:
              accepted !== null
                ? `${formatNumber(
                    accepted
                  )} ÷ ${formatNumber(
                    requested
                  )}`
                : "K ÷ R",
            plain:
              accepted !== null &&
              requested > 0
                ? `每 100 个需求名额，最终约 ${Math.round(
                    (accepted / requested) *
                      100
                  )} 人被接受上岗。`
                : "待数据：分子需要已接受的人数。",
            ok: accepted !== null,
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

      <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
        口径遵循：比率由分子分母加总计算，不对百分比取平均；超发不截断如实展示。
        Rates are aggregated from summed numerators and denominators,
        never averaged; over-issue shown
        as-is.
      </p>

    </div>
  );
}
