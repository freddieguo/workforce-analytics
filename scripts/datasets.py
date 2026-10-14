"""
datasets.py — 由干净记录构建 dashboard.json 的数据集

口径说明（对照前端页面实际用法）：
  - demand:               需求池明细，一行一条需求（日期+仓+组+工种+班次）。
                          「需求总人数」= 本行需求人数，首页 sumColumn 直接加总即为总需求人数。
  - supplier_allocation:  发单明细，一行一条供应商分配。
                          供应商需派遣人数 = 已发单人数（分给该供应商的人数），
                          供应商已派遣人数 = 已派遣人数，供应商未派遣人数 = 待派遣人数。
  - missing_supplier_allocation:
                          待发单人数 > 0 的需求行，即还没分给任何供应商的需求。
  - supplier_summary / supplier_warehouse / supplier_job:
                          由 supplier_allocation 按供应商 / 供应商×仓库 / 供应商×工种汇总。
  - warehouse_summary / warehouse_job:
                          由 demand 按仓库 / 仓库×工种汇总。
  - arrival_tracking_*:   人员到岗表（用户口径：NO SHOW 未勾选=到岗；
                          到岗且无原因=已接受）。实际到场 = 到岗人次 − NoShow人次。
  - match_*_arrival:      发单详情（已派遣）× 到岗表（实到），到岗率 = 实到 ÷ 已派遣。

  按天数据集（*_daily / demand_daily_* / alloc_daily_*）：
  前端日期筛选的底料。每个指标按它自己的日期维度汇总：
  需求/已发单/已派遣按「需求日期」，到岗/已接受/被退回按「到岗日期」。
  前端选了日期范围后，把范围内每天的行加总即得该范围的数。

  已删除（2026-10-13 用户决定）：
  OT 分析（考勤表）、试工不通过（临时工派遣表，改用人员到岗表的
  被退回口径）、派遣人员名单（无分析页使用）。

去重规则：
  同一文件内、跨文件之间，可能出现主键相同的行（重复导出或新旧快照），
  保留最后出现的一行；主键相同但数字不一致时记 warning，不做加总
  （加总会把同一批人算两遍——实测 2026-09-29 洛杉矶17号仓包装组普工
  的新旧两版，加总会得到 8，与需求详情的已发单 5 对不上）。
  发单详情例外：用户要求（2026-10-06）按 Excel 原始求和，不去重。
  文件级重复由 common.load_raw 的内容哈希拦截。
"""

from collections import defaultdict

from common import warn


# ------------------------------------------------------------------
# 去重
# ------------------------------------------------------------------

def dedupe(rows, key_fields, num_fields, label):
    """
    按 key_fields 去重。主键是业务上的天然唯一键
    （一条需求 / 一条供应商分配），所以主键相同但数字不一致
    时视为同一行的新旧快照，保留最后出现的（最新）一行，
    而不是加总——加总会把同一批人算两遍。
    """
    grouped = {}
    for r in rows:
        key = tuple(r.get(f, "") for f in key_fields)
        if key not in grouped:
            grouped[key] = dict(r)
        else:
            old = grouped[key]
            if any(old.get(f) != r.get(f) for f in num_fields):
                old_nums = "/".join(str(old.get(f)) for f in num_fields)
                new_nums = "/".join(str(r.get(f)) for f in num_fields)
                warn(f"{label} 同一主键出现新旧两个版本，"
                     f"已取最后出现的: {key} ({old_nums} -> {new_nums})")
                grouped[key] = dict(r)
    return list(grouped.values())


DEMAND_KEY = ["需求区域", "需求仓", "需求组", "需求日期", "工种", "班次", "关联申请编号"]
DEMAND_NUM = ["需求人数", "待发单人数", "已发单人数", "待派遣人数", "已派遣人数"]

ALLOC_KEY = ["需求区域", "需求仓", "需求组", "需求日期", "工种", "班次", "供应商"]
ALLOC_NUM = ["供应商需派遣人数", "供应商未派遣人数", "供应商已派遣人数"]


