"use client";

import { useMemo, useState } from "react";

export type AgencyRow = {
  name: string;
  requested: number;
  filled: number;
  unfilled: number;
  dispatchRate: number;
  actualArrived: number | null;
  accepted: number | null;
  fulfillmentRate: number | null;
  noshow: number;
  sentBack: number;
};

export type AgencyEOA = {
  ended: number;
  warnings: number;
  lowEff: number;
  poorAtt: number;
  total: number;
};

export type ReconciliationRow = {
  name: string;
  id: string;
  supplier: string;
  warehouse: string;
  date: string;
  job: string;
  shift: string;
  tempStatus: string;
};

export type AgencyDailyPoint = {
  date: string;
  requested: number;
  accepted: number;
  sentBack?: number;
};

export type AgencyJobRow = {
  job: string;
  requested: number;
  filled: number;
  accepted: number | null;
  actualArrived: number | null;
  noshow: number;
  sentBack: number;
  fulfillmentRate: number | null;
};

export type SentBackReasonRow = {
  reason: string;
  count: number;
};

export type AgencyWarehouseRow = {
  warehouse: string;
  requested: number;
  filled: number;
  accepted: number | null;
  actualArrived: number | null;
  noshow: number;
  sentBack: number;
  fulfillmentRate: number | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}
function rateTextHex(fr: number | null) {
  if (fr === null) return "#64748b";
  if (fr >= 60) return "#059669";
  if (fr >= 40) return "#d97706";
  return "#e11d48";
}
function rateGradient(fr: number | null): [string, string] {
  if (fr === null) return ["#94a3b8", "#64748b"];
  if (fr >= 60) return ["#34d399", "#059669"];
  if (fr >= 40) return ["#fbbf24", "#d97706"];
  return ["#fb7185", "#e11d48"];
}

