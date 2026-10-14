"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function todayLocal(): string {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}
function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}
function formatShort(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function monthTitle(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/* 单个月历：点日期 -> onPick(YYYY-MM-DD) */
function MonthCalendar({
  ym,
  draftStart,
  draftEnd,
  min,
  max,
  today,
  onPick,
}: {
  ym: string;
  draftStart: string;
  draftEnd: string;
  min: string;
  max: string;
  today: string;
  onPick: (iso: string) => void;
}) {
  const [y, m] = ym.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <p className="mb-2 text-center text-sm font-bold text-slate-800">
        {monthTitle(ym)}
      </p>
      <div
        className="text-center text-[11px] font-semibold text-slate-400"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0,1fr))",
          gap: "4px",
        }}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0,1fr))",
          gap: "4px",
        }}
      >
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const disabled = (min && iso < min) || (max && iso > max);
          const isStart = iso === draftStart;
          const isEnd = iso === draftEnd;
          const isEndpoint = isStart || isEnd;
          const inRange =
            draftStart && draftEnd && iso > draftStart && iso < draftEnd;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={[
                "flex h-9 items-center justify-center rounded-full text-sm transition",
                disabled
                  ? "cursor-not-allowed text-slate-200"
                  : isEndpoint
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 font-bold text-white shadow-md shadow-indigo-200"
                    : inRange
                      ? "bg-indigo-100 font-semibold text-indigo-800 hover:bg-indigo-200"
                      : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700",
                !disabled && !isEndpoint && isToday
                  ? "ring-2 ring-indigo-400 ring-offset-1"
                  : "",
              ].join(" ")}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 日期范围选择器（客户端组件）。
 * 点范围按钮 -> 弹出双月历：先点开始日，自动跳到选结束日；
 * 点完结束日自动应用（改 URL 参数 ?start=..&end=..，服务端按参数过滤重算）。
 * start/end/min/max 都是 YYYY-MM-DD。
 */
export default function DateRangePicker({
  start,
  end,
  min,
  max,
}: {
  start: string;
  end: string;
  min: string;
  max: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = todayLocal();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"start" | "end">("start");
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const [view, setView] = useState(() => (start || today).slice(0, 7));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  const apply = (ns: string, ne: string) => {
    if (!ns || !ne) return;
    const [a, b] = ns <= ne ? [ns, ne] : [ne, ns];
    // 记住这次选的范围（会话 cookie，关浏览器清掉）：跳到别的页面时默认用它
    document.cookie = `dateRange=${a}|${b}; path=/`;
    setOpen(false);
    router.push(`${pathname}?start=${a}&end=${b}`);
  };

  const preset = (kind: "today" | "7d" | "30d" | "all") => {
    if (kind === "all") return apply(min, max);
    if (kind === "today") return apply(today, today);
    const days = kind === "7d" ? 6 : 29;
    return apply(shiftDate(max, -days), max);
  };

  const openPopover = () => {
    setDraftStart(start);
    setDraftEnd(end);
    setMode("start");
    setView((start || today).slice(0, 7));
    setOpen(true);
  };

  // 点日期：选开始日 -> 自动跳到选结束日；选结束日 -> 自动应用并关闭
  const pickDay = (iso: string) => {
    if (mode === "start") {
      setDraftStart(iso);
      if (!draftEnd || iso > draftEnd) setDraftEnd(iso);
      setMode("end");
    } else {
      let s = draftStart;
      let e = iso;
      if (!s || e < s) [s, e] = [e, s];
      setDraftStart(s);
      setDraftEnd(e);
      apply(s, e);
    }
  };

  const btn =
    "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600";
  const tabBtn = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
    }`;

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">
        日期范围 Date Range
      </span>

      {/* 范围按钮：点开双月历 */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="flex items-center gap-2 rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:shadow"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {formatShort(start)} — {formatShort(end)}
        <span
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {/* 快捷预设 */}
      <button type="button" className={btn} onClick={() => preset("today")}>
        今天 Today
      </button>
      <button type="button" className={btn} onClick={() => preset("7d")}>
        近7天 7D
      </button>
      <button type="button" className={btn} onClick={() => preset("30d")}>
        近30天 30D
      </button>
      <button type="button" className={btn} onClick={() => preset("all")}>
        全部 All
      </button>

      {open && (
        <>
          {/* 点外面关闭 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-full z-50 mt-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl"
            style={{ width: "min(580px, calc(100vw - 2.5rem))" }}
          >
            {/* 模式切换：开始 / 结束 */}
            <div className="mb-1 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={tabBtn(mode === "start")}
                  onClick={() => setMode("start")}
                >
                  开始 Start · {formatShort(draftStart)}
                </button>
                <button
                  type="button"
                  className={tabBtn(mode === "end")}
                  onClick={() => setMode("end")}
                >
                  结束 End · {formatShort(draftEnd)}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {mode === "start"
                ? "👆 先点开始日期，选完自动跳到选结束日期"
                : "👆 再点结束日期，选完自动应用"}
            </p>

            {/* 双月历 + 月份切换 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setView(addMonths(view, -1))}
                className="absolute -top-1 left-0 z-10 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setView(addMonths(view, 1))}
                className="absolute -top-1 right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                ›
              </button>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}
              >
                <MonthCalendar
                  ym={view}
                  draftStart={draftStart}
                  draftEnd={draftEnd}
                  min={min}
                  max={max}
                  today={today}
                  onPick={pickDay}
                />
                <MonthCalendar
                  ym={addMonths(view, 1)}
                  draftStart={draftStart}
                  draftEnd={draftEnd}
                  min={min}
                  max={max}
                  today={today}
                  onPick={pickDay}
                />
              </div>
            </div>

            {/* 底部：取消 / 确定 */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                取消 Cancel
              </button>
              <button
                type="button"
                onClick={() => apply(draftStart, draftEnd)}
                className="rounded-full bg-indigo-600 px-5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
              >
                确定 Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