# ------------------------------------------------------------------
# demand / missing_supplier_allocation
# ------------------------------------------------------------------

DEMAND_COLUMNS = ["需求区域", "需求仓", "需求组", "需求日期", "工种", "原始工种",
                  "班次", "需求人数", "需求总人数", "待发单人数", "已发单人数",
                  "待派遣人数", "已派遣人数", "用工要求", "关联申请编号"]


def build_demand(raw):
    rows = dedupe(raw["demand"], DEMAND_KEY, DEMAND_NUM, "需求详情")
    out = []
    for r in rows:
        out.append({
            "需求区域": r["需求区域"],
            "需求仓": r["需求仓"],
            "需求组": r["需求组"],
            "需求日期": r["需求日期"],
            "工种": r["工种"],
            "原始工种": r["原始工种"],
            "班次": r["班次"],
            "需求人数": r["需求人数"],
            # 首页 totalDemand = sum(需求总人数)；每行独立需求，行值即人数
            "需求总人数": r["需求人数"],
            "待发单人数": r["待发单人数"],
            "已发单人数": r["已发单人数"],
            "待派遣人数": r["待派遣人数"],
            "已派遣人数": r["已派遣人数"],
            "用工要求": r["用工要求"],
            "关联申请编号": r["关联申请编号"],
        })
    out.sort(key=lambda r: (r["需求日期"], r["需求仓"], r["需求组"], r["工种"]))
    return DEMAND_COLUMNS, out


MISSING_SUPPLIER_COLUMNS = ["需求日期", "需求区域", "需求仓", "需求组", "工种",
                            "原始工种", "班次", "关联申请编号",
                            "供应商请求人数", "供应商已派遣人数", "供应商未派遣人数"]


def build_missing_supplier(demand_rows):
    """待发单人数 > 0 的需求：还没归属到任何供应商的需求人数"""
    out = []
    for r in demand_rows:
        if r["待发单人数"] > 0:
            out.append({
                "需求日期": r["需求日期"],
                "需求区域": r["需求区域"],
                "需求仓": r["需求仓"],
                "需求组": r["需求组"],
                "工种": r["工种"],
                "原始工种": r["原始工种"],
                "班次": r["班次"],
                "关联申请编号": r["关联申请编号"],
                "供应商请求人数": r["待发单人数"],
                "供应商已派遣人数": 0,
                "供应商未派遣人数": r["待发单人数"],
            })
    return MISSING_SUPPLIER_COLUMNS, out


# ------------------------------------------------------------------
# supplier_allocation 及其汇总
# ------------------------------------------------------------------

ALLOC_COLUMNS = ["供应商", "供应商名称", "供应商ID", "类型", "需求区域", "需求仓",
                 "需求组", "需求日期", "工种", "原始工种", "班次",
                 "供应商需派遣人数", "供应商未派遣人数", "供应商已派遣人数", "用工要求"]


def build_allocation(raw):
    # 用户要求（2026-10-06）：按 Excel 原始求和显示，不去重
    # （之前 dedupe 去掉了 2 行，导致已发单 2457/已派遣 1404，
    # 用户要原始的 2460/1406）
    rows = raw["alloc"]
    out = [{c: r.get(c, "") for c in ALLOC_COLUMNS} for r in rows]
    out.sort(key=lambda r: (r["需求日期"], r["供应商"], r["需求仓"]))
    return ALLOC_COLUMNS, out


SUPPLIER_SUMMARY_COLUMNS = ["供应商", "需求人数", "已派遣人数", "未派遣人数", "分配次数"]


