"use client";

import { useEffect, useState } from "react";

/* 被结束互动区 EoaInteractive：只留按供应商、按仓库两张排名，左右一边一个。
   互动三处：
   1) 每张都能按被结束 / 按警告切换排序；
   2) 点一行展开，展开后显示那一家 / 那一仓本月每天的被结束小柱子（从下往上长），
      并标出最多的一天，再点一次收起；
   3) 顶部被结束 / 警告两个总数上场时从 0 数到目标，不是静态数字。
   只写人次，不算率。数据全部由 app/monthly/page.tsx（服务端）算好传进来，
   用的是现成的 eoa_daily_supplier / eoa_daily_warehouse，不改管线，不用重跑。 */

export type EoaRow = { name: string; ended: number; warnings: number };
export type EoaDay = { date: string; ended: number; warnings: number };

type Props = {
  totalEnded: number;
  totalWarning: number;
  suppliers: EoaRow[];
  warehouses: EoaRow[];
  dailySup: Record<string, EoaDay[]>;
  dailyWh: Record<string, EoaDay[]>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatDateLabel(date: string) {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!m || !d) return date;
  return `${m}月${d}日`;
}

export default function EoaInteractive(props: Props) {
  const { totalEnded, totalWarning, suppliers, warehouses, dailySup, dailyWh } = props;
  const [sortSup, setSortSup] = useState<"ended" | "warnings">("ended");
  const [sortWh, setSortWh] = useState<"ended" | "warnings">("ended");
  const [selectedSup, setSelectedSup] = useState<string | null>(null);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);

  /* 顶部总数 count-up：上场 900ms 内从 0 数到目标 */
  const [counted, setCounted] = useState({ ended: 0, warnings: 0 });
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounted({ ended: Math.round(totalEnded * eased), warnings: Math.round(totalWarning * eased) });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalEnded, totalWarning]);

  const renderPanel = (
    title: string,
    rows: EoaRow[],
    sort: "ended" | "warnings",
    setSort: (s: "ended" | "warnings") => void,
    selected: string | null,
    setSelected: (name: string | null) => void,
    dailyMap: Record<string, EoaDay[]>
  ) => {
    const sorted = [...rows].sort((a, b) => {
      const diff = b[sort] - a[sort];
      return diff !== 0 ? diff : b.ended - a.ended;
    });
    const maxEnded = Math.max(1, ...sorted.map((r) => r.ended));
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <h4 style={{ fontWeight: 700, color: "#334155" }}>{title}</h4>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["ended", "warnings"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: sort === key ? "#f43f5e" : "#f1f5f9",
                  color: sort === key ? "#ffffff" : "#334155",
                  border: sort === key ? "1px solid #f43f5e" : "1px solid #e2e8f0",
                }}
              >
                {key === "ended" ? "按被结束" : "按警告"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "12px", maxHeight: "480px", overflowY: "auto", paddingRight: "4px" }}>
          {sorted.map((row, i) => {
            const isSelected = selected === row.name;
            const days = (dailyMap[row.name] ?? []).filter((d) => d.ended > 0 || d.warnings > 0);
            const maxDay = Math.max(1, ...days.map((d) => d.ended));
            const peak = days.reduce<EoaDay | null>((best, d) => (!best || d.ended > best.ended ? d : best), null);
            return (
              <div key={row.name} style={{ borderTop: i === 0 ? "none" : "1px solid #e2e8f0", padding: "8px 0" }}>
                <button
                  onClick={() => setSelected(isSelected ? null : row.name)}
                  style={{ display: "block", width: "100%", background: isSelected ? "#fff1f2" : "none", border: "none", borderRadius: "8px", padding: "4px 6px", margin: "-4px -6px", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i + 1}. {row.name}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#f43f5e", flexShrink: 0 }}>{formatNumber(row.ended)}</span>
                  </div>
                  <div style={{ marginTop: "6px", height: "12px", overflow: "hidden", borderRadius: "999px", backgroundColor: "#f1f5f9" }}>
                    <div className="eoa-bar" style={{ height: "100%", borderRadius: "999px", width: `${(row.ended / maxEnded) * 100}%`, backgroundColor: "#f43f5e", animationDelay: `${i * 0.05}s` }} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    被结束 {formatNumber(row.ended)} · 警告 {formatNumber(row.warnings)}
                    {isSelected ? " · 再点一次收起" : " · 点一行看它每天的被结束"}
                  </p>
                </button>
                {isSelected && (
                  <div className="eoa-fade" style={{ marginTop: "10px", backgroundColor: "#fff1f2", borderRadius: "10px", padding: "10px" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                      {peak ? `最多的一天：${formatDateLabel(peak.date)}，被结束 ${formatNumber(peak.ended)} 人次` : "本月没有按天的被结束数据"}
                      {days.length > 0 ? ` · 本月共 ${days.length} 天有被结束` : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "72px", marginTop: "8px" }}>
                      {days.map((d, k) => (
                        <div
                          key={d.date}
                          title={`${formatDateLabel(d.date)}：被结束 ${d.ended}，警告 ${d.warnings}`}
                          className="eoa-col"
                          style={{ flex: 1, height: `${(d.ended / maxDay) * 100}%`, backgroundColor: "#f43f5e", borderRadius: "3px 3px 0 0", animationDelay: `${k * 0.03}s` }}
                        />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
                      {days.map((d) => (
                        <div key={d.date} style={{ flex: 1, textAlign: "center", fontSize: "9px", color: "#94a3b8" }}>
                          {Number(d.date.slice(8, 10))}日
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {sorted.length === 0 && <p style={{ fontSize: "14px", color: "#64748b" }}>本月没有这个维度的数据。</p>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`
        @keyframes eoaGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes eoaGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes eoaFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .eoa-bar { transform-origin: left center; animation: eoaGrowX 0.8s ease both; }
        .eoa-col { transform-origin: bottom center; animation: eoaGrowY 0.5s ease both; }
        .eoa-fade { animation: eoaFadeUp 0.3s ease both; }
      `}</style>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "32px" }}>
        <div>
          <p style={{ fontSize: "32px", fontWeight: 800, color: "#f43f5e", lineHeight: 1 }}>{formatNumber(counted.ended)}</p>
          <p style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>被结束 Ended</p>
        </div>
        <div>
          <p style={{ fontSize: "32px", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>{formatNumber(counted.warnings)}</p>
          <p style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>警告 Warning</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2" style={{ marginTop: "24px" }}>
        {renderPanel("按供应商 By Agency", suppliers, sortSup, setSortSup, selectedSup, setSelectedSup, dailySup)}
        {renderPanel("按仓库 By Warehouse", warehouses, sortWh, setSortWh, selectedWh, setSelectedWh, dailyWh)}
      </div>
    </div>
  );
}
