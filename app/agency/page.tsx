/* 覆盖到：app/agency/page.tsx
 *
 * 改名：Agency Meeting 已改成 Agency Analysis（机构分析），路由仍是 /agency 不变，旧链接不用改。
 * 切换：页面顶部有一个切换 Agency 的按钮，点开选一家，下面整页（主数、每日走势、按仓库、结束、符合清单）
 * 只显示这一家，换一家就跟着换。旧的 AgencyMeeting 组件不再用，改用 components/AgencyAnalysis.tsx。
 * 基础：照 supplier-v2.tsx 的写法（Sidebar + DateRangePicker + getDashboardData + dateRange），
 * 只新增 agency 视图，不改供应商页、仓库页。
 *
 * 数据：
 * - 主数用已有数据集：allocDailySupplier（已发单/已派遣）+ arrivalTrackingDailySupplier（到岗/NoShow/已接受）
 *   达成率 = 已接受 ÷ 已发单，与供应商页同口径；需求满足率（已接受 ÷ 需求）不在本页用，别混。
 * - EOA 与符合清单用新数据集（管线下一步产出，字段见下方 SAMPLE 的注释）：
 *   agencyEOA 行：供应商 | 结束人数 | 警告人数 | 效率低人数 | 出勤差人数
 *   reconciliationDetail 行：姓名 | 工号 | 供应商 | 仓库 | 派遣日期 | 工种 | 班次 | 临时工当天状态
 *   在管线接通前，本页用 9/1-9/15 实测的 EOA 汇总与符合清单汇总（按人）当示例，页面顶部会明标“示例数据”，
 *   管线产出后自动替换，示例代码可直接删掉 SAMPLE_EOA / SAMPLE_PENDING 两段。
 * - agency 别名对照（EOA 短名 → Arrived/派遣全名，管线里认供应商 ID 最好，名字只当显示）：
 *   CITI STAFF → CitiStaff Solutions；PROMPT → Prompt Priority INC；OSI → OSI Staffing Inc.；
 *   VOYAGE → Voyage Employer Services；One Source Inc → One Source Staffing Inc.；CSS → CSS Employment Group；
 *   PRIORITY WORKFORCE → Workforce Priority INC；GRANDE → GRANDE SOLUTIONS LLC-USCA；
 *   FAIRWAY → Fairway Staffing Service；iStaffing → iStaffing Partners Inc.；Direct Staffing → Direct Staffing LLC.
 *
 * 注意：符合清单已并进 components/AgencyAnalysis.tsx，不再单独从 "@/components/ReconciliationList" 引用，
 * 本地那个 ReconciliationList.tsx / AgencyMeeting.tsx 留着或删掉都不影响本页。
 * 侧边栏：只在你本地 Sidebar 的 navigation 里改一行，别整文件覆盖 Sidebar：
 *   原来那行 { name: "供应商会议 Agency Meeting", href: "/agency" }
 *   改成 { name: "机构分析 Agency Analysis", href: "/agency" }，位置仍在“供应商分析”后面，路由不变。
 */
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DateRangePicker from "@/components/DateRangePicker";
import AgencyAnalysis, { type AgencyRow, type AgencyEOA, type ReconciliationRow, type AgencyDailyPoint, type AgencyWarehouseRow, type AgencyJobRow, type SentBackReasonRow } from "@/components/AgencyAnalysis";
import { getDashboardData, type CsvRow } from "@/lib/data";
import { resolveRange, filterByDateRange, sumByKey, getSavedRange } from "@/lib/dateRange";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
function formatDateLabel(value: string) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
  });
}
function getValue(row: CsvRow, candidates: string[]) {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const exact = keys.find((k) => k === c);
    if (exact) return row[exact];
  }
  for (const c of candidates) {
    const partial = keys.find((k) => k.includes(c));
    if (partial) return row[partial];
  }
  return "";
}
function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/* 9/1-9/15 实测示例：EOA 汇总（结束/警告/效率低/出勤差），管线接通后删除 */
const SAMPLE_EOA: Record<string, AgencyEOA> = {
  "CitiStaff Solutions": { ended: 80, warnings: 10, lowEff: 38, poorAtt: 25, total: 90 },
  "Direct Staffing LLC.": { ended: 51, warnings: 0, lowEff: 30, poorAtt: 8, total: 51 },
  "Prompt Priority INC": { ended: 43, warnings: 2, lowEff: 22, poorAtt: 21, total: 45 },
  "OSI Staffing Inc.": { ended: 31, warnings: 0, lowEff: 15, poorAtt: 9, total: 31 },
  "Voyage Employer Services": { ended: 29, warnings: 0, lowEff: 17, poorAtt: 12, total: 29 },
  "One Source Staffing Inc.": { ended: 29, warnings: 0, lowEff: 16, poorAtt: 6, total: 29 },
  "CSS Employment Group": { ended: 21, warnings: 0, lowEff: 10, poorAtt: 11, total: 21 },
  "Workforce Priority INC": { ended: 17, warnings: 3, lowEff: 5, poorAtt: 11, total: 20 },
  "GRANDE SOLUTIONS LLC-USCA": { ended: 14, warnings: 1, lowEff: 3, poorAtt: 3, total: 15 },
  "Fairway Staffing Service": { ended: 10, warnings: 1, lowEff: 6, poorAtt: 3, total: 11 },
  "iStaffing Partners Inc.": { ended: 7, warnings: 0, lowEff: 7, poorAtt: 0, total: 7 },
};
/* 9/1-9/15 实测示例：符合清单汇总（按人，派遣有、Arrived 无），管线接通后删除 */
const SAMPLE_PENDING: Record<string, number> = {
  "CitiStaff Solutions": 11,
  "Direct Staffing LLC.": 15,
  "Prompt Priority INC": 2,
  "Voyage Employer Services": 1,
  "GRANDE SOLUTIONS LLC-USCA": 1,
  "CSS Employment Group": 0,
  "Workforce Priority INC": 5,
  "Fairway Staffing Service": 2,
  "OSI Staffing Inc.": 5,
  "One Source Staffing Inc.": 4,
  "iStaffing Partners Inc.": 4,
};

