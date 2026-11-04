"use client";

import { useRef, useState } from "react";

/* 月报互动区 MonthlyInteractive：漏斗可点、每日堆叠柱可点可缩放、排名可切页签可换排序、点排名每日图联动。
   每日图：每根柱子旁边有一根灰条是当天已发单（图例按钮可以关掉），点柱子看明细里也有已发单。
   排名条：覆盖条，灰条 = 已发单，彩条 = 已接受，彩条占灰条的比例就是达成率。
   不装新包，不用 SVG <title>，关键颜色和尺寸全部内联 style。
   数据全部由 app/monthly/page.tsx（服务端）算好传进来，本文件只做展示和互动。 */

export type DailyPoint = {
  date: string;
  day: number;
  weekday: string;
  accepted: number;
  noshow: number;
  sentback: number;
  total: number;
};

export type RankRow = {
  name: string;
  accepted: number;
  issued: number;
  extra: number | null;
  extraLabel: string;
};

type Scope = { kind: "supplier" | "warehouse" | "job"; name: string } | null;
type Tab = "supplier" | "warehouse" | "job";
type SortKey = "a" | "r" | "i" | "x";

type Props = {
  funnel: { label: string; value: number; color: string; ok: boolean }[];
  daily: DailyPoint[];
  dailyBySupplier: Record<string, DailyPoint[]>;
  dailyByWarehouse: Record<string, DailyPoint[]>;
  dailyByJob: Record<string, DailyPoint[]>;
  /* 已发单：跟 daily 同一套日期对齐（没有的那天就是 0），公司一条，每个排名名字各一条。 */
  issued: number[];
  issuedBySupplier: Record<string, number[]>;
  issuedByWarehouse: Record<string, number[]>;
  issuedByJob: Record<string, number[]>;
  suppliers: RankRow[];
  warehouses: RankRow[];
  jobs: RankRow[];
  hasArrival: boolean;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
function formatDateLabel(date: string) {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!m || !d) return date;
  return `${m}月${d}日`;
}
function rateOf(row: RankRow): number | null {
  if (row.issued <= 0) return null;
  return (row.accepted / row.issued) * 100;
}
function rateColor(rate: number | null) {
  if (rate === null) return "#94a3b8";
  if (rate >= 60) return "#10b981";
  if (rate >= 40) return "#f59e0b";
  return "#f43f5e";
}