def build_supplier_summary(alloc_rows):
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0,
                                "未派遣人数": 0, "分配次数": 0})
    for r in alloc_rows:
        name = r["供应商"] or "未分类"
        a = agg[name]
        a["需求人数"] += r["供应商需派遣人数"]
        a["已派遣人数"] += r["供应商已派遣人数"]
        a["未派遣人数"] += r["供应商未派遣人数"]
        a["分配次数"] += 1
    out = [{"供应商": k, **v} for k, v in agg.items()]
    out.sort(key=lambda r: -r["需求人数"])
    return SUPPLIER_SUMMARY_COLUMNS, out


SUPPLIER_WAREHOUSE_COLUMNS = ["供应商", "需求仓", "需求人数", "已派遣人数"]


def build_supplier_warehouse(alloc_rows):
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0})
    for r in alloc_rows:
        key = (r["供应商"] or "未分类", r["需求仓"] or "未分类")
        a = agg[key]
        a["需求人数"] += r["供应商需派遣人数"]
        a["已派遣人数"] += r["供应商已派遣人数"]
    out = [{"供应商": k[0], "需求仓": k[1], **v} for k, v in agg.items()]
    out.sort(key=lambda r: -r["需求人数"])
    return SUPPLIER_WAREHOUSE_COLUMNS, out


WAREHOUSE_ALLOC_COLUMNS = ["仓库", "需求人数", "已派遣人数", "未派遣人数"]


def build_warehouse_alloc_summary(alloc_rows):
    """发单详情按需求仓汇总：需求人数=已发单，已派遣人数=已派遣"""
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0})
    for r in alloc_rows:
        wh = r["需求仓"] or "未分类"
        a = agg[wh]
        a["需求人数"] += r["供应商需派遣人数"]
        a["已派遣人数"] += r["供应商已派遣人数"]
    out = []
    for wh, v in agg.items():
        out.append({
            "仓库": wh,
            "需求人数": v["需求人数"],
            "已派遣人数": v["已派遣人数"],
            "未派遣人数": max(v["需求人数"] - v["已派遣人数"], 0),
        })
    out.sort(key=lambda r: -r["需求人数"])
    return WAREHOUSE_ALLOC_COLUMNS, out


JOB_DEMAND_COLUMNS = ["工种", "需求人数"]


def build_job_demand_summary(demand_rows):
    """需求池按工种汇总需求人数"""
    agg = defaultdict(int)
    for r in demand_rows:
        job = r["工种"] or "未分类"
        agg[job] += r["需求人数"] or 0
    out = [{"工种": job, "需求人数": v} for job, v in agg.items()]
    out.sort(key=lambda r: -r["需求人数"])
    return JOB_DEMAND_COLUMNS, out


JOB_ALLOC_COLUMNS = ["工种", "需求人数", "已派遣人数", "未派遣人数"]


def build_job_alloc_summary(alloc_rows):
    """发单详情按工种汇总：需求人数=已发单，已派遣人数=已派遣"""
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0})
    for r in alloc_rows:
        job = r["工种"] or "未分类"
        a = agg[job]
        a["需求人数"] += r["供应商需派遣人数"]
        a["已派遣人数"] += r["供应商已派遣人数"]
    out = []
    for job, v in agg.items():
        out.append({
            "工种": job,
            "需求人数": v["需求人数"],
            "已派遣人数": v["已派遣人数"],
            "未派遣人数": max(v["需求人数"] - v["已派遣人数"], 0),
        })
    out.sort(key=lambda r: -r["需求人数"])
    return JOB_ALLOC_COLUMNS, out


SUPPLIER_JOB_COLUMNS = ["供应商", "工种", "原始工种", "需求人数", "已派遣人数"]


def build_supplier_job(alloc_rows):
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0, "原始工种": set()})
    for r in alloc_rows:
        key = (r["供应商"] or "未分类", r["工种"] or "未分类")
        a = agg[key]
        a["需求人数"] += r["供应商需派遣人数"]
        a["已派遣人数"] += r["供应商已派遣人数"]
        if r["原始工种"]:
            a["原始工种"].add(r["原始工种"])
    out = []
    for (sup, job), v in agg.items():
        out.append({
            "供应商": sup,
            "工种": job,
            "原始工种": " / ".join(sorted(v["原始工种"])),
            "需求人数": v["需求人数"],
            "已派遣人数": v["已派遣人数"],
        })
    out.sort(key=lambda r: -r["需求人数"])
    return SUPPLIER_JOB_COLUMNS, out