export default async function AgencyPage({ searchParams }: any) {
  const params = (await searchParams) ?? {};
  const saved = await getSavedRange();
  const startParam = typeof params.start === "string" ? params.start : saved.start;
  const endParam = typeof params.end === "string" ? params.end : saved.end;

  const data: any = getDashboardData();
  const allocRows = ((data.allocDailySupplier ?? []) as CsvRow[]);
  const atRows = ((data.arrivalTrackingDailySupplier ?? []) as CsvRow[]);
  const demandRows = ((data.demandDaily ?? []) as CsvRow[]);
  const allocDailyRows = ((data.allocDaily ?? []) as CsvRow[]);
  const { start, end, min, max } = resolveRange(
    [
      ...allocRows.map((r) => getValue(r, ["日期"])),
      ...atRows.map((r) => getValue(r, ["日期"])),
      ...demandRows.map((r) => getValue(r, ["日期"])),
      ...allocDailyRows.map((r) => getValue(r, ["日期"])),
    ],
    startParam,
    endParam
  );

  const allocBySup = new Map<string, Record<string, unknown>>(
    sumByKey(filterByDateRange(allocRows, start, end), "供应商",
      ["已发单人数", "已派遣人数", "未派遣人数"])
      .map((r) => [String(r["供应商"]), r])
  );
  const atBySup = new Map<string, Record<string, unknown>>(
    sumByKey(filterByDateRange(atRows, start, end), "供应商",
      ["到岗人次", "NoShow人次", "已接受人次"])
      .map((r) => [String(r["供应商"]), r])
  );

  const agencies: AgencyRow[] = [...allocBySup.keys()]
    .map((name) => {
      const a = allocBySup.get(name)!;
      const at = atBySup.get(name);
      const requested = num(a["已发单人数"]);
      const filled = num(a["已派遣人数"]);
      const total = at ? num(at["到岗人次"]) : 0;
      const noshow = at ? num(at["NoShow人次"]) : 0;
      const actualArrived = at ? total - noshow : null;
      const accepted = at ? num(at["已接受人次"]) : null;
      const sentBack = actualArrived !== null && accepted !== null
        ? Math.max(actualArrived - accepted, 0) : 0;
      return {
        name,
        requested,
        filled,
        unfilled: Math.max(requested - filled, 0),
        dispatchRate: requested > 0 ? (filled / requested) * 100 : 0,
        actualArrived,
        accepted,
        fulfillmentRate: accepted !== null && requested > 0 ? (accepted / requested) * 100 : null,
        noshow,
        sentBack,
      };
    })
    .filter((s) => s.name !== "未分类")
    .sort((a, b) => b.requested - a.requested);

  /* 每个 agency 的每日走势：已发单 / 已接受，按日期汇总 */
  const dailyByAgency: Record<string, AgencyDailyPoint[]> = {};
  {
    const allocDaily = new Map<string, number>();
    for (const r of filterByDateRange(allocRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const date = String(getValue(r, ["日期"]) || "");
      if (!sup || sup === "未分类" || !date) continue;
      allocDaily.set(sup + "|" + date, (allocDaily.get(sup + "|" + date) ?? 0) + num(getValue(r, ["已发单人数"])));
    }
    const atDaily = new Map<string, number>();
    const sbDaily = new Map<string, number>();
    for (const r of filterByDateRange(atRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const date = String(getValue(r, ["日期"]) || "");
      if (!sup || sup === "未分类" || !date) continue;
      atDaily.set(sup + "|" + date, (atDaily.get(sup + "|" + date) ?? 0) + num(getValue(r, ["已接受人次"])));
      const sb = getValue(r, ["被退回人次"]);
      sbDaily.set(sup + "|" + date, (sbDaily.get(sup + "|" + date) ?? 0) + (sb !== "" ? num(sb) : Math.max(num(getValue(r, ["到岗人次"])) - num(getValue(r, ["NoShow人次"])) - num(getValue(r, ["已接受人次"])), 0)));
    }
    const sups = new Set<string>([...allocDaily.keys(), ...atDaily.keys()].map((k) => k.split("|")[0]));
    for (const sup of sups) {
      const dates = [...new Set([...allocDaily.keys(), ...atDaily.keys()].filter((k) => k.startsWith(sup + "|")).map((k) => k.split("|")[1]))].sort();
      dailyByAgency[sup] = dates.map((date) => ({
        date,
        requested: allocDaily.get(sup + "|" + date) ?? 0,
        accepted: atDaily.get(sup + "|" + date) ?? 0,
        sentBack: sbDaily.get(sup + "|" + date) ?? 0,
      }));
    }
  }

  /* 每个 agency 的按岗位拆分：需要管线新数据集，缺了就空数组，页面不报错 */
  const jobByAgency: Record<string, AgencyJobRow[]> = {};
  {
    const allocJobRows = ((data.allocDailySupplierJob ?? []) as CsvRow[]);
    const atJobRows = ((data.arrivalDailySupplierJob ?? []) as CsvRow[]);
    type JAcc = { requested: number; filled: number; total: number; noshow: number; accepted: number; sentBack: number };
    const acc = new Map<string, JAcc>();
    const getAcc = (k: string) => {
      const a = acc.get(k) ?? { requested: 0, filled: 0, total: 0, noshow: 0, accepted: 0, sentBack: 0 };
      acc.set(k, a);
      return a;
    };
    for (const r of filterByDateRange(allocJobRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const job = String(getValue(r, ["工种"]) || "");
      if (!sup || sup === "未分类" || !job || job === "未分类") continue;
      const a = getAcc(sup + "|" + job);
      a.requested += num(getValue(r, ["已发单人数"]));
      a.filled += num(getValue(r, ["已派遣人数"]));
    }
    for (const r of filterByDateRange(atJobRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const job = String(getValue(r, ["工种"]) || "");
      if (!sup || sup === "未分类" || !job || job === "未分类") continue;
      const a = getAcc(sup + "|" + job);
      const tot = num(getValue(r, ["到岗人次"]));
      const ns = num(getValue(r, ["NoShow人次"]));
      const ac = num(getValue(r, ["已接受人次"]));
      a.total += tot;
      a.noshow += ns;
      a.accepted += ac;
      const sb = getValue(r, ["被退回人次"]);
      a.sentBack += sb !== "" ? num(sb) : Math.max(tot - ns - ac, 0);
    }
    for (const [k, a] of acc) {
      const [sup, job] = k.split("|");
      const actualArrived = a.total > 0 ? a.total - a.noshow : null;
      const row: AgencyJobRow = {
        job,
        requested: a.requested,
        filled: a.filled,
        accepted: a.total > 0 ? a.accepted : null,
        actualArrived,
        noshow: a.noshow,
        sentBack: a.sentBack,
        fulfillmentRate: a.requested > 0 && a.total > 0 ? (a.accepted / a.requested) * 100 : null,
      };
      if (!jobByAgency[sup]) jobByAgency[sup] = [];
      jobByAgency[sup].push(row);
    }
    for (const sup of Object.keys(jobByAgency)) {
      jobByAgency[sup].sort((x, y) => (y.fulfillmentRate ?? -1) - (x.fulfillmentRate ?? -1) || y.requested - x.requested);
    }
  }

  /* 每个 agency 的被退回原因：需要管线新数据集，缺了就空数组，页面不报错 */
  const sentBackByReason: Record<string, SentBackReasonRow[]> = {};
  {
    const reasonRows = ((data.arrivalDailySupplierReason ?? []) as CsvRow[]);
    const acc = new Map<string, number>();
    for (const r of filterByDateRange(reasonRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const reason = String(getValue(r, ["不符合要求原因"]) || "");
      if (!sup || sup === "未分类" || !reason) continue;
      acc.set(sup + "|" + reason, (acc.get(sup + "|" + reason) ?? 0) + num(getValue(r, ["人次"])));
    }
    for (const [k, v] of acc) {
      const idx = k.indexOf("|");
      const sup = k.slice(0, idx);
      const reason = k.slice(idx + 1);
      if (!sentBackByReason[sup]) sentBackByReason[sup] = [];
      sentBackByReason[sup].push({ reason, count: v });
    }
    for (const sup of Object.keys(sentBackByReason)) {
      sentBackByReason[sup].sort((a, b) => b.count - a.count);
    }
  }

  /* 每个 agency 的按仓库拆分：发单侧仓名 + 到岗侧仓名按编号+括号后缀归一化（与仓库页同法） */
  const warehouseKey = (name: string): string => {
    const n = name.match(/(\d+)/)?.[1] ?? "";
    let s = name.match(/\(([^)]+)\)/)?.[1]?.toUpperCase().trim() ?? "";
    if (s === "中邮") s = "CP";
    return `${n}|${s}`;
  };
  const warehouseByAgency: Record<string, AgencyWarehouseRow[]> = {};
  {
    const allocCrossRows = ((data.allocDailySupplierWarehouse ?? []) as CsvRow[]);
    const atCrossRows = ((data.arrivalTrackingDailySupplierWarehouse ?? []) as CsvRow[]);
    type WAcc = { display: string; requested: number; filled: number; total: number; noshow: number; accepted: number; sentBack: number };
    const acc = new Map<string, WAcc>();
    const keyOf = (sup: string, wh: string) => sup + "|" + warehouseKey(wh);
    for (const r of filterByDateRange(allocCrossRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const wh = String(getValue(r, ["仓库"]) || "");
      if (!sup || sup === "未分类" || !wh || wh === "未分类") continue;
      const k = keyOf(sup, wh);
      const a = acc.get(k) ?? { display: wh, requested: 0, filled: 0, total: 0, noshow: 0, accepted: 0, sentBack: 0 };
      a.requested += num(getValue(r, ["已发单人数"]));
      a.filled += num(getValue(r, ["已派遣人数"]));
      acc.set(k, a);
    }
    const atByKey = new Map<string, WAcc>();
    const atByNum = new Map<string, WAcc>();
    const pushAt = (map: Map<string, WAcc>, k: string, r: CsvRow) => {
      const a = map.get(k) ?? { display: "", requested: 0, filled: 0, total: 0, noshow: 0, accepted: 0, sentBack: 0 };
      a.total += num(getValue(r, ["到岗人次"]));
      a.noshow += num(getValue(r, ["NoShow人次"]));
      a.accepted += num(getValue(r, ["已接受人次"]));
      a.sentBack += num(getValue(r, ["被退回人次"]));
      map.set(k, a);
    };
    for (const r of filterByDateRange(atCrossRows, start, end)) {
      const sup = String(getValue(r, ["供应商"]) || "");
      const wh = String(getValue(r, ["仓库"]) || "");
      if (!sup || sup === "未分类" || !wh || wh === "未分类") continue;
      pushAt(atByKey, keyOf(sup, wh), r);
      pushAt(atByNum, sup + "|" + (wh.match(/(\d+)/)?.[1] ?? ""), r);
    }
    for (const [k, a] of acc) {
      const [sup] = k.split("|");
      const at = atByKey.get(k) ?? atByNum.get(sup + "|" + (k.split("|")[1]?.split("|")[0] ?? "")) ?? null;
      const accepted = at ? at.accepted : null;
      const actualArrived = at ? at.total - at.noshow : null;
      const row: AgencyWarehouseRow = {
        warehouse: a.display,
        requested: a.requested,
        filled: a.filled,
        accepted,
        actualArrived,
        noshow: at ? at.noshow : 0,
        sentBack: at ? at.sentBack : 0,
        fulfillmentRate: accepted !== null && a.requested > 0 ? (accepted / a.requested) * 100 : null,
      };
      if (!warehouseByAgency[sup]) warehouseByAgency[sup] = [];
      warehouseByAgency[sup].push(row);
    }
    for (const sup of Object.keys(warehouseByAgency)) {
      warehouseByAgency[sup].sort((x, y) => (y.fulfillmentRate ?? -1) - (x.fulfillmentRate ?? -1) || y.requested - x.requested);
    }
  }

  /* 新数据集：有就用真实的，没有就用示例（页面会明标示例数据） */
  const eoaRows = (data.agencyEOA ?? []) as CsvRow[];
  const eoaByAgency: Record<string, AgencyEOA> = { ...SAMPLE_EOA };
  let isSampleData = true;
  if (eoaRows.length > 0) {
    isSampleData = false;
    for (const r of eoaRows) {
      const name = String(getValue(r, ["供应商"]) || "");
      if (!name) continue;
      const ended = num(getValue(r, ["结束人数"]));
      const warnings = num(getValue(r, ["警告人数"]));
      eoaByAgency[name] = {
        ended,
        warnings,
        lowEff: num(getValue(r, ["效率低人数"])),
        poorAtt: num(getValue(r, ["出勤差人数"])),
        total: ended + warnings,
      };
    }
  }
  const reconRows = (data.reconciliationDetail ?? []) as CsvRow[];
  const reconciliation: ReconciliationRow[] = reconRows.map((r) => ({
    name: String(getValue(r, ["姓名"]) || ""),
    id: String(getValue(r, ["工号"]) || ""),
    supplier: String(getValue(r, ["供应商"]) || ""),
    warehouse: String(getValue(r, ["仓库"]) || ""),
    date: String(getValue(r, ["派遣日期"]) || ""),
    job: String(getValue(r, ["工种"]) || ""),
    shift: String(getValue(r, ["班次"]) || ""),
    tempStatus: String(getValue(r, ["临时工当天状态"]) || ""),
  }));
  const pendingByAgency: Record<string, number> = { ...SAMPLE_PENDING };
  if (reconRows.length > 0) {
    isSampleData = false;
    for (const r of reconciliation) pendingByAgency[r.supplier] = (pendingByAgency[r.supplier] ?? 0) + 1;
    /* 真实明细到手后，示例汇总要清掉重算，避免示例和真实混在一起 */
    for (const k of Object.keys(SAMPLE_PENDING)) {
      if (!reconciliation.some((x) => x.supplier === k)) pendingByAgency[k] = 0;
    }
  }

  const totalAccepted = agencies.reduce((s, x) => s + (x.accepted ?? 0), 0);
  const totalRequested = agencies.reduce((s, x) => s + x.requested, 0);

  return (
    /* 外层格式照 supplier 页原样抄：它在你本地是能跑的，class 全是本地已生成的，
       不再自己发明 264px 这种新任意值。 */
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <main className="lg:pl-[250px]">
        <div className="px-5 py-7 md:px-8">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              机构分析 Agency Analysis
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              大白话：上面点切换 Agency 的按钮选一家，下面整页就只分析这一家：主数、每日走势、按仓库、结束、符合清单，换一家就跟着换。达成率是已接受除以已发单，结束数不进达成率。
              统计周期 Reporting Period：{formatDateLabel(start)} – {formatDateLabel(end)} · 已接受合计 {formatNumber(totalAccepted)} / 已发单合计 {formatNumber(totalRequested)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DateRangePicker min={min} max={max} start={start} end={end} />
            <Link href="/supplier" style={{ fontSize: 13, color: "#4f46e5", textDecoration: "none" }}>
              回供应商分析 →
            </Link>
          </div>
        </div>

        {agencies.length === 0 ? (
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, marginTop: 16, fontSize: 14, color: "#64748b" }}>
            该统计周期内没有供应商数据 No agency data in this period. 请先检查统计周期或管线是否已产出 allocDailySupplier / arrivalTrackingDailySupplier。
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <AgencyAnalysis
              agencies={agencies}
              eoaByAgency={eoaByAgency}
              pendingByAgency={pendingByAgency}
              isSampleData={isSampleData}
              reconciliationRows={reconciliation}
              dailyByAgency={dailyByAgency}
              warehouseByAgency={warehouseByAgency}
              jobByAgency={jobByAgency}
              sentBackByReason={sentBackByReason}
            />
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
