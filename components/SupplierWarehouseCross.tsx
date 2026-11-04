"use client";

import { useEffect, useMemo, useState } from "react";

export type PairRow = {
  supplier: string;
  warehouse: string;
  requested: number;
  filled: number;
  unfilled: number;
  dispatchRate: number;
  actualArrived: number | null;
  arrivalRate: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
  noshow: number;
  sentBack: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
/* 达成率三色（内联 hex，不用 Tailwind 颜色 class — 用户本地不生成新 class 的老毛病）：
   绿 ≥60% · 黄 40–60% · 红 <40%，与明细表小 bar 同一套 */
function rateHex(fr: number) {
  if (fr >= 60) return "#10b981";
  if (fr >= 40) return "#f59e0b";
  return "#f43f5e";
}
function rateTextHex(fr: number) {
  if (fr >= 60) return "#059669";
  if (fr >= 40) return "#d97706";
  return "#e11d48";
}
/* 渐变色对（from → to），给达成率胶囊和 bar 用，跟三色同一套分档 */
function rateGradient(fr: number): [string, string] {
  if (fr >= 60) return ["#34d399", "#059669"];
  if (fr >= 40) return ["#fbbf24", "#d97706"];
  return ["#fb7185", "#e11d48"];
}
function rateChipGradient(fr: number): { background: string; color: string; shadow: string } {
  const [from, to] = rateGradient(fr);
  return {
    background: `linear-gradient(135deg, ${from}, ${to})`,
    color: fr >= 40 && fr < 60 ? "#451a03" : "#ffffff",
    shadow: `0 3px 8px -3px ${to}99`,
  };
}

export type DailyPoint = { date: string; requested: number; accepted: number };

function shortWarehouse(name: string) {
  return name.replace(/^洛杉矶/, "");
}

/* 把一串数字算成 sparkline 的折线/面积路径（纯几何，无第三方库） */
function sparkPath(values: number[], w: number, h: number, pad = 3) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map(
    (v, i) =>
      [pad + step * i, h - pad - ((v - min) / ((max - min) || 1)) * (h - pad * 2)] as const
  );
  const line = pts.map((pt) => pt[0].toFixed(1) + "," + pt[1].toFixed(1)).join(" ");
  const area = `${pad},${h - pad} ` + line + ` ${w - pad},${h - pad}`;
  return { line, area, last: pts[pts.length - 1] };
}

/* 会自己长出来的 bar：挂载时从 0 拉到目标长度（切换仓库、榜单出现时都会动一次）。
   宽度/高度/颜色全内联，不依赖 Tailwind 生成。 */