# ------------------------------------------------------------------
# warehouse 汇总（由 demand 汇总）
# ------------------------------------------------------------------

WAREHOUSE_SUMMARY_COLUMNS = ["需求仓", "需求人数", "已派遣人数", "未派遣人数", "分配次数"]


def build_warehouse_summary(demand_rows, alloc_rows):
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0, "分配次数": 0})
    for r in demand_rows:
        wh = r["需求仓"] or "未分类"
        a = agg[wh]
        a["需求人数"] += r["需求人数"]
        a["已派遣人数"] += r["已派遣人数"]
    for r in alloc_rows:
        wh = r["需求仓"] or "未分类"
        agg[wh]["分配次数"] += 1
    out = []
    for wh, v in agg.items():
        out.append({
            "需求仓": wh,
            "需求人数": v["需求人数"],
            "已派遣人数": v["已派遣人数"],
            "未派遣人数": max(v["需求人数"] - v["已派遣人数"], 0),
            "分配次数": v["分配次数"],
        })
    out.sort(key=lambda r: -r["需求人数"])
    return WAREHOUSE_SUMMARY_COLUMNS, out


WAREHOUSE_JOB_COLUMNS = ["需求仓", "工种", "原始工种", "需求人数", "已派遣人数", "未派遣人数"]


def build_warehouse_job(demand_rows):
    agg = defaultdict(lambda: {"需求人数": 0, "已派遣人数": 0, "原始工种": set()})
    for r in demand_rows:
        key = (r["需求仓"] or "未分类", r["工种"] or "未分类")
        a = agg[key]
        a["需求人数"] += r["需求人数"]
        a["已派遣人数"] += r["已派遣人数"]
        if r["原始工种"]:
            a["原始工种"].add(r["原始工种"])
    out = []
    for (wh, job), v in agg.items():
        out.append({
            "需求仓": wh,
            "工种": job,
            "原始工种": " / ".join(sorted(v["原始工种"])),
            "需求人数": v["需求人数"],
            "已派遣人数": v["已派遣人数"],
            "未派遣人数": max(v["需求人数"] - v["已派遣人数"], 0),
        })
    out.sort(key=lambda r: -r["需求人数"])
    return WAREHOUSE_JOB_COLUMNS, out


# ------------------------------------------------------------------
# 按天数据集：前端日期筛选的底料
# ------------------------------------------------------------------
# 每个指标按它自己的日期维度汇总：
#   需求 / 已发单 / 已派遣 -> 需求日期
#   拟到岗 / 实际到场 / 已接受 / NoShow / 被退回 -> 到岗日期
# 前端选了日期范围后，把范围内每天的行加总即得该范围的数。

DEMAND_DAILY_COLUMNS = ["日期", "需求人数"]
DEMAND_DAILY_JOB_COLUMNS = ["日期", "工种", "需求人数"]
ALLOC_DAILY_COLUMNS = ["日期", "已发单人数", "已派遣人数", "未派遣人数"]
ALLOC_DAILY_SUPPLIER_COLUMNS = ["日期", "供应商", "已发单人数", "已派遣人数", "未派遣人数"]
ALLOC_DAILY_WAREHOUSE_COLUMNS = ["日期", "仓库", "已发单人数", "已派遣人数", "未派遣人数"]
ALLOC_DAILY_JOB_COLUMNS = ["日期", "工种", "已发单人数", "已派遣人数", "未派遣人数"]


