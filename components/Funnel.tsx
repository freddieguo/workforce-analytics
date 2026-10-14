"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
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
 *  - 发单差异（已发单 − 需求）如实展示，不截断
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
  /** 管理预警：未满足需求 = 需求 − 已接受 */
  unfilled?: number | null;
  /** 管理预警：达成率最低的仓库名 */
  lowestWarehouseName?: string | null;
  /** 管理预警：达成率最低的仓库达成率 */
  lowestWarehouseRate?: number | null;
  /** 管理预警：达成率最低的供应商名 */
  lowestSupplierName?: string | null;
  /** 管理预警：达成率最低的供应商达成率 */
  lowestSupplierRate?: number | null;
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
      "应到岗 − 没来 − 被退回，剩下的就是已接受（人次）。",
  },
};

export default function Funnel({
  data,
}: {
  data: FunnelData;
}) {
  const [selected, setSelected] =
    useState<StageId | null>(null);
  const [mounted, setMounted] =
    useState(false);
  const [alertsOpen, setAlertsOpen] =
    useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() =>
      setMounted(true)
    );
    return () =>
      cancelAnimationFrame(t);
  }, []);

  // 点外面自动收起管理预警
  useEffect(() => {
    if (!alertsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        alertsRef.current &&
        !alertsRef.current.contains(e.target as Node)
      ) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () =>
      document.removeEventListener("mousedown", handler);
  }, [alertsOpen]);

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
    unfilled,
    lowestWarehouseName,
    lowestWarehouseRate,
    lowestSupplierName,
    lowestSupplierRate,
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

  const detail = selected ? STAGE_META[selected] : null;

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
  // 流失分析口径（统一）：每一行 = 下一阶段 − 上一阶段。
  // 正数 = 多了（盈余），负数 = 少了（流失）。
  const losses = [
    {
      zh: "发单差异",
      en: "ISSUANCE GAP",
      value:
        lossIssued !== null
          ? -lossIssued
          : null,
      note: "已发单 − 需求",
      color: "from-violet-400 to-violet-500",
      isRealLoss: false,
      flow: "需求→发单",
    },
    {
      zh: "派遣差异",
      en: "DISPATCH GAP",
      value:
        lossDispatch !== null
          ? -lossDispatch
          : null,
      note: "已派遣 − 已发单",
      color: "from-slate-400 to-slate-500",
      isRealLoss: true,
      flow: "发单→派遣",
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
      isRealLoss: false,
      flow: "派遣→到岗",
    },
    {
      zh: "未接受",
      en: "NOT ACCEPTED",
      value:
        lossAccepted !== null
          ? -lossAccepted
          : null,
      note: "没来 + 被退回",
      color: "from-amber-400 to-amber-500",
      isRealLoss: true,
      flow: "到岗→接受",
    },
  ].filter((l) => l.value !== null);
  const maxLoss = Math.max(
    1,
    ...losses.map((l) =>
      Math.abs(l.value as number)
    )
  );
  // 共流失 = -(四项之和) = 需求 − 已接受：四项带符号加起来就是它。
  const totalLoss = -losses.reduce(
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
                    setSelected((cur) =>
                      cur === stage.id ? null : stage.id
                    )
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
                zh: "没来",
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
                  "来了但不符合要求被退回的人。从应到岗分支出来，不算在已接受里。明细去被退回页看。",
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
                    {b.value === null && (
                      <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">
                        待数据 Pending
                      </span>
                    )}
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
        <aside className="relative flex flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/80 to-indigo-50/40 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-100/50 blur-3xl" />
          </div>

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
              const isGain = v > 0;
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

          {/* ============ 管理预警（点展开在下面展开一个面板） ============ */}
          <div ref={alertsRef} className="relative z-10 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <button
              type="button"
              onClick={() => setAlertsOpen((v) => !v)}
              className="flex w-full items-start justify-between text-left"
            >
              <span className="flex items-start gap-2">
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60"></span>
                  <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-600">
                    !
                  </span>
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-900">
                    管理预警
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Management Alerts
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {alertsOpen ? "收起 ▲" : "展开 ▼"}
              </span>
            </button>
            <p className="mt-1 text-[11px] text-slate-400">
              需要运营关注的事项 Areas for review
            </p>
            {alertsOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                {unfilled !== null && unfilled !== undefined && (
                  <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-4">
                    <p className="text-xs font-semibold text-slate-800">
                      未满足需求 Unfilled Demand
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      仍有 {formatNumber(unfilled)} 个岗位未被满足。
                    </p>
                  </div>
                )}
                {arrived !== null && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-xs font-semibold text-slate-800">
                      到岗情况 Arrival Status
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      应到岗 {formatNumber(arrived)} 人，实际到场{" "}
                      <span className="font-semibold text-blue-700">
                        {formatNumber(arrived - (noShowPending ?? 0))}
                      </span>{" "}
                      人（到场率{" "}
                      <span className="font-semibold text-blue-700">
                        {formatPercent(
                          arrived > 0
                            ? ((arrived - (noShowPending ?? 0)) /
                                arrived) *
                                100
                            : 0
                        )}
                      </span>
                      ），没来{" "}
                      <span className="font-semibold text-orange-700">
                        {formatNumber(noShowPending ?? 0)}
                      </span>{" "}
                      人（No Show 率{" "}
                      <span className="font-semibold text-orange-700">
                        {formatPercent(
                          arrived > 0
                            ? ((noShowPending ?? 0) / arrived) * 100
                            : 0
                        )}
                      </span>
                      ）。
                    </p>
                  </div>
                )}
                {lowestWarehouseName && (
                  <Link
                    href="/warehouse"
                    className="block rounded-lg border border-amber-100 bg-amber-50/60 p-4 transition hover:bg-amber-50"
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      仓库达成情况 Warehouse Fulfillment
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {lowestWarehouseName} 达成率最低，为{" "}
                      <span className="font-semibold text-amber-700">
                        {formatPercent(lowestWarehouseRate ?? 0)}
                      </span>
                      。
                    </p>
                  </Link>
                )}
                {lowestSupplierName && (
                  <Link
                    href="/supplier"
                    className="block rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      供应商表现 Supplier Performance
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {lowestSupplierName} 供应商达成率最低，为{" "}
                      <span className="font-semibold text-slate-700">
                        {formatPercent(lowestSupplierRate ?? 0)}
                      </span>
                      。
                    </p>
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ============ 明细 Flyover（点阶段在旁边浮出，不在下面显示；点遮罩或 × 关闭） ============ */}
      {selected !== null && detail !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full flex-col bg-white shadow-xl"
            style={{ width: "420px", maxWidth: "92vw" }}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {detail.zh} {detail.en} · 明细 Details
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {detail.plain}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-4 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {selected === "requested" && (
                <div className="space-y-3">
                  {data.topWarehouses.map((w) => (
                    <div key={w.name} className="flex items-center gap-4">
                      <span className="w-36 shrink-0 truncate text-sm font-medium text-slate-700">
                        {w.name}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-700 transition-all duration-700"
                          style={{
                            width: mounted
                              ? `${(w.requested / Math.max(data.topWarehouses[0].requested, 1)) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                        {formatNumber(w.requested)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-slate-400">
                    需求最多的 5 个仓库 Top 5 warehouses by requested
                  </p>
                </div>
              )}
              {selected === "issued" && (
                <div className="rounded-xl bg-slate-50 p-5">
                  <p className="text-sm leading-6 text-slate-500">
                    {issued > requested
                      ? `已发单比需求多一点，是怕供应商派不够人，先多发一点留余量。已发单 ${formatNumber(issued)}，比需求多 ${formatNumber(issued - requested)}。`
                      : issued === requested
                        ? `已发单和需求一样多，刚好发够。已发单 ${formatNumber(issued)}。`
                        : `已发单比需求少 ${formatNumber(requested - issued)}，需求没发完。已发单 ${formatNumber(issued)}，需求 ${formatNumber(requested)}。`}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {issued > requested
                      ? "Issued is a bit more than requested — a buffer in case suppliers don’t dispatch enough."
                      : issued === requested
                        ? "Issued equals requested — exactly enough."
                        : "Issued is less than requested — not all demand was issued."}
                  </p>
                </div>
              )}
              {selected === "dispatched" && (
                <div className="space-y-3">
                  {data.topSuppliers.map((s) => (
                    <div key={s.name} className="flex items-center gap-4">
                      <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                        {s.name}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600 transition-all duration-700"
                          style={{
                            width: mounted
                              ? `${(s.filled / Math.max(data.topSuppliers[0].filled, 1)) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                        {formatNumber(s.filled)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-slate-400">
                    派出人数最多的 5 家供应商 Top 5 suppliers by dispatched
                  </p>
                </div>
              )}
              {selected === "arrived" && arrived !== null && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-6 rounded-xl bg-blue-50 p-5">
                    <div>
                      <p className="text-xs text-slate-500">应到岗 Scheduled</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(arrived)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        人员到岗表有 OTWS ID 的全量记录（人次）。
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">没来 No Show</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(noShowPending ?? 0)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        应到岗但没来的人次。
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">被退回 Sent back</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(sentBack ?? 0)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        来了但不符合要求被退回的人次。
                      </p>
                    </div>
                  </div>
                  {data.topArrivalWarehouses.length > 0 && (
                    <div className="space-y-3">
                      {data.topArrivalWarehouses.map((w) => (
                        <div key={w.name} className="flex items-center gap-4">
                          <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                            {w.name}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-700"
                              style={{
                                width: mounted
                                  ? `${(w.count / Math.max(data.topArrivalWarehouses[0].count, 1)) * 100}%`
                                  : "0%",
                              }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                            {formatNumber(w.count)}
                          </span>
                        </div>
                      ))}
                      <p className="pt-1 text-xs text-slate-400">
                        到岗人次最多的 5 个仓库 Top 5 warehouses by arrival events
                      </p>
                    </div>
                  )}
                  {data.topArrivalSuppliers.length > 0 && (
                    <div className="space-y-3">
                      {data.topArrivalSuppliers.map((s) => (
                        <div key={s.name} className="flex items-center gap-4">
                          <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-700">
                            {s.name}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-700"
                              style={{
                                width: mounted
                                  ? `${(s.count / Math.max(data.topArrivalSuppliers[0].count, 1)) * 100}%`
                                  : "0%",
                              }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                            {formatNumber(s.count)}
                          </span>
                        </div>
                      ))}
                      <p className="pt-1 text-xs text-slate-400">
                        到岗人次最多的 5 家供应商 Top 5 suppliers by arrival events
                      </p>
                    </div>
                  )}
                </div>
              )}
              {selected === "accepted" && accepted !== null && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-6 rounded-xl bg-emerald-50 p-5">
                    <div>
                      <p className="text-xs text-slate-500">已接受 Accepted</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(accepted)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        应到岗 − No Show − 被退回，剩下的人次。
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">没来 No Show</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(noShowPending ?? 0)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        应到岗但没来的人次。
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">被退回 Sent back</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {formatNumber(sentBack ?? 0)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        来了但不符合要求被退回的人次。
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    口径说明：人员到岗表口径，有 OTWS ID 的算应到岗；No Show 勾选的算没来，有不符合要求原因的算被退回。
                  </p>
                </div>
              )}
              {((selected === "accepted" && accepted === null) ||
                (selected === "arrived" && arrived === null)) && (
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
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