function Bar({ pct, from, to }: { pct: number; from: string; to: string }) {
  return (
    <span style={{ display: "block", marginTop: 6, height: 6, borderRadius: 9999, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
      <span
        style={{
          display: "block",
          height: "100%",
          borderRadius: 9999,
          width: Math.min(Math.max(pct, 0), 100) + "%",
          background: `linear-gradient(90deg, ${from}, ${to})`,
        }}
      />
    </span>
  );
}

function ScatterChart({ points }: { points: { label: string; x: number; y: number | null; size: number }[] }) {
  const maxX = points.reduce((m, p) => Math.max(m, p.x), 0) || 1;
  const shown = points.filter((p) => p.y !== null);
  if (shown.length === 0) return null;
  return (
    <div style={{ maxWidth: 560, margin: "12px auto 0" }}>
      <svg viewBox="0 0 560 150" style={{ width: "100%", height: "auto", display: "block", background: "#f8fafc", borderRadius: 12 }}>
        <line x1={40} y1={10} x2={40} y2={130} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={40} y1={130} x2={550} y2={130} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={40} y1={58} x2={550} y2={58} stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" />
        <line x1={40} y1={82} x2={550} y2={82} stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 4" />
        <text x={545} y={52} fontSize={10} fill="#059669" textAnchor="end">60%</text>
        <text x={545} y={76} fontSize={10} fill="#d97706" textAnchor="end">40%</text>
        <text x={40} y={145} fontSize={10} fill="#64748b">发单量 →</text>
        <text x={545} y={145} fontSize={10} fill="#64748b" textAnchor="end">{formatNumber(maxX)} 人次</text>
        {shown.map((p, i) => {
          const cx = 40 + (p.x / maxX) * 500;
          const cy = 130 - ((p.y ?? 0) / 100) * 120;
          const [f, t] = rateGradient(p.y);
          const r = Math.min(Math.max(6 + Math.sqrt(Math.max(p.size, 0)) * 0.6, 6), 18);
          return (
            <g key={p.label + "-" + i}>
              <circle cx={cx} cy={cy} r={r} fill={f} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1.5}>
              </circle>
              <text x={cx} y={cy - r - 3} fontSize={10} fill="#334155" textAnchor="middle">{p.label.length > 10 ? p.label.slice(0, 10) + "…" : p.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>横轴 = 发单量，纵轴 = 达成率，圆点越大 = 已接受越多。右上（量大率高）最好，右下（量大率低）最危险。</div>
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const C = 2 * Math.PI * 40;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
      <svg viewBox="0 0 100 100" style={{ width: 120, height: 120, flexShrink: 0 }}>
        <circle cx={50} cy={50} r={40} fill="none" stroke="#e2e8f0" strokeWidth={16} />
        {segments.map((s) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={s.label}
              cx={50} cy={50} r={40} fill="none" stroke={s.color} strokeWidth={16}
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-offset * C}
              transform="rotate(-90 50 50)"
            >
            </circle>
          );
          offset += frac;
          return el;
        })}
        <text x={50} y={48} fontSize={13} fontWeight={800} fill="#0f172a" textAnchor="middle">{formatNumber(total)}</text>
        <text x={50} y={62} fontSize={9} fill="#64748b" textAnchor="middle">实际到场</text>
      </svg>
      <div style={{ flex: 1, minWidth: 200 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "4px 0" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 6 }} />{s.label}</span>
            <span style={{ fontWeight: 700 }}>{formatNumber(s.value)} · {((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.agm-kpis { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
@media (min-width: 768px) { .agm-kpis { grid-template-columns: repeat(4, 1fr); } }
.agm-card { background: #ffffff; border-radius: 16px; padding: 16px; box-shadow: 0 8px 24px -16px rgba(15,23,42,.25); }
.agm-hero { border-radius: 20px; padding: 20px; color: #ffffff; background: linear-gradient(135deg, #6366f1, #8b5cf6 55%, #ec4899); box-shadow: 0 18px 36px -18px rgba(99,102,241,.55); }
.agm-drop-item { width: 100%; text-align: left; border: 1px solid transparent; border-radius: 12px; padding: 10px 12px; margin-bottom: 6px; cursor: pointer; background: #ffffff; }
.agm-drop-item:hover { border-color: #c7d2fe; background: #eef2ff; }
.agm-drop-item.active { border-color: #6366f1; background: #eef2ff; }
`;

function priorityLabel(tempStatus: string) {
  if (tempStatus === "已确认") return { label: "最像漏记，先补", color: "#e11d48", bg: "#ffe4e6" };
  if (tempStatus === "试工不通过") return { label: "漏记，补不通过", color: "#d97706", bg: "#fef3c7" };
  if (tempStatus === "待确认") return { label: "待确认，先放着", color: "#64748b", bg: "#e2e8f0" };
  return { label: "更像真 No Show，确认一下", color: "#475569", bg: "#f1f5f9" };
}

function ReconciliationList({ rows }: { rows: ReconciliationRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyPriority, setOnlyPriority] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (onlyPriority) list = list.filter((r) => r.tempStatus === "已确认" || r.tempStatus === "试工不通过");
    if (!q) return list;
    return list.filter((r) =>
      [r.name, r.id, r.supplier, r.warehouse, r.job].join(" ").toLowerCase().includes(q)
    );
  }, [rows, query, onlyPriority]);

  return (
    <div style={{ background: "#ffffff", borderRadius: 16, padding: 16, boxShadow: "0 8px 24px -16px rgba(15,23,42,.25)", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>符合清单 Reconciliation · 派遣名单有、Arrived 表没有</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            大白话：这张清单就是文员每天要补的人，补一行到 Arrived 表，下次跑管线这行就自动消失。主数先不动，补完再算。下面只显示当前这家 agency 的人。
          </div>
        </div>
        <label style={{ fontSize: 13, color: "#334155", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyPriority} onChange={(e) => setOnlyPriority(e.target.checked)} />
          只看最像漏记的
        </label>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索姓名、工号、仓库、工种 Search"
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid #e2e8f0", padding: "10px 12px", marginTop: 12, fontSize: 14 }}
      />
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
          暂无符合清单数据 No reconciliation data yet. 管线产出 reconciliationDetail 数据集后这里自动显示。
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 6px" }}>姓名 Name</th>
                <th style={{ padding: "8px 6px" }}>工号 ID</th>
                <th style={{ padding: "8px 6px" }}>仓库 Warehouse</th>
                <th style={{ padding: "8px 6px" }}>派遣日期 Date</th>
                <th style={{ padding: "8px 6px" }}>工种 Job</th>
                <th style={{ padding: "8px 6px" }}>临时工当天状态 Temp status</th>
                <th style={{ padding: "8px 6px" }}>优先级 Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const p = priorityLabel(r.tempStatus);
                return (
                  <tr key={r.id + "-" + r.date + "-" + r.warehouse + "-" + i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px" }}>{r.name}</td>
                    <td style={{ padding: "8px 6px" }}>{r.id}</td>
                    <td style={{ padding: "8px 6px" }}>{r.warehouse}</td>
                    <td style={{ padding: "8px 6px" }}>{r.date}</td>
                    <td style={{ padding: "8px 6px" }}>{r.job}</td>
                    <td style={{ padding: "8px 6px" }}>{r.tempStatus || "当天无记录"}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.color, backgroundColor: p.bg, borderRadius: 9999, padding: "3px 8px", whiteSpace: "nowrap" }}>
                        {p.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>共 {filtered.length} 行 / {rows.length} 行 Showing {filtered.length} of {rows.length} rows.</div>
        </div>
      )}
    </div>
  );
}

export default function AgencyAnalysis({
  agencies,
  eoaByAgency = {},
  pendingByAgency = {},
  isSampleData = false,
  reconciliationRows = [],
  dailyByAgency = {},
  warehouseByAgency = {},
  jobByAgency = {},
  sentBackByReason = {},
}: {
  agencies: AgencyRow[];
  eoaByAgency?: Record<string, AgencyEOA>;
  pendingByAgency?: Record<string, number>;
  isSampleData?: boolean;
  reconciliationRows?: ReconciliationRow[];
  dailyByAgency?: Record<string, AgencyDailyPoint[]>;
  warehouseByAgency?: Record<string, AgencyWarehouseRow[]>;
  jobByAgency?: Record<string, AgencyJobRow[]>;
  sentBackByReason?: Record<string, SentBackReasonRow[]>;
}) {
  const sorted = useMemo(
    () => [...agencies].sort((a, b) => b.requested - a.requested),
    [agencies]
  );
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selected = sorted.find((a) => a.name === selectedName) ?? sorted[0] ?? null;
  const eoa = selected ? eoaByAgency[selected.name] : undefined;
  const pending = selected ? pendingByAgency[selected.name] ?? 0 : 0;
  const [from, to] = rateGradient(selected?.fulfillmentRate ?? null);
  const daily = selected ? dailyByAgency[selected.name] ?? [] : [];
  const warehouses = selected ? warehouseByAgency[selected.name] ?? [] : [];
  const jobs = selected ? jobByAgency[selected.name] ?? [] : [];
  const reasons = selected ? sentBackByReason[selected.name] ?? [] : [];
  const sentBackTotal = selected ? selected.sentBack : 0;
  const arrivedTotal = selected ? (selected.accepted ?? 0) + selected.noshow + sentBackTotal : 0;
  const sentBackRateArrived = arrivedTotal > 0 ? (sentBackTotal / arrivedTotal) * 100 : null;
  const sentBackRateIssued = selected && selected.requested > 0 ? (sentBackTotal / selected.requested) * 100 : null;
  const maxSentBackDaily = daily.reduce((m, d) => Math.max(m, d.sentBack ?? 0), 0);
  const warehousesWithRate = warehouses.filter((w) => w.fulfillmentRate !== null);
  const bestWarehouse = warehousesWithRate[0] ?? null;
  const worstWarehouse = warehousesWithRate.length > 0 ? warehousesWithRate[warehousesWithRate.length - 1] : null;
  const largestWarehouse = warehouses.length > 0
    ? [...warehouses].sort((a, b) => b.requested - a.requested)[0]
    : null;
  const maxAccepted = daily.reduce((m, d) => Math.max(m, d.accepted), 0);

  return (
    <div>
      <style>{CSS}</style>
      {isSampleData ? (
        <div style={{ marginBottom: 12, borderRadius: 12, padding: "10px 14px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: 13 }}>
          示例数据 Sample data · 结束与警告、待补录汇总暂用 9/1–9/15 实测，管线接通 agencyEOA 与符合清单数据集后自动替换为真实数据，页面主数（已发单 / 已派遣 / 已接受）已是真实数据集。
        </div>
      ) : null}

      {/* 切换 Agency 的按钮：点一下展开全部 agency，点一家整页跟着换 */}
      <div style={{ background: "#ffffff", borderRadius: 16, padding: 16, boxShadow: "0 8px 24px -16px rgba(15,23,42,.25)" }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>切换 Agency Switch Agency View · 下面整页只显示这一家的数据</div>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          style={{ width: "100%", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderRadius: 12, border: "1px solid #c7d2fe", background: "#eef2ff", padding: "12px 14px", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            {selected ? selected.name : "请选一家 Agency"}
          </span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {selected ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", background: `linear-gradient(135deg, ${from}, ${to})`, borderRadius: 9999, padding: "3px 8px", whiteSpace: "nowrap" }}>
                {formatPercent(selected.fulfillmentRate)}
              </span>
            ) : null}
            <span style={{ fontSize: 14, color: "#4f46e5", fontWeight: 700 }}>{dropdownOpen ? "收起 ▲" : "切换 ▾"}</span>
          </span>
        </button>
        {dropdownOpen ? (
          <div style={{ marginTop: 10, maxHeight: 320, overflowY: "auto", padding: 4 }}>
            {sorted.map((a) => {
              const [f, t] = rateGradient(a.fulfillmentRate);
              const p = pendingByAgency[a.name] ?? 0;
              return (
                <button
                  key={a.name}
                  type="button"
                  className={"agm-drop-item" + (selected?.name === a.name ? " active" : "")}
                  onClick={() => { setSelectedName(a.name); setDropdownOpen(false); }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{a.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", background: `linear-gradient(135deg, ${f}, ${t})`, borderRadius: 9999, padding: "3px 8px", whiteSpace: "nowrap" }}>
                      {formatPercent(a.fulfillmentRate)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    已接受 {formatNumber(a.accepted ?? 0)} / 已发单 {formatNumber(a.requested)}
                    {p > 0 ? <span style={{ color: "#d97706", fontWeight: 700 }}> · 待补录 {p} 人</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {!selected ? (
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 16 }}>请先在上面按钮里选一家供应商 Select an agency above.</div>
      ) : (
        <div key={selected.name} style={{ marginTop: 16 }}>
          <div className="agm-hero">
            <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.9 }}>机构分析 AGENCY ANALYSIS</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{selected.name}</div>
            <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>
              大白话：下面这整页都只是这家的数据，达成率是已接受除以已发单，结束数不进达成率，单独在下面看。
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>
              {formatPercent(selected.fulfillmentRate)}
              <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8 }}>达成率 Fulfillment Rate</span>
            </div>
          </div>

          <div className="agm-kpis" style={{ marginTop: 12 }}>
            {[
              { label: "已发单 Issued", value: formatNumber(selected.requested) },
              { label: "已派遣 Dispatched", value: formatNumber(selected.filled) },
              { label: "已接受 Accepted", value: formatNumber(selected.accepted ?? 0) },
              { label: "实际到场 Arrived", value: formatNumber(selected.actualArrived ?? 0) },
            ].map((c) => (
              <div key={c.label} className="agm-card">
                <div style={{ fontSize: 12, color: "#64748b" }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>首日结果 First-day outcome</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>No Show 没来</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(selected.noshow)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>被退回 Sent back</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(selected.sentBack)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#d97706", fontWeight: 700 }}>待补录 Pending</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>{formatNumber(pending)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
              派遣率 {formatPercent(selected.dispatchRate)} · 未派遣 {formatNumber(selected.unfilled)} 人次
            </div>
            <Bar pct={selected.fulfillmentRate ?? 0} from={from} to={to} />
            <div style={{ fontSize: 12, color: rateTextHex(selected.fulfillmentRate), marginTop: 6 }}>
              达成率 {formatPercent(selected.fulfillmentRate)} · 绿 ≥60% / 黄 40–60% / 红 &lt;40%，与供应商明细表同一套颜色。
            </div>
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>每日走势 Daily trend · 这家每天的已发单和已接受</div>
            {daily.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>暂无每日拆分数据 No daily data yet.</div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ maxWidth: 560, margin: "0 auto" }}>
                  <svg viewBox="0 0 560 140" style={{ width: "100%", height: "auto", display: "block" }}>
                    {daily.map((d, i) => {
                      const x = (560 / daily.length) * i + (560 / daily.length) * 0.15;
                      const w = (560 / daily.length) * 0.7;
                      const h = maxAccepted > 0 ? (d.accepted / maxAccepted) * 110 : 0;
                      return (
                        <g key={d.date}>
                          <rect x={x} y={130 - h} width={w} height={h} fill="#6366f1" rx={3}>
                          </rect>
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                    <span>{daily[0]?.date}</span>
                    <span>柱子 = 当天已接受</span>
                    <span>{daily[daily.length - 1]?.date}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                  共 {daily.length} 天 · 已发单合计 {formatNumber(daily.reduce((s, d) => s + d.requested, 0))} · 已接受合计 {formatNumber(daily.reduce((s, d) => s + d.accepted, 0))}
                </div>
              </div>
            )}
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>按仓库看这家 Warehouses for this agency</div>
            {warehouses.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>
                暂无按仓库拆分数据 No warehouse breakdown yet. 需要 allocDailySupplierWarehouse / arrivalTrackingDailySupplierWarehouse 数据集。
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {largestWarehouse ? `发单最多仓：${largestWarehouse.warehouse}（${formatNumber(largestWarehouse.requested)} 人次）` : ""}
                  {bestWarehouse ? ` · 达成率最高仓：${bestWarehouse.warehouse}（${formatPercent(bestWarehouse.fulfillmentRate)}）` : ""}
                  {worstWarehouse ? ` · 达成率最低仓：${worstWarehouse.warehouse}（${formatPercent(worstWarehouse.fulfillmentRate)}）` : ""}
                </div>
                <ScatterChart points={warehouses.map((w) => ({ label: w.warehouse, x: w.requested, y: w.fulfillmentRate, size: w.accepted ?? 0 }))} />
                <div style={{ marginTop: 10 }}>
                  {warehouses.map((w, i) => {
                    const [f, t] = rateGradient(w.fulfillmentRate);
                    return (
                      <div key={w.warehouse + "-" + i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: i === 0 ? "#ffffff" : "#334155", background: i === 0 ? "linear-gradient(135deg, #34d399, #059669)" : "#f1f5f9", border: i === 0 ? "none" : "1px solid #e2e8f0", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{w.warehouse}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: rateTextHex(w.fulfillmentRate) }}>{formatPercent(w.fulfillmentRate)}</span>
                          </div>
                          <Bar pct={w.fulfillmentRate ?? 0} from={f} to={t} />
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            已接受 {formatNumber(w.accepted ?? 0)} / 已发单 {formatNumber(w.requested)} · No Show {formatNumber(w.noshow)} · 被退回 {formatNumber(w.sentBack)}
                          </div>
                          {(() => {
                            const tot = (w.accepted ?? 0) + w.noshow + w.sentBack;
                            if (tot <= 0) return null;
                            return (
                              <div style={{ display: "flex", height: 6, borderRadius: 9999, overflow: "hidden", marginTop: 4, background: "#e2e8f0" }}>
                                <span style={{ width: `${((w.accepted ?? 0) / tot) * 100}%`, background: "#34d399" }} />
                                <span style={{ width: `${(w.noshow / tot) * 100}%`, background: "#fbbf24" }} />
                                <span style={{ width: `${(w.sentBack / tot) * 100}%`, background: "#fb7185" }} />
                              </div>
                            );
                          })()}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>到场构成：绿 = 已接受，黄 = No Show，红 = 被退回</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>按岗位看这家 Jobs for this agency · 每个岗位的达成率</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>达成率 = 已接受 ÷ 已发单，只算这家 agency，不拿全公司岗位数据冒充这家。</div>
            {jobs.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>
                暂无按岗位拆分数据 No job breakdown yet. 需要管线新增 alloc_daily_supplier_job / arrival_daily_supplier_job 两个数据集（见本页底部管线说明），跑完管线这里自动显示，不会拿全公司岗位数来充数。
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <ScatterChart points={jobs.map((j) => ({ label: j.job, x: j.requested, y: j.fulfillmentRate, size: j.accepted ?? 0 }))} />
                <div style={{ marginTop: 10 }}>
                  {jobs.map((j, i) => {
                    const [f, t] = rateGradient(j.fulfillmentRate);
                    return (
                      <div key={j.job + "-" + i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: i === 0 ? "#ffffff" : "#334155", background: i === 0 ? "linear-gradient(135deg, #34d399, #059669)" : "#f1f5f9", border: i === 0 ? "none" : "1px solid #e2e8f0", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{j.job}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: rateTextHex(j.fulfillmentRate) }}>{formatPercent(j.fulfillmentRate)}</span>
                          </div>
                          <Bar pct={j.fulfillmentRate ?? 0} from={f} to={t} />
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            已接受 {formatNumber(j.accepted ?? 0)} / 已发单 {formatNumber(j.requested)} · 已派遣 {formatNumber(j.filled)} · No Show {formatNumber(j.noshow)} · 被退回 {formatNumber(j.sentBack)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>被退回分析 Sent back analysis · 这家被退回了多少、为什么、发生在哪</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>被退回 Sent back</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#e11d48" }}>{formatNumber(sentBackTotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>占实际到场 Sent back ÷ Arrived</div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{formatPercent(sentBackRateArrived)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>占已发单 Sent back ÷ Issued</div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{formatPercent(sentBackRateIssued)}</div>
              </div>
            </div>
            <DonutChart segments={[
              { label: "已接受 Accepted", value: selected.accepted ?? 0, color: "#34d399" },
              { label: "No Show 没来", value: selected.noshow, color: "#fbbf24" },
              { label: "被退回 Sent back", value: sentBackTotal, color: "#fb7185" },
            ]} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 16 }}>被退回最多的仓 Sent back by warehouse</div>
            {warehouses.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>暂无按仓库被退回数据。</div>
            ) : (
              <div style={{ marginTop: 6 }}>
                {[...warehouses].sort((a, b) => b.sentBack - a.sentBack).slice(0, 5).map((w) => {
                  const maxSb = Math.max(...warehouses.map((x) => x.sentBack), 1);
                  return (
                    <div key={"sb-" + w.warehouse} style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span>{w.warehouse}</span>
                        <span style={{ fontWeight: 700, color: "#e11d48" }}>{formatNumber(w.sentBack)} 人次</span>
                      </div>
                      <Bar pct={(w.sentBack / maxSb) * 100} from="#fb7185" to="#e11d48" />
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 16 }}>被退回原因 Sent back reasons</div>
            {reasons.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                暂无按 agency 的被退回原因数据 No reason breakdown yet. 需要管线新增 arrival_daily_supplier_reason 数据集，跑完管线这里自动显示，不会拿全公司原因分布来充数。
              </div>
            ) : (
              <div style={{ marginTop: 6 }}>
                {reasons.map((r) => {
                  const maxR = Math.max(...reasons.map((x) => x.count), 1);
                  return (
                    <div key={r.reason} style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span>{r.reason}</span>
                        <span style={{ fontWeight: 700 }}>{formatNumber(r.count)} · {sentBackTotal > 0 ? ((r.count / sentBackTotal) * 100).toFixed(1) : "0.0"}%</span>
                      </div>
                      <Bar pct={(r.count / maxR) * 100} from="#fb7185" to="#e11d48" />
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 16 }}>被退回按日 Sent back by day</div>
            {daily.length === 0 || maxSentBackDaily <= 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>该统计周期内没有被退回记录，或每日被退回数据未产出。</div>
            ) : (
              <div style={{ maxWidth: 560, margin: "12px auto 0" }}>
                <svg viewBox="0 0 560 120" style={{ width: "100%", height: "auto", display: "block" }}>
                  {daily.map((d, i) => {
                    const x = (560 / daily.length) * i + (560 / daily.length) * 0.15;
                    const w = (560 / daily.length) * 0.7;
                    const h = (d.sentBack ?? 0) / maxSentBackDaily * 100;
                    return (
                      <rect key={d.date} x={x} y={110 - h} width={w} height={h} fill="#fb7185" rx={3}>
                      </rect>
                    );
                  })}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>{daily[0]?.date}</span>
                  <span>红柱 = 当天被退回</span>
                  <span>{daily[daily.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>

          <div className="agm-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>结束与警告 End of Assignment &amp; Warnings · 只算这家被结束的人</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              这部分来自删除 / 结束表，是后面的结束情况，不进首日达成率，别和上面的已接受、No Show 混在一起算。
            </div>
            {!eoa || eoa.total === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>该供应商暂无结束数据 No EOA data yet.</div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>结束 End of Assignment</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(eoa.ended)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>警告 Warnings</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(eoa.warnings)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>效率低 Low efficiency</span>
                    <span style={{ fontWeight: 700 }}>{formatNumber(eoa.lowEff)}</span>
                  </div>
                  <Bar pct={eoa.ended > 0 ? (eoa.lowEff / eoa.ended) * 100 : 0} from="#fb7185" to="#e11d48" />
                </div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>出勤差 Poor attendance</span>
                    <span style={{ fontWeight: 700 }}>{formatNumber(eoa.poorAtt)}</span>
                  </div>
                  <Bar pct={eoa.ended > 0 ? (eoa.poorAtt / eoa.ended) * 100 : 0} from="#fbbf24" to="#d97706" />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                  一条结束原因可能同时含效率低和出勤差，所以这两条不直接加总到结束人数。
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
            下面这张符合清单只显示这家 agency 的，点上面按钮换一家，下面就跟着换，不会把别家的人混进来。
          </div>
          <ReconciliationList
            rows={selected ? reconciliationRows.filter((r) => r.supplier === selected.name) : []}
          />
        </div>
      )}
    </div>
  );
}