def build_demand_daily(demand_rows):
    """需求人数按需求日期汇总"""
    agg = defaultdict(int)
    for r in demand_rows:
        agg[r["需求日期"] or "未分类"] += r["需求人数"] or 0
    out = [{"日期": d, "需求人数": v} for d, v in sorted(agg.items())]
    return DEMAND_DAILY_COLUMNS, out


def build_demand_daily_job(demand_rows):
    """需求人数按需求日期×工种汇总"""
    agg = defaultdict(int)
    for r in demand_rows:
        agg[(r["需求日期"] or "未分类", r["工种"] or "未分类")] += r["需求人数"] or 0
    out = [{"日期": k[0], "工种": k[1], "需求人数": v}
           for k, v in sorted(agg.items())]
    return DEMAND_DAILY_JOB_COLUMNS, out


def _alloc_daily_agg(alloc_rows, key_fn):
    agg = defaultdict(lambda: {"已发单人数": 0, "已派遣人数": 0, "未派遣人数": 0})
    for r in alloc_rows:
        a = agg[key_fn(r)]
        a["已发单人数"] += r["供应商需派遣人数"] or 0
        a["已派遣人数"] += r["供应商已派遣人数"] or 0
        a["未派遣人数"] += r["供应商未派遣人数"] or 0
    return agg


def build_alloc_daily(alloc_rows):
    """已发单/已派遣按需求日期汇总"""
    agg = _alloc_daily_agg(alloc_rows, lambda r: r["需求日期"] or "未分类")
    out = [{"日期": d, **v} for d, v in sorted(agg.items())]
    return ALLOC_DAILY_COLUMNS, out


def build_alloc_daily_supplier(alloc_rows):
    """已发单/已派遣按需求日期×供应商汇总"""
    agg = _alloc_daily_agg(
        alloc_rows,
        lambda r: (r["需求日期"] or "未分类", r["供应商"] or "未分类"))
    out = [{"日期": k[0], "供应商": k[1], **v} for k, v in sorted(agg.items())]
    return ALLOC_DAILY_SUPPLIER_COLUMNS, out


def build_alloc_daily_warehouse(alloc_rows):
    """已发单/已派遣按需求日期×仓库汇总"""
    agg = _alloc_daily_agg(
        alloc_rows,
        lambda r: (r["需求日期"] or "未分类", r["需求仓"] or "未分类"))
    out = [{"日期": k[0], "仓库": k[1], **v} for k, v in sorted(agg.items())]
    return ALLOC_DAILY_WAREHOUSE_COLUMNS, out


def build_alloc_daily_job(alloc_rows):
    """已发单/已派遣按需求日期×工种汇总"""
    agg = _alloc_daily_agg(
        alloc_rows,
        lambda r: (r["需求日期"] or "未分类", r["工种"] or "未分类"))
    out = [{"日期": k[0], "工种": k[1], **v} for k, v in sorted(agg.items())]
    return ALLOC_DAILY_JOB_COLUMNS, out


# ------------------------------------------------------------------
# 人员到岗表（用户口径：NO SHOW 未勾选=到岗；到岗且无原因=已接受）
# ------------------------------------------------------------------