function AnimatedBar({ pct, from, to, delay = 0 }: { pct: number; from: string; to: string; delay?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span style={{ display: "block", marginTop: 6, height: 6, borderRadius: 9999, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
      <span
        style={{
          display: "block",
          height: "100%",
          borderRadius: 9999,
          width: Math.min(Math.max(pct, 0), 100) + "%",
          background: `linear-gradient(90deg, ${from}, ${to})`,
          transform: on ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left center",
          transition: `transform .8s cubic-bezier(.22,1,.36,1) ${delay}ms`,
        }}
      />
    </span>
  );
}

/* 动画、悬停、分栏布局写成普通 CSS 放在组件里：不走 Tailwind，本地没生成 class 也照样生效 */
const SWX_CSS = `
@keyframes swxFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes swxExpand { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes swxPanelIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
.swx-fade-up { animation: swxFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
.swx-expand { animation: swxExpand .38s cubic-bezier(.22,1,.36,1) both; }
.swx-panel-in { animation: swxPanelIn .4s cubic-bezier(.22,1,.36,1) both; }
.swx-split { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 1024px) { .swx-split { grid-template-columns: 330px 1fr; } }
.swx-list { max-height: 300px; overflow-y: auto; padding: 4px 6px 4px 4px; }
@media (min-width: 1024px) { .swx-list { max-height: 668px; } }
.swx-wh { transition: box-shadow .22s ease, transform .22s ease, background .22s ease; }
.swx-wh:hover { transform: translateX(3px); box-shadow: 0 10px 24px -12px rgba(15,23,42,.25); }
.swx-row { transition: box-shadow .2s ease, transform .2s ease; }
.swx-row:hover { transform: translateX(3px); }
.swx-listrow { transition: background-color .2s ease, transform .2s ease; border-radius: 12px; padding: 6px 8px; margin-left: -8px; margin-right: -8px; }
.swx-listrow:hover { background-color: rgba(255,255,255,.8); transform: translateX(3px); }
.swx-summary { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 768px) { .swx-summary { grid-template-columns: repeat(3, 1fr); } }
@keyframes swxGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.swx-bar { transform-box: fill-box; transform-origin: bottom; animation: swxGrow .7s cubic-bezier(.22,1,.36,1) both; }
@keyframes swxDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.swx-line { stroke-dasharray: 1; animation: swxDraw 1.1s .25s ease both; }
.swx-summary-card { transition: box-shadow .25s ease, transform .25s ease; }
.swx-summary-card:hover { box-shadow: 0 14px 34px -14px rgba(15,23,42,.22); transform: translateY(-1px); }
`;

export default function SupplierWarehouseCross({
  pairs = [],
  dailyByWarehouse = {},
}: {
  pairs: PairRow[];
  dailyByWarehouse?: Record<string, DailyPoint[]>;
}) {
  /* 量大线：与散点图竖虚线同一算法 — 最大发单量 × 50%（最佳/危险榜的进榜门槛） */
  const maxPair = useMemo(
    () => Math.max(1, ...pairs.map((p) => p.requested)),
    [pairs]
  );
  const bigLine = maxPair * 0.5;
  const isBig = (p: PairRow) => p.requested >= bigLine;

  /* 按仓分组：列表按该仓总发单从多到少排，仓内供应商按达成率从高到低排 */
  type WarehouseGroup = {
    warehouse: string;
    totalRequested: number;
    totalAccepted: number;
    rate: number | null;
    rows: PairRow[];
  };
  const groups = useMemo<WarehouseGroup[]>(() => {
    const m = new Map<string, PairRow[]>();
    for (const p of pairs) {
      if (!m.has(p.warehouse)) m.set(p.warehouse, []);
      m.get(p.warehouse)!.push(p);
    }
    const out: WarehouseGroup[] = [...m.entries()].map(([warehouse, rows]) => {
      const sorted = [...rows].sort(
        (a, b) =>
          (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1) ||
          b.requested - a.requested
      );
      const totalRequested = rows.reduce((s, r) => s + r.requested, 0);
      const totalAccepted = rows.reduce((s, r) => s + (r.accepted ?? 0), 0);
      return {
        warehouse,
        totalRequested,
        totalAccepted,
        rate: totalRequested > 0 ? (totalAccepted / totalRequested) * 100 : null,
        rows: sorted,
      };
    });
    return out.sort((a, b) => b.totalRequested - a.totalRequested);
  }, [pairs]);

  /* 榜单：不分象限，就排名（用户 2026-10-21 定）— 量大的搭配按达成率排，
     最高的前五进最佳榜、最低的前五进危险榜，各写满五条（量大搭配不足五条时有几条写几条） */
  const withRate = useMemo(
    () => pairs.filter((p) => p.requested > 0 && p.fulfillmentRate !== null),
    [pairs]
  );
  const best = useMemo(
    () =>
      withRate
        .filter((p) => isBig(p))
        .sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1) || b.requested - a.requested)
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [withRate, bigLine]
  );
  const risky = useMemo(
    () =>
      withRate
        .filter((p) => isBig(p))
        .sort((a, b) => (a.fulfillmentRate ?? 999) - (b.fulfillmentRate ?? 999) || b.requested - a.requested)
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [withRate, bigLine]
  );

  const lookup = useMemo(() => {
    const m = new Map<string, PairRow>();
    for (const p of pairs) m.set(p.supplier + "|" + p.warehouse, p);
    return m;
  }, [pairs]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = selectedKey ? lookup.get(selectedKey) : undefined;

  /* 搜索 + 排序：搜得到仓名，也搜得到供应商名（那家在哪个仓出现，那个仓就留在列表里） */
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"volume" | "rateAsc">("volume");
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    let gs = groups;
    if (q) {
      gs = gs.filter(
        (g) =>
          g.warehouse.toLowerCase().includes(q) ||
          g.rows.some((r) => r.supplier.toLowerCase().includes(q))
      );
    }
    if (sortMode === "rateAsc") {
      gs = [...gs].sort((a, b) => (a.rate ?? 999) - (b.rate ?? 999));
    }
    return gs;
  }, [groups, query, sortMode]);

  /* 左右分栏的选中仓：默认选第一个（发单最多），被搜索过滤掉时自动落到第一个看得见的仓 */
  const [selWh, setSelWh] = useState<string | undefined>(undefined);
  const current =
    visibleGroups.find((g) => g.warehouse === selWh) ?? visibleGroups[0] ?? null;

  /* 点榜单任意一条：清掉搜索、切到它所在的仓、平滑滚回分栏区并高亮那一行 */
  const jumpTo = (supplier: string, warehouse: string) => {
    setQuery("");
    setSelectedKey(supplier + "|" + warehouse);
    setSelWh(warehouse);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .getElementById("swx-split")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  };

  /* 汇报摘要：整体达成率 / 总缺口 / 最需要关注的仓（口径就是交叉区自己的搭配汇总） */
  const sumRequested = pairs.reduce((t, x) => t + x.requested, 0);
  const sumAccepted = pairs.reduce((t, x) => t + (x.accepted ?? 0), 0);
  const overallRate = sumRequested > 0 ? (sumAccepted / sumRequested) * 100 : null;
  const totalGap = Math.max(sumRequested - sumAccepted, 0);
  const worstPool = groups.filter((g) => g.rate !== null && g.totalRequested >= bigLine);
  const worst =
    [...(worstPool.length > 0 ? worstPool : groups.filter((g) => g.rate !== null))].sort(
      (a, b) =>
        (a.rate ?? 999) - (b.rate ?? 999) ||
        b.totalRequested - b.totalAccepted - (a.totalRequested - a.totalAccepted)
    )[0] ?? null;

  /* 每日走势：把各仓的按天数据按日期合起来（全区一条线）；选中仓自己的小折线另取 */
  const sectionDaily = useMemo<DailyPoint[]>(() => {
    const m = new Map<string, DailyPoint>();
    for (const pts of Object.values(dailyByWarehouse)) {
      for (const pt of pts) {
        const a = m.get(pt.date) ?? { date: pt.date, requested: 0, accepted: 0 };
        a.requested += pt.requested;
        a.accepted += pt.accepted;
        m.set(pt.date, a);
      }
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyByWarehouse]);
  const curDaily = current ? dailyByWarehouse[current.warehouse] ?? [] : [];

  /* 走势图几何：viewBox 640×176，柱按已接受人数、线按当天达成率（0–100 同高） */
  const TW = 640, TH = 176, TPad = 12, BPad = 20, LRPad = 8;
  const plotW = TW - LRPad * 2, plotH = TH - TPad - BPad;
  const maxAcc = Math.max(1, ...sectionDaily.map((d) => d.accepted));
  const stepX = sectionDaily.length > 0 ? plotW / sectionDaily.length : plotW;
  const barW = Math.max(2, stepX * 0.55);
  const rateOf = (d: DailyPoint) => (d.requested > 0 ? (d.accepted / d.requested) * 100 : null);
  const linePtArr = sectionDaily
    .map((d, i) => {
      const r = rateOf(d);
      if (r === null) return null;
      return [LRPad + stepX * i + stepX / 2, TPad + plotH * (1 - r / 100)] as [number, number];
    })
    .filter((x): x is [number, number] => x !== null);
  const linePts =
    linePtArr.length >= 2
      ? "M " + linePtArr.map((pt) => pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" L ")
      : "";
  const curSpark =
    curDaily.length >= 2 ? sparkPath(curDaily.map((d) => d.accepted), 560, 44, 16) : null;

  if (pairs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-500">
        这一块要等新管线跑完才有数：先覆盖 <span className="font-semibold text-slate-700">scripts/datasets.py</span>、
        给 <span className="font-semibold text-slate-700">lib/data.ts</span> 加交叉数据集那两行，再跑一次{" "}
        <span className="font-semibold text-slate-700">python3 scripts/run_all.py</span>。
        交叉数据出来之后，这里会自动显示哪个供应商在哪个仓库做得好，不用再改页面。
      </div>
    );
  }

  const sortBtn = (mode: "volume" | "rateAsc", label: string) => (
    <button
      key={mode}
      type="button"
      onClick={() => setSortMode(mode)}
      className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
      style={
        sortMode === mode
          ? { background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#ffffff", boxShadow: "0 6px 16px -6px #4f46e5" }
          : { backgroundColor: "#ffffff", color: "#475569", boxShadow: "0 0 0 1px #e2e8f0" }
      }
    >
      {label}
    </button>
  );

  const [curFrom, curTo] = current?.rate != null ? rateGradient(current.rate) : ["#cbd5e1", "#94a3b8"];

  return (
    <div>
      <style>{SWX_CSS}</style>
      {/* 汇报摘要：给领导看的三个数 — 整体多少、差多少、问题在哪个仓 */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">
          汇报摘要 Summary
        </p>
        <p className="text-[11px] text-slate-400">下面所有搭配合起来的账</p>
      </div>
      <div className="swx-summary mt-2">
        <div className="swx-summary-card swx-fade-up rounded-2xl border border-slate-200 bg-white px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.06)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">整体达成率 Overall Rate</p>
          <p
            className="mt-1 font-extrabold tabular-nums leading-none"
            style={{
              fontSize: 32,
              backgroundImage: `linear-gradient(135deg, ${rateGradient(overallRate ?? 0)[0]}, ${rateGradient(overallRate ?? 0)[1]})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {overallRate !== null ? formatPercent(overallRate) : "—"}
          </p>
          <p className="mt-1.5 text-xs tabular-nums text-slate-400">
            已接受 {formatNumber(sumAccepted)} ÷ 已发单 {formatNumber(sumRequested)} 人次
          </p>
        </div>
        <div className="swx-summary-card swx-fade-up rounded-2xl border border-slate-200 bg-white px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.06)", animationDelay: "60ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">总缺口 Total Gap</p>
          <p
            className="mt-1 font-extrabold tabular-nums leading-none"
            style={{
              fontSize: 32,
              backgroundImage: "linear-gradient(135deg, #fb7185, #e11d48)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {formatNumber(totalGap)} <span style={{ fontSize: 15 }}>人次</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-400">发了单但最后没被接受的人次，一共差这么多</p>
        </div>
        {worst ? (
          <button
            type="button"
            onClick={() => jumpTo("", worst.warehouse)}
            className="swx-summary-card swx-fade-up rounded-2xl border border-rose-100 px-5 py-4 text-left"
            style={{ background: "linear-gradient(135deg, #fff1f2, #ffffff)", boxShadow: "0 1px 3px rgba(15,23,42,.06)", animationDelay: "120ms" }}
            title="点一下切到这个仓"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-400">最需要关注 Needs Attention</p>
            <p className="mt-1 truncate text-lg font-extrabold leading-tight text-slate-800" title={worst.warehouse}>
              {worst.warehouse}
            </p>
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              达成率 <span className="font-bold" style={{ color: rateTextHex(worst.rate ?? 0) }}>{worst.rate !== null ? formatPercent(worst.rate) : "—"}</span>
              {" "}· 还差 {formatNumber(worst.totalRequested - worst.totalAccepted)} 人 · 点我切过去 →
            </p>
          </button>
        ) : (
          <div className="swx-summary-card swx-fade-up rounded-2xl border border-slate-200 bg-white px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.06)", animationDelay: "120ms" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">最需要关注 Needs Attention</p>
            <p className="mt-2 text-sm text-slate-400">暂时没有</p>
          </div>
        )}
      </div>

      {/* 每日走势：柱=每天已接受人数（会一根根长出来），线=当天达成率（自己描出来） */}
      {sectionDaily.length >= 2 && (
        <div className="swx-fade-up mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.06)", animationDelay: "80ms" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">每日走势 Daily Trend</p>
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold text-indigo-500">■</span> 柱 = 已接受人数{" "}
              <span className="ml-2 font-semibold text-amber-500">—</span> 线 = 当天达成率 · 鼠标停在柱子上看当天明细
            </p>
          </div>
          <svg viewBox={`0 0 ${TW} ${TH}`} className="mt-2 w-full" role="img" aria-label="每日已接受人数与达成率走势">
            <defs>
              <linearGradient id="swxBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            {sectionDaily.map((d, i) => {
              const x = LRPad + stepX * i + (stepX - barW) / 2;
              const bh = (d.accepted / maxAcc) * plotH;
              const y = TPad + plotH - bh;
              const r = rateOf(d);
              return (
                <rect
                  key={"bar-" + d.date}
                  className="swx-bar"
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(bh, 1)}
                  rx={Math.min(3, barW / 2)}
                  fill="url(#swxBarGrad)"
                  style={{ animationDelay: Math.min(i, 40) * 25 + "ms" }}
                >
                  <title>{`${d.date}：已接受 ${formatNumber(d.accepted)} 人 · 发单 ${formatNumber(d.requested)} 人 · 达成率 ${r !== null ? formatPercent(r) : "—"}`}</title>
                </rect>
              );
            })}
            {linePts && (
              <path d={linePts} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="swx-line" vectorEffect="non-scaling-stroke" />
            )}
            {sectionDaily.map((d, i) => {
              const r = rateOf(d);
              if (r === null) return null;
              const x = LRPad + stepX * i + stepX / 2;
              const y = TPad + plotH * (1 - r / 100);
              return <circle key={"dot-" + d.date} cx={x} cy={y} r={2.6} fill="#ffffff" stroke="#d97706" strokeWidth={1.6} className="swx-fade-up" style={{ animationDelay: 300 + Math.min(i, 40) * 25 + "ms" }} />;
            })}
            {[...new Set([0, Math.floor((sectionDaily.length - 1) / 2), sectionDaily.length - 1])].map((idx) => {
              const d = sectionDaily[idx];
              if (!d) return null;
              const x = LRPad + stepX * idx + stepX / 2;
              return (
                <text key={"lbl-" + d.date} x={x} y={TH - 4} fontSize={10} fill="#94a3b8" textAnchor="middle">
                  {d.date.slice(5)}
                </text>
              );
            })}
          </svg>
        </div>
      )}
      {sectionDaily.length === 1 && (
        <p className="mt-3 text-xs text-slate-400">所选范围只有一天，看不出走势 — 把日期范围拉长一点，走势图就出来了。</p>
      )}

      <p className="text-xs leading-5 text-slate-400">
        左边点一个仓，右边马上看这个仓里每家供应商排第几 — 供应商按达成率从高到低排，排在最上面的那家就是这个仓做得最好的。
        条按达成率画，颜色跟其他页一样：绿 ≥ 60% · 黄 40–60% · 红 &lt; 40%。
        达成率超过 100% 是这个搭配到岗的人比发单记的还多，如实写、条最多画到满格。
        下面的最佳/危险榜点任意一条，会自动切到它所在的仓。
      </p>

      {/* 工具条：搜索 + 排序 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 搜仓库 / 供应商 Search"
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300"
          style={{ width: 230, maxWidth: "100%" }}
        />
        {sortBtn("volume", "发单最多 Most Orders")}
        {sortBtn("rateAsc", "达成率最低 Lowest Rate")}
        <span className="ml-auto text-xs tabular-nums text-slate-400">
          共 {visibleGroups.length} 个仓 · {pairs.length} 个搭配
        </span>
      </div>

      {/* 左右分栏：左=仓库索引列（点选），右=选中仓的供应商排名（切换时整块滑入、条重新生长） */}
      {visibleGroups.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-500">
          没找到和「{query}」对得上的仓或供应商，换个词试试，或者把搜索框清空。
        </p>
      ) : (
        <div id="swx-split" className="swx-split mt-4">
          {/* 左列：仓库索引 */}
          <div>
            <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              选仓库 Warehouses
            </p>
            <div className="swx-list mt-2 space-y-2 pr-1">
              {visibleGroups.map((g, gi) => {
                const active = current?.warehouse === g.warehouse;
                const top = g.rows[0];
                const chip = g.rate !== null ? rateChipGradient(g.rate) : null;
                return (
                  <button
                    key={g.warehouse}
                    type="button"
                    onClick={() => setSelWh(g.warehouse)}
                    className="swx-wh swx-fade-up block w-full text-left"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: active
                        ? "linear-gradient(90deg, #eef2ff, #ffffff)"
                        : "#ffffff",
                      boxShadow: active
                        ? "0 0 0 2px #4f46e5, 0 10px 24px -12px rgba(79,70,229,.45)"
                        : "0 0 0 1px #e2e8f0",
                      animationDelay: Math.min(gi, 8) * 40 + "ms",
                    }}
                    title={g.warehouse}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-bold text-slate-800">
                        {g.warehouse}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums"
                        style={
                          chip
                            ? { background: chip.background, color: chip.color, boxShadow: chip.shadow }
                            : { backgroundColor: "#f1f5f9", color: "#64748b" }
                        }
                      >
                        {g.rate !== null ? formatPercent(g.rate) : "—"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] tabular-nums text-slate-400">
                      发单 {formatNumber(g.totalRequested)} · {g.rows.length} 家
                      {top && top.fulfillmentRate !== null && (
                        <> · 最好 {top.supplier} {formatPercent(top.fulfillmentRate)}</>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右列：选中仓的排名面板（sticky 跟随，切换时 key 变化触发整块重播动画） */}
          {current && (
            <div
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              style={{ position: "sticky", top: 16, alignSelf: "start", boxShadow: "0 18px 40px -20px rgba(15,23,42,.25)" }}
            >
              <div key={current.warehouse} className="swx-panel-in">
                <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold text-slate-800" title={current.warehouse}>
                      {current.warehouse}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-400">
                      发单 {formatNumber(current.totalRequested)} 人次 · 已接受 {formatNumber(current.totalAccepted)} 人次 · {current.rows.length} 家供应商
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="font-extrabold tabular-nums leading-none"
                      style={{
                        fontSize: 36,
                        backgroundImage: `linear-gradient(135deg, ${curFrom}, ${curTo})`,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      {current.rate !== null ? formatPercent(current.rate) : "—"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      整体达成率 Overall
                    </p>
                  </div>
                </div>
                {curSpark && (
                  <div className="px-5 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">每日已接受 Daily Accepted</p>
                      <p className="text-[11px] tabular-nums text-slate-400">{curDaily[0].date.slice(5)} → {curDaily[curDaily.length - 1].date.slice(5)}</p>
                    </div>
                    <div style={{ maxWidth: 560, margin: "4px auto 0" }}>
                    <svg viewBox="0 0 560 44" className="w-full" style={{ height: 44, display: "block" }} role="img" aria-label="该仓每日已接受人数走势">
                      <defs>
                        <linearGradient id="swxSparkFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={curFrom} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={curFrom} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <polygon points={curSpark.area} fill="url(#swxSparkFill)" />
                      <polyline points={curSpark.line} fill="none" stroke={curTo} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} className="swx-line" />
                      {curSpark.last && <circle cx={curSpark.last[0]} cy={curSpark.last[1]} r={3.5} fill={curTo} />}
                    </svg>
                    </div>
                  </div>
                )}
                <div className="space-y-2.5 px-5 py-4" style={{ background: "linear-gradient(180deg, #f8fafc, #ffffff)" }}>
                  {current.rows.map((p, i) => {
                    const fr = p.fulfillmentRate;
                    const isSel =
                      selected && selected.supplier === p.supplier && selected.warehouse === p.warehouse;
                    const [bFrom, bTo] = fr !== null ? rateGradient(fr) : ["#cbd5e1", "#94a3b8"];
                    return (
                      <button
                        key={p.supplier}
                        type="button"
                        onClick={() => setSelectedKey(p.supplier + "|" + p.warehouse)}
                        className="swx-row swx-fade-up block w-full rounded-xl px-2.5 py-2 text-left"
                        style={{
                          background:
                            i === 0 && current.rows.length > 1 && fr !== null
                              ? "linear-gradient(90deg, #ecfdf5, #ffffff 70%)"
                              : "#ffffff",
                          boxShadow: isSel ? "0 0 0 2px #4f46e5" : "0 0 0 1px #e2e8f0",
                          animationDelay: i * 55 + "ms",
                        }}
                        title={`${p.supplier} × ${current.warehouse}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="shrink-0 rounded-full"
                              style={{
                                width: 26,
                                height: 26,
                                fontSize: 13,
                                fontWeight: 800,
                                lineHeight: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 9999,
                                background:
                                  i === 0 && current.rows.length > 1
                                    ? "linear-gradient(135deg,#34d399,#059669)"
                                    : "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
                                color: i === 0 && current.rows.length > 1 ? "#ffffff" : "#475569",
                                boxShadow:
                                  i === 0 && current.rows.length > 1
                                    ? "0 4px 10px -3px #059669"
                                    : "inset 0 0 0 1px #e2e8f0",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-700">{p.supplier}</span>
                            {i === 0 && current.rows.length > 1 && fr !== null && (
                              <span
                                className="shrink-0 rounded-full px-1.5 py-0.5 font-semibold"
                                style={{ backgroundColor: "#d1fae5", color: "#047857", fontSize: 10 }}
                              >
                                最高
                              </span>
                            )}
                          </span>
                          <span
                            className="shrink-0 text-sm font-bold tabular-nums"
                            style={{ color: fr !== null ? rateTextHex(fr) : "#94a3b8" }}
                          >
                            {fr !== null ? formatPercent(fr) : "—"}
                          </span>
                        </span>
                        <AnimatedBar pct={fr ?? 0} from={bFrom} to={bTo} delay={i * 55} />
                        <span className="mt-1 block text-[11px] tabular-nums text-slate-400">
                          已接受 {p.accepted !== null ? formatNumber(p.accepted) : "—"} / 发单 {formatNumber(p.requested)} 人次
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 最佳 / 危险搭配：量大搭配按达成率排名，前五 / 后五 */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="swx-fade-up rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-5">
          <p className="text-sm font-bold text-slate-800">🏆 最佳搭配 Best Pairs</p>
          <p className="mt-0.5 text-xs text-slate-400">量大（发单 ≥ {formatNumber(bigLine)}）的搭配里，达成率最高的前五名 · 点一条切到它所在的仓</p>
          <div className="mt-3 space-y-1">
            {best.length === 0 && (
              <p className="text-sm leading-6 text-slate-400">
                这段时间还没有量大的搭配。
              </p>
            )}
            {best.map((p, i) => {
              const [bFrom, bTo] = rateGradient(p.fulfillmentRate ?? 0);
              return (
                <button key={p.supplier + "|" + p.warehouse} type="button" onClick={() => jumpTo(p.supplier, p.warehouse)} className="swx-listrow swx-fade-up block w-full text-left" style={{ animationDelay: i * 55 + "ms" }}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{i + 1}. {p.supplier} × {shortWarehouse(p.warehouse)}</span>
                    <span className="shrink-0 font-bold tabular-nums text-emerald-600">{formatPercent(p.fulfillmentRate ?? 0)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">已接受 {formatNumber(p.accepted ?? 0)} / 发单 {formatNumber(p.requested)} 人次</span>
                  <AnimatedBar pct={p.fulfillmentRate ?? 0} from={bFrom} to={bTo} delay={i * 55} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="swx-fade-up rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/70 to-white p-5" style={{ animationDelay: "80ms" }}>
          <p className="text-sm font-bold text-slate-800">⚠️ 危险搭配 Risky Pairs</p>
          <p className="mt-0.5 text-xs text-slate-400">量大（发单 ≥ {formatNumber(bigLine)}）的搭配里，达成率最低的前五名 · 点一条切到它所在的仓</p>
          <div className="mt-3 space-y-1">
            {risky.length === 0 && (
              <p className="text-sm leading-6 text-slate-400">
                这段时间还没有量大的搭配。
              </p>
            )}
            {risky.map((p, i) => {
              const [bFrom, bTo] = rateGradient(p.fulfillmentRate ?? 0);
              return (
                <button key={p.supplier + "|" + p.warehouse} type="button" onClick={() => jumpTo(p.supplier, p.warehouse)} className="swx-listrow swx-fade-up block w-full text-left" style={{ animationDelay: i * 55 + 80 + "ms" }}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{i + 1}. {p.supplier} × {shortWarehouse(p.warehouse)}</span>
                    <span className="shrink-0 font-bold tabular-nums text-rose-600">{formatPercent(p.fulfillmentRate ?? 0)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">已接受 {formatNumber(p.accepted ?? 0)} / 发单 {formatNumber(p.requested)} 人次</span>
                  <AnimatedBar pct={p.fulfillmentRate ?? 0} from={bFrom} to={bTo} delay={i * 55 + 80} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