export default function MonthlyInteractive(props: Props) {
  const { funnel, daily, dailyBySupplier, dailyByWarehouse, dailyByJob, issued, issuedBySupplier, issuedByWarehouse, issuedByJob, suppliers, warehouses, jobs, hasArrival } = props;
  const [tab, setTab] = useState<Tab>("supplier");
  const [sort, setSort] = useState<SortKey>("a");
  const [scope, setScope] = useState<Scope>(null);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(daily.length - 1);
  const [show, setShow] = useState({ a: true, n: true, s: true, i: true });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<number | null>(null);

  /* 当前每日序列：没选排名就是全公司，点了排名就切到那一家/那一仓/那一工种。
     服务端已按全公司日期对齐补 0，所以长度跟全公司一致，滑块下标可以直接复用。 */
  const series: DailyPoint[] =
    scope === null
      ? daily
      : scope.kind === "supplier"
        ? dailyBySupplier[scope.name] ?? daily
        : scope.kind === "warehouse"
          ? dailyByWarehouse[scope.name] ?? daily
          : dailyByJob[scope.name] ?? daily;
  const issuedSeries: number[] =
    scope === null
      ? issued
      : scope.kind === "supplier"
        ? issuedBySupplier[scope.name] ?? issued
        : scope.kind === "warehouse"
          ? issuedByWarehouse[scope.name] ?? issued
          : issuedByJob[scope.name] ?? issued;
  const dailyScale = Math.max(1, ...series.map((d) => d.total), ...issuedSeries);
  const safeStart = Math.min(rangeStart, Math.max(0, series.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(rangeEnd, series.length - 1));
  const sliced = series.slice(safeStart, safeEnd + 1);
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  /* 双滑块：一条轨道，蓝色是选中，左右两个白点可拖，默认全选。
     点轨道空白处，把离得近的那个点挪过去；点中白点后按左右键，一天一天挪。 */
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);
  const indexFromClientX = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || series.length <= 1) return 0;
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(p * (series.length - 1));
  };
  const onThumbDown = (which: "start" | "end") => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    dragRef.current = which;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 旧浏览器不支持 pointer capture，拖动照常用下面的 move/up 处理 */
    }
  };
  const onThumbMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const idx = indexFromClientX(e.clientX);
    if (dragRef.current === "start") setRangeStart(Math.min(idx, safeEnd));
    else setRangeEnd(Math.max(idx, safeStart));
  };
  const onThumbUp = () => {
    dragRef.current = null;
  };
  const onThumbKey = (which: "start" | "end") => (e: React.KeyboardEvent<HTMLElement>) => {
    let d = 0;
    if (e.key === "ArrowLeft") d = -1;
    else if (e.key === "ArrowRight") d = 1;
    else return;
    e.preventDefault();
    if (which === "start") setRangeStart(Math.max(0, Math.min(safeEnd, safeStart + d)));
    else setRangeEnd(Math.min(series.length - 1, Math.max(safeStart, safeEnd + d)));
  };
  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-thumb]")) return;
    const idx = indexFromClientX(e.clientX);
    if (Math.abs(idx - safeStart) <= Math.abs(idx - safeEnd)) setRangeStart(Math.min(idx, safeEnd));
    else setRangeEnd(Math.max(idx, safeStart));
  };

  /* 排名：页签 + 排序。供应商没有第四项（应到岗/需求），切到供应商时自动回到按已接受排。 */
  const rankList = tab === "supplier" ? suppliers : tab === "warehouse" ? warehouses : jobs;
  const sortLabel =
    sort === "a" ? "已接受" : sort === "r" ? "达成率" : sort === "i" ? "已发单" : tab === "warehouse" ? "应到岗" : "需求";
  const sortValue = (row: RankRow): number => {
    if (sort === "a") return row.accepted;
    if (sort === "r") {
      const r = rateOf(row);
      return r === null ? -1 : r;
    }
    if (sort === "i") return row.issued;
    return row.extra === null ? -1 : row.extra;
  };
  const sorted = [...rankList].sort((p, q) => {
    const diff = sortValue(q) - sortValue(p);
    return diff !== 0 ? diff : q.accepted - p.accepted;
  });
  /* 覆盖条的刻度：统一按本维度已发单和已接受的最大值拉长，排序只改顺序，不改条长。
     这样灰条（已发单）和彩条（已接受）之间才能直接比，彩条占灰条的比例就是达成率。 */
  const barScale = Math.max(1, ...sorted.map((r) => Math.max(r.issued, r.accepted)));

  const tabButton = (key: Tab, label: string) => (
    <button
      key={key}
      onClick={() => {
        setTab(key);
        if (key === "supplier" && sort === "x") setSort("a");
        setScope(null);
        setSelectedDay(null);
      }}
      style={{
        flex: 1,
        borderRadius: "999px",
        padding: "7px 0",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        backgroundColor: tab === key ? "#6366f1" : "#f1f5f9",
        color: tab === key ? "#ffffff" : "#334155",
        border: tab === key ? "1px solid #6366f1" : "1px solid #e2e8f0",
      }}
    >
      {label}
    </button>
  );
  const sortButton = (key: SortKey, label: string, hidden?: boolean) => (
    <button
      key={key}
      onClick={() => setSort(key)}
      style={{
        display: hidden ? "none" : undefined,
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        backgroundColor: sort === key ? "#6366f1" : "#f1f5f9",
        color: sort === key ? "#ffffff" : "#334155",
        border: sort === key ? "1px solid #6366f1" : "1px solid #e2e8f0",
      }}
    >
      {label}
    </button>
  );
  const legendButton = (key: "a" | "n" | "s" | "i", label: string) => (
    <button
      key={key}
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      style={{
        flex: 1,
        minWidth: "80px",
        borderRadius: "999px",
        padding: "6px 0",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        backgroundColor: show[key] ? "#6366f1" : "#f1f5f9",
        color: show[key] ? "#ffffff" : "#334155",
        border: show[key] ? "1px solid #6366f1" : "1px solid #e2e8f0",
      }}
    >
      {label}
    </button>
  );

  const selectedDayPoint = selectedDay !== null ? series[selectedDay] : null;
  const selectedDayIssued = selectedDay !== null ? (issuedSeries[selectedDay] ?? 0) : 0;
  const selectedStageItem = selectedStage !== null ? funnel[selectedStage] : null;
  const selectedStageNext = selectedStage !== null ? funnel[selectedStage + 1] : undefined;

  return (
    <div>
      {/* 履约漏斗：点一条，明细显示在下面 */}
      <section className="m-fade m-card" style={{ marginTop: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: "24px", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700 }}>履约漏斗 Fulfillment Funnel</h3>
        <p style={{ marginTop: "4px", fontSize: "12px", color: "#94a3b8" }}>每条按当月最大值拉长，点一条看数字</p>
        <div style={{ marginTop: "20px" }}>
          {funnel.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setSelectedStage(i)}
              style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", background: "none", border: "none", padding: "0", marginBottom: "12px", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ width: "96px", flexShrink: 0, fontSize: "14px", fontWeight: 600, color: "#334155" }}>{f.label}</span>
              <span style={{ height: "28px", flex: 1, overflow: "hidden", borderRadius: "999px", backgroundColor: "#f1f5f9" }}>
                <span className="m-bar" style={{ display: "block", height: "100%", borderRadius: "999px", width: `${f.ok && f.value > 0 ? Math.max((f.value / funnelMax) * 100, 3) : 0}%`, backgroundColor: f.color, animationDelay: `${0.2 + i * 0.12}s` }} />
              </span>
              <span style={{ width: "64px", flexShrink: 0, textAlign: "right", fontSize: "14px", fontWeight: 700 }}>{f.ok ? formatNumber(f.value) : "—"}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: "8px", fontSize: "13px", backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px" }}>
          {selectedStageItem ? (
            <span>
              <strong>{selectedStageItem.label} {formatNumber(selectedStageItem.value)} 人次</strong>
              {selectedStageNext ? ` · 下一阶段 ${selectedStageNext.label} ${formatNumber(selectedStageNext.value)} 人次，差 ${selectedStageNext.value - selectedStageItem.value} 人次。` : " · 这是漏斗最后一段。"}
            </span>
          ) : (
            "点上面任意一条，明细显示在这里。"
          )}
        </div>
      </section>

      {/* 每日到岗构成：堆叠柱 + 旁边一根灰色已发单柱 + 图例开关 + 双滑块 + 点柱子看明细 */}
      <section className="m-fade m-card" style={{ marginTop: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: "24px", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700 }}>每日到岗构成 Daily Arrival Breakdown</h3>
        <p style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>当前：{scope ? scope.name : "全公司"}</p>
        <p style={{ marginTop: "4px", fontSize: "12px", color: "#94a3b8" }}>
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#10b981", verticalAlign: "middle" }} /> 已接受&nbsp;&nbsp;
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#f59e0b", verticalAlign: "middle" }} /> No Show&nbsp;&nbsp;
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#f43f5e", verticalAlign: "middle" }} /> 被退回&nbsp;&nbsp;
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", backgroundColor: "#cbd5e1", verticalAlign: "middle" }} /> 已发单&nbsp;· 点图例可以关掉某一层
        </p>
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
          {legendButton("a", "已接受")}
          {legendButton("n", "No Show")}
          {legendButton("s", "被退回")}
          {legendButton("i", "已发单")}
        </div>
        {!hasArrival || series.length === 0 ? (
          <p style={{ marginTop: "24px", fontSize: "14px", color: "#64748b" }}>本月到岗表没有数据，这个图画不出来。</p>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "230px", marginTop: "24px" }}>
              {sliced.map((d, k) => {
                const orig = safeStart + k;
                const issuedVal = issuedSeries[orig] ?? 0;
                const visible = (show.a ? d.accepted : 0) + (show.n ? d.noshow : 0) + (show.s ? d.sentback : 0);
                const top = Math.max(visible, show.i ? issuedVal : 0);
                return (
                  <button
                    key={d.date}
                    onMouseEnter={() => setSelectedDay(orig)}
                    onClick={() => setSelectedDay(orig)}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    <span style={{ marginBottom: "4px", fontSize: "10px", fontWeight: 700, color: "#334155" }}>{formatNumber(d.total)}</span>
                    <span style={{ display: "flex", alignItems: "flex-end", gap: "1px", width: "100%", justifyContent: "center", height: `${(top / dailyScale) * 100}%` }}>
                      {show.i && (
                        <span style={{ width: "35%", maxWidth: "12px", height: `${top > 0 ? (issuedVal / top) * 100 : 0}%`, backgroundColor: "#cbd5e1", borderRadius: "4px 4px 0 0" }} />
                      )}
                      <span className="m-col" style={{ width: show.i ? "65%" : "100%", maxWidth: "28px", display: "flex", flexDirection: "column-reverse", overflow: "hidden", borderRadius: "6px 6px 0 0", height: `${top > 0 ? (visible / top) * 100 : 0}%`, animationDelay: `${0.15 + k * 0.04}s` }}>
                        {show.a && <span style={{ height: `${visible > 0 ? (d.accepted / visible) * 100 : 0}%`, backgroundColor: "#10b981" }} />}
                        {show.n && <span style={{ height: `${visible > 0 ? (d.noshow / visible) * 100 : 0}%`, backgroundColor: "#f59e0b" }} />}
                        {show.s && <span style={{ height: `${visible > 0 ? (d.sentback / visible) * 100 : 0}%`, backgroundColor: "#f43f5e" }} />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "3px", borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "8px" }}>
              {sliced.map((d) => (
                <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>{d.day}日</div>
                  <div style={{ fontSize: "9px", color: "#cbd5e1" }}>{d.weekday}</div>
                </div>
              ))}
            </div>
            {/* 双滑块：一条轨道，蓝色是选中，左右两个白点可拖，默认全选 */}
            {series.length > 1 && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                  <span>
                    从 <strong style={{ color: "#0f172a" }}>{formatDateLabel(series[safeStart].date)}</strong> 起
                  </span>
                  <span>
                    到 <strong style={{ color: "#0f172a" }}>{formatDateLabel(series[safeEnd].date)}</strong> 止
                  </span>
                </div>
                <div ref={barRef} onPointerDown={onBarPointerDown} style={{ position: "relative", height: "28px", cursor: "pointer" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: "10px", height: "8px", borderRadius: "999px", backgroundColor: "#f1f5f9" }} />
                  <div style={{ position: "absolute", top: "10px", height: "8px", borderRadius: "999px", backgroundColor: "#3b82f6", left: `${(safeStart / (series.length - 1)) * 100}%`, width: `${((safeEnd - safeStart) / (series.length - 1)) * 100}%` }} />
                  <button
                    data-thumb="start"
                    aria-label="开始日期"
                    onPointerDown={onThumbDown("start")}
                    onPointerMove={onThumbMove}
                    onPointerUp={onThumbUp}
                    onPointerCancel={onThumbUp}
                    onKeyDown={onThumbKey("start")}
                    style={{ position: "absolute", top: "2px", width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#ffffff", border: "2px solid #3b82f6", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", cursor: "grab", touchAction: "none", padding: 0, left: `${(safeStart / (series.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
                  />
                  <button
                    data-thumb="end"
                    aria-label="结束日期"
                    onPointerDown={onThumbDown("end")}
                    onPointerMove={onThumbMove}
                    onPointerUp={onThumbUp}
                    onPointerCancel={onThumbUp}
                    onKeyDown={onThumbKey("end")}
                    style={{ position: "absolute", top: "2px", width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#ffffff", border: "2px solid #3b82f6", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", cursor: "grab", touchAction: "none", padding: 0, left: `${(safeEnd / (series.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
                  />
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>蓝色的就是选中的日子，左右两个白点都能拖，默认全选。</p>
              </div>
            )}
            <div style={{ marginTop: "10px", fontSize: "13px", lineHeight: 1.7, backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px" }}>
              {selectedDayPoint ? (
                <span>
                  <strong>
                    {scope ? `${scope.name} · ` : ""}
                    {formatDateLabel(selectedDayPoint.date)} · 应到岗 {formatNumber(selectedDayPoint.total)} 人次 · 已发单 {formatNumber(selectedDayIssued)} 人次
                  </strong>
                  <br />
                  已接受 {formatNumber(selectedDayPoint.accepted)} · No Show {formatNumber(selectedDayPoint.noshow)} · 被退回 {formatNumber(selectedDayPoint.sentback)} · 已接受占应到岗{" "}
                  {selectedDayPoint.total > 0 ? formatPercent((selectedDayPoint.accepted / selectedDayPoint.total) * 100) : "—"}
                </span>
              ) : (
                "把鼠标移到柱子上，或点一下柱子，明细显示在这里。没有柱子的日子是到岗表里那天没有数据，不是 0，直接跳过去了。已发单是发单表那天的人次，跟到岗日期口径不一样，跨月时间差会让某天已发单和应到岗对不上，这是正常的。"
              )}
            </div>
          </div>
        )}
      </section>

      {/* 排名：页签 + 排序 + 点一行每日图联动，全部排名可滚动 */}
      <section className="m-fade m-card" style={{ marginTop: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: "24px", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700 }}>排名 Ranking · 点一行切到那一家，再点一次回到全公司</h3>
        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
          {tabButton("supplier", "供应商")}
          {tabButton("warehouse", "仓库")}
          {tabButton("job", "工种")}
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>按什么排：</span>
          {sortButton("a", "已接受")}
          {sortButton("r", "达成率")}
          {sortButton("i", "已发单")}
          {sortButton("x", tab === "warehouse" ? "应到岗" : "需求", tab === "supplier")}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#94a3b8" }}>
          当前按{sortLabel}从高到低排；达成率 = 已接受 ÷ 已发单，率只决定彩条颜色。条是覆盖条：灰条 = 已发单，彩条 = 已接受，彩条占灰条的比例就是达成率，灰条露出来的就是没达成的部分；条长统一按本维度最大值拉长，排序只改顺序。
          {sort === "r" ? "按达成率排时小样本也会排前面，看的时候要连已接受一起看。" : ""}
        </p>
        {sorted.length > 0 ? (
          <div style={{ marginTop: "12px", maxHeight: "480px", overflowY: "auto", paddingRight: "4px" }}>
            {sorted.map((row, i) => {
              const rate = rateOf(row);
              const metric = sortValue(row);
              const isSelected = scope !== null && scope.kind === tab && scope.name === row.name;
              return (
                <button
                  key={row.name}
                  onClick={() => {
                    /* 再点一次已选中的那行就回到全公司 */
                    setScope(isSelected ? null : { kind: tab, name: row.name });
                    setSelectedDay(null);
                  }}
                  style={{ display: "block", width: "100%", background: "none", border: "none", borderTop: i === 0 ? "none" : "1px solid #e2e8f0", padding: "8px 0", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i + 1}. {row.name}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: rateColor(rate), flexShrink: 0 }}>{rate !== null ? formatPercent(rate) : "—"}</span>
                  </div>
                  {/* 覆盖条：灰条 = 已发单，彩条 = 已接受。已接受比已发单多（跨月时间差）时彩条会伸出灰条一截，正好一眼看出是时间差。 */}
                  <div style={{ position: "relative", height: "12px", borderRadius: "999px", backgroundColor: "#f1f5f9", overflow: "hidden", marginTop: "6px" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "999px", width: `${(row.issued / barScale) * 100}%`, backgroundColor: "#cbd5e1" }} />
                    <div className="m-bar" style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "999px", width: `${(row.accepted / barScale) * 100}%`, backgroundColor: rateColor(rate), animationDelay: `${i * 0.06}s` }} />
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    {formatNumber(row.accepted)} 已接受 · {formatNumber(row.issued)} 已发单
                    {row.issued > row.accepted ? ` · 未达成 ${formatNumber(row.issued - row.accepted)}` : ""}
                    {row.accepted > row.issued ? ` · 已接受比已发单多 ${formatNumber(row.accepted - row.issued)}（跨月时间差）` : ""}
                    {row.extra !== null ? ` · ${row.extraLabel} ${formatNumber(row.extra)}` : ""} · 按{sortLabel}排：{sort === "r" ? (rate !== null ? formatPercent(rate) : "—") : formatNumber(metric)}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p style={{ marginTop: "12px", fontSize: "14px", color: "#64748b" }}>本月这个维度没有数据。</p>
        )}
        <div style={{ marginTop: "10px", fontSize: "13px", lineHeight: 1.7, backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px" }}>
          {scope ? (
            <span>
              已切到 <strong>{scope.name}</strong>：每日图上方已标出当前是这一家，点柱子看它那天。
            </span>
          ) : (
            "点上面任意一行，明细显示在这里，每日图也会跟着只看那一家。"
          )}
        </div>
      </section>
    </div>
  );
}