ARRIVAL_TRACKING_SUMMARY_COLUMNS = [
    "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_TRACKING_WAREHOUSE_COLUMNS = [
    "仓库", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_TRACKING_SUPPLIER_COLUMNS = [
    "供应商", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_TRACKING_REASON_COLUMNS = ["不符合要求原因", "人次"]
ARRIVAL_TRACKING_JOB_COLUMNS = [
    "工种", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_TRACKING_DAILY_COLUMNS = [
    "日期", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
# 按天×维度：前端日期筛选的底料（列含义与上面全周期版一致）
ARRIVAL_DAILY_SUPPLIER_COLUMNS = [
    "日期", "供应商", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_DAILY_WAREHOUSE_COLUMNS = [
    "日期", "仓库", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_DAILY_JOB_COLUMNS = [
    "日期", "工种", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]
ARRIVAL_DAILY_REASON_COLUMNS = ["日期", "不符合要求原因", "人次"]


def _at_stats(rows):
    # 用户口径（2026-10-06 确认）：
    #   到岗 = 全量（有名字的 1453 行）
    #   已接受 = 到岗 − NoShow − 被退回
    total = len(rows)
    arrived = total
    noshow = sum(1 for r in rows if r["是否NoShow"])
    sentback = sum(1 for r in rows if r["不符合要求原因"])
    accepted = total - noshow - sentback
    return total, arrived, accepted, noshow, sentback


def _at_row(prefix, stats):
    """把 _at_stats 的 5 个数拼成一行（prefix 是 日期/仓库/供应商/工种 键值对）"""
    t, a, k, n, s = stats
    row = dict(prefix)
    row.update({"拟到岗人次": t, "到岗人次": a, "已接受人次": k,
                "NoShow人次": n, "被退回人次": s})
    return row


def build_arrival_tracking(at_rows):
    """人员到岗表 -> 6 个全周期数据集（人次口径，与已派遣 1404 对得上）"""
    total, arrived, accepted, noshow, sentback = _at_stats(at_rows)
    by_wh = defaultdict(list)
    by_sup = defaultdict(list)
    by_day = defaultdict(list)
    by_job = defaultdict(list)
    by_reason = defaultdict(int)
    for r in at_rows:
        by_wh[r["仓库"] or "未分类"].append(r)
        by_sup[r["机构"] or "未分类"].append(r)
        by_day[r["到岗日期"] or "未分类"].append(r)
        by_job[r.get("职位") or "未分类"].append(r)
        if r["不符合要求原因"]:
            by_reason[r["不符合要求原因"]] += 1
    wh_rows = [_at_row({"仓库": wh}, _at_stats(by_wh[wh]))
               for wh in sorted(by_wh)]
    sup_rows = [_at_row({"供应商": sup}, _at_stats(by_sup[sup]))
                for sup in sorted(by_sup)]
    day_rows = [_at_row({"日期": d}, _at_stats(by_day[d]))
                for d in sorted(by_day)]
    reason_rows = [{"不符合要求原因": k, "人次": v}
                   for k, v in sorted(by_reason.items(),
                                      key=lambda x: -x[1])]
    job_rows = [_at_row({"工种": job}, _at_stats(by_job[job]))
                for job in sorted(by_job)]
    return {
        "arrival_tracking_summary": (
            ARRIVAL_TRACKING_SUMMARY_COLUMNS,
            [_at_row({}, (total, arrived, accepted, noshow, sentback))]),
        "arrival_tracking_warehouse": (
            ARRIVAL_TRACKING_WAREHOUSE_COLUMNS, wh_rows),
        "arrival_tracking_supplier": (
            ARRIVAL_TRACKING_SUPPLIER_COLUMNS, sup_rows),
        "arrival_tracking_reason": (
            ARRIVAL_TRACKING_REASON_COLUMNS, reason_rows),
        "arrival_tracking_job": (
            ARRIVAL_TRACKING_JOB_COLUMNS, job_rows),
        "arrival_tracking_daily": (
            ARRIVAL_TRACKING_DAILY_COLUMNS, day_rows),
    }


def build_arrival_daily(at_rows):
    """人员到岗表 -> 按到岗日期×维度的数据集（前端日期筛选的底料）"""
    by_sup = defaultdict(list)
    by_wh = defaultdict(list)
    by_job = defaultdict(list)
    by_reason = defaultdict(int)
    for r in at_rows:
        d = r["到岗日期"] or "未分类"
        by_sup[(d, r["机构"] or "未分类")].append(r)
        by_wh[(d, r["仓库"] or "未分类")].append(r)
        by_job[(d, r.get("职位") or "未分类")].append(r)
        if r["不符合要求原因"]:
            by_reason[(d, r["不符合要求原因"])] += 1
    sup_rows = [_at_row({"日期": k[0], "供应商": k[1]}, _at_stats(v))
                for k, v in sorted(by_sup.items())]
    wh_rows = [_at_row({"日期": k[0], "仓库": k[1]}, _at_stats(v))
              for k, v in sorted(by_wh.items())]
    job_rows = [_at_row({"日期": k[0], "工种": k[1]}, _at_stats(v))
                for k, v in sorted(by_job.items())]
    reason_rows = [{"日期": k[0], "不符合要求原因": k[1], "人次": v}
                   for k, v in sorted(by_reason.items())]
    return {
        "arrival_tracking_daily_supplier": (
            ARRIVAL_DAILY_SUPPLIER_COLUMNS, sup_rows),
        "arrival_tracking_daily_warehouse": (
            ARRIVAL_DAILY_WAREHOUSE_COLUMNS, wh_rows),
        "arrival_tracking_daily_job": (
            ARRIVAL_DAILY_JOB_COLUMNS, job_rows),
        "arrival_tracking_daily_reason": (
            ARRIVAL_DAILY_REASON_COLUMNS, reason_rows),
    }


ARRIVAL_TRACKING_EMPTY_SCHEMAS = {
    "arrival_tracking_summary": ARRIVAL_TRACKING_SUMMARY_COLUMNS,
    "arrival_tracking_warehouse": ARRIVAL_TRACKING_WAREHOUSE_COLUMNS,
    "arrival_tracking_supplier": ARRIVAL_TRACKING_SUPPLIER_COLUMNS,
    "arrival_tracking_reason": ARRIVAL_TRACKING_REASON_COLUMNS,
    "arrival_tracking_job": ARRIVAL_TRACKING_JOB_COLUMNS,
    "arrival_tracking_daily": ARRIVAL_TRACKING_DAILY_COLUMNS,
    "arrival_tracking_daily_supplier": ARRIVAL_DAILY_SUPPLIER_COLUMNS,
    "arrival_tracking_daily_warehouse": ARRIVAL_DAILY_WAREHOUSE_COLUMNS,
    "arrival_tracking_daily_job": ARRIVAL_DAILY_JOB_COLUMNS,
    "arrival_tracking_daily_reason": ARRIVAL_DAILY_REASON_COLUMNS,
}


# ------------------------------------------------------------------
# 到岗匹配：发单详情（已派遣）× 到岗表（实到）
# ------------------------------------------------------------------
# 口径（2026-10-07 用户定）：
#   已派遣 = 发单详情按供应商/需求仓求和「供应商已派遣人数」
#   实到   = 人员到岗表按机构/仓库计数（有 OTWS ID 的记录）
#   到岗率 = 实到 ÷ 已派遣
# 超过 100% 说明到岗表的人比发单记的多（临时加人/名单延迟）；
# 过低说明派了没到得多。

import re as _re


def _norm_wh_at(name):
    m = _re.search(r'(\d+)', name or "")
    if not m:
        return name
    num = m.group(1)
    pm = _re.search(r'\(([^)]+)\)', name or "")
    suffix = pm.group(1) if pm else ""
    if suffix == "CP":
        suffix = "中邮"
    s = f"洛杉矶{num}号仓"
    if suffix:
        s += f"({suffix})"
    return s


MATCH_SUPPLIER_COLUMNS = ["供应商", "已派遣", "实到", "到岗率"]
MATCH_WAREHOUSE_COLUMNS = ["仓库", "已派遣", "实到", "到岗率"]


def build_arrival_match(alloc_rows, at_rows):
    """发单详情 × 到岗表 -> 供应商/仓库到岗率"""
    # 已派遣：发单详情
    sup_disp = defaultdict(int)
    wh_disp = defaultdict(int)
    for r in alloc_rows:
        sup = r.get("供应商") or "未分类"
        wh = r.get("需求仓") or "未分类"
        n = r.get("供应商已派遣人数") or 0
        sup_disp[sup] += n
        wh_disp[wh] += n
    # 实到：到岗表（排除 NoShow 才是实际到场）
    sup_arr = defaultdict(int)
    wh_arr = defaultdict(int)
    for r in at_rows:
        if r.get("是否NoShow"):
            continue
        sup = r.get("机构") or "未分类"
        wh = _norm_wh_at(r.get("仓库") or "未分类")
        sup_arr[sup] += 1
        wh_arr[wh] += 1
    sup_rows = []
    for sup in sorted(set(sup_disp) | set(sup_arr)):
        d = sup_disp.get(sup, 0)
        a = sup_arr.get(sup, 0)
        rate = round(a / d * 100, 1) if d > 0 else None
        sup_rows.append({"供应商": sup, "已派遣": d,
                        "实到": a, "到岗率": rate})
    sup_rows.sort(key=lambda r: (r["到岗率"] is None, r["到岗率"] or 0))
    wh_rows = []
    for wh in sorted(set(wh_disp) | set(wh_arr)):
        d = wh_disp.get(wh, 0)
        a = wh_arr.get(wh, 0)
        rate = round(a / d * 100, 1) if d > 0 else None
        wh_rows.append({"仓库": wh, "已派遣": d,
                       "实到": a, "到岗率": rate})
    wh_rows.sort(key=lambda r: (r["到岗率"] is None, r["到岗率"] or 0))
    return {
        "match_supplier_arrival": (MATCH_SUPPLIER_COLUMNS, sup_rows),
        "match_warehouse_arrival": (MATCH_WAREHOUSE_COLUMNS, wh_rows),
    }


MATCH_EMPTY_SCHEMAS = {
    "match_supplier_arrival": MATCH_SUPPLIER_COLUMNS,
    "match_warehouse_arrival": MATCH_WAREHOUSE_COLUMNS,
}


# ------------------------------------------------------------------
# 空数据集
# ------------------------------------------------------------------

def empty_dataset(columns):
    return columns, []


# ------------------------------------------------------------------
# 总装
# ------------------------------------------------------------------

def build_all(raw):
    """返回 {dataset_name: (columns, rows)}"""
    demand_cols, demand_rows = build_demand(raw)
    alloc_cols, alloc_rows = build_allocation(raw)

    datasets = {
        "demand": (demand_cols, demand_rows),
        "missing_supplier_allocation": build_missing_supplier(demand_rows),
        "supplier_allocation": (alloc_cols, alloc_rows),
        "supplier_summary": build_supplier_summary(alloc_rows),
        "supplier_warehouse": build_supplier_warehouse(alloc_rows),
        "supplier_job": build_supplier_job(alloc_rows),
        "warehouse_summary": build_warehouse_summary(demand_rows, alloc_rows),
        "warehouse_alloc_summary": build_warehouse_alloc_summary(alloc_rows),
        "job_alloc_summary": build_job_alloc_summary(alloc_rows),
        "job_demand_summary": build_job_demand_summary(demand_rows),
        "warehouse_job": build_warehouse_job(demand_rows),
        # 按天数据集：前端日期筛选的底料
        "demand_daily": build_demand_daily(demand_rows),
        "demand_daily_job": build_demand_daily_job(demand_rows),
        "alloc_daily": build_alloc_daily(alloc_rows),
        "alloc_daily_supplier": build_alloc_daily_supplier(alloc_rows),
        "alloc_daily_warehouse": build_alloc_daily_warehouse(alloc_rows),
        "alloc_daily_job": build_alloc_daily_job(alloc_rows),
    }
    at_rows = raw.get("arrival_tracking", [])
    if at_rows:
        datasets.update(build_arrival_tracking(at_rows))
        datasets.update(build_arrival_daily(at_rows))
    else:
        for name, columns in ARRIVAL_TRACKING_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    if alloc_rows and at_rows:
        datasets.update(build_arrival_match(alloc_rows, at_rows))
    else:
        for name, columns in MATCH_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    return datasets
