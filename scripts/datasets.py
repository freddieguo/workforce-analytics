"""
datasets.py — 由干净记录构建 dashboard.json 的 20 个数据集

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
  - dispatch:             派遣名单中有员工姓名的行，一人一行。
  - ot_*:                 考勤表（22 列格式）按日期/仓库/供应商/工种汇总
                          工作时长与加班时长；考勤文件为空时产出空数据集。
  - arrival_*:            到岗数据集：有首打卡时间 = 有物理到场证据，
                          只算考勤类型=派遣考勤（匹配已派遣人群）。
  - trial_failure_*:      原始文件里没有试工不通过数据，为空，
                          前端已有空状态兜底。

去重规则：
  同一文件内、跨文件之间，可能出现主键相同的行（重复导出或新旧快照），
  保留最后出现的一行；主键相同但数字不一致时记 warning，不做加总
  （加总会把同一批人算两遍——实测 2026-09-29 洛杉矶17号仓包装组普工
  的新旧两版，加总会得到 8，与需求详情的已发单 5 对不上）。
"""

from collections import defaultdict

from common import warn, to_str


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
# dispatch：派遣名单中有员工姓名的行，一人一行
# ------------------------------------------------------------------

DISPATCH_COLUMNS = ["需求区域", "需求仓", "需求组", "需求日期", "工种", "原始工种",
                    "班次", "供应商", "供应商ID", "员工姓名", "员工工号",
                    "派遣开始日期", "供应商需派遣人数", "供应商未派遣人数",
                    "供应商已派遣人数"]


def build_dispatch(raw):
    out = []
    for r in raw["dispatch"]:
        if not r["员工姓名"]:
            continue
        out.append({c: r.get(c, "") for c in DISPATCH_COLUMNS})
    out.sort(key=lambda r: (r["需求日期"], r["需求仓"], r["员工姓名"]))
    return DISPATCH_COLUMNS, out


# ------------------------------------------------------------------
# 考勤：OT + 到岗
# ------------------------------------------------------------------
# 口径（说人话）：
#   - 表里一行 = 一个人某一天的一条考勤记录。
#   - 到岗：填了“首打卡时间”就算到过（打卡机留了记录，人肯定来过）。
#     有工作时长 / 只有打卡没有工时，分开记（有工时人数），不混在一起。
#   - 到岗只算“派遣考勤”（派出去的人）；“混读考勤”不算进到岗人数。
#     如果表里没有考勤类型这一列，就不过滤。
#   - 同一工号同一天多行 -> 去重保留最后一条（dedupe 通用规则）。

ATTENDANCE_KEY = ["工号", "考勤日期"]
ATTENDANCE_NUM = ["工作时长", "加班时长"]

OT_DAILY_COLUMNS = ["考勤日期", "供应商", "仓库", "工种", "工作时长", "加班时长"]
OT_WAREHOUSE_COLUMNS = ["仓库", "工作时长", "加班时长"]
OT_SUPPLIER_COLUMNS = ["供应商", "工作时长", "加班时长"]
OT_JOB_COLUMNS = ["工种", "工作时长", "加班时长"]

ARRIVAL_DAILY_COLUMNS = ["考勤日期", "到岗人数", "到岗人次", "有工时人数"]
ARRIVAL_SUPPLIER_COLUMNS = ["供应商", "到岗人数", "到岗人次", "有工时人数"]
ARRIVAL_WAREHOUSE_COLUMNS = ["仓库", "到岗人数", "到岗人次", "有工时人数"]


def _sum_hours(rows):
    return {"工作时长": round(sum(r["工作时长"] for r in rows), 2),
            "加班时长": round(sum(r["加班时长"] for r in rows), 2)}


def build_ot(att_rows):
    daily, wh, sup, job = (defaultdict(list), defaultdict(list),
                           defaultdict(list), defaultdict(list))
    for r in att_rows:
        daily[(r["考勤日期"], r["供应商"], r["仓库"], r["工种"])].append(r)
        wh[r["仓库"]].append(r)
        sup[r["供应商"]].append(r)
        job[r["工种"]].append(r)
    by_ot = lambda kv: -sum(x["加班时长"] for x in kv[1])
    ot_daily = [{"考勤日期": k[0], "供应商": k[1], "仓库": k[2], "工种": k[3],
                 **_sum_hours(v)} for k, v in sorted(daily.items())]
    ot_warehouse = [{"仓库": k, **_sum_hours(v)} for k, v in sorted(wh.items(), key=by_ot)]
    ot_supplier = [{"供应商": k, **_sum_hours(v)} for k, v in sorted(sup.items(), key=by_ot)]
    ot_job = [{"工种": k, **_sum_hours(v)} for k, v in sorted(job.items(), key=by_ot)]
    return {
        "ot_daily": (OT_DAILY_COLUMNS, ot_daily),
        "ot_warehouse": (OT_WAREHOUSE_COLUMNS, ot_warehouse),
        "ot_supplier": (OT_SUPPLIER_COLUMNS, ot_supplier),
        "ot_job": (OT_JOB_COLUMNS, ot_job),
    }


def _arrival_stats(rows):
    persons = {r["工号"] or r["姓名"] for r in rows if r["工号"] or r["姓名"]}
    with_hours = {r["工号"] or r["姓名"] for r in rows
                  if (r["工号"] or r["姓名"]) and r["工作时长"] > 0}
    return {"到岗人数": len(persons),
            "到岗人次": len(rows),
            "有工时人数": len(with_hours)}


def build_arrival(att_rows):
    has_type = any(r["考勤类型"] for r in att_rows)
    arrived = [r for r in att_rows
               if r["首打卡"] and (not has_type or r["考勤类型"] == "派遣考勤")]
    by_day, by_sup, by_wh = (defaultdict(list), defaultdict(list),
                             defaultdict(list))
    for r in arrived:
        by_day[r["考勤日期"]].append(r)
        by_sup[r["供应商"]].append(r)
        by_wh[r["仓库"]].append(r)
    by_n = lambda kv: -len(kv[1])
    arrival_daily = [{"考勤日期": k, **_arrival_stats(v)}
                     for k, v in sorted(by_day.items())]
    arrival_supplier = [{"供应商": k, **_arrival_stats(v)}
                        for k, v in sorted(by_sup.items(), key=by_n)]
    arrival_warehouse = [{"仓库": k, **_arrival_stats(v)}
                         for k, v in sorted(by_wh.items(), key=by_n)]
    # 全周期去重：漏斗“已到岗”阶段用这个数（与“已派遣”量级可比）
    arrival_summary = [_arrival_stats(arrived)]
    return {
        "arrival_daily": (ARRIVAL_DAILY_COLUMNS, arrival_daily),
        "arrival_supplier": (ARRIVAL_SUPPLIER_COLUMNS, arrival_supplier),
        "arrival_warehouse": (ARRIVAL_WAREHOUSE_COLUMNS, arrival_warehouse),
        "arrival_summary": (["到岗人数", "到岗人次", "有工时人数"], arrival_summary),
    }


# ------------------------------------------------------------------
# 临时工派遣：试工不通过、已确认
# ------------------------------------------------------------------
# 口径（说人话）：
#   - 表里一行 = 一人一天一条派遣记录；人数按工号去重算。
#   - 状态有三种：已确认（派遣被确认）、试工不通过、待确认。
#   - 试工不通过人数：状态=试工不通过的去重人数。
#   - 参考人数：该供应商/仓库/工种下全部派遣去重人数，
#     试工不通过率 = 试工不通过人数 ÷ 参考人数。
#   - 已确认人数（去重）作为漏斗“已接受”阶段的代理口径，
#     明确标注为派遣状态口径（不是仓库验收单据）。

TRIAL_DAILY_COLUMNS = ["日期", "供应商", "仓库", "工种", "试工不通过人数"]
TRIAL_SUPPLIER_COLUMNS = ["供应商", "试工不通过人数"]
TRIAL_WAREHOUSE_COLUMNS = ["仓库", "试工不通过人数"]
TRIAL_JOB_COLUMNS = ["工种", "试工不通过人数"]
TRIAL_REF_COLUMNS_SUP = ["供应商", "参考人数"]
TRIAL_REF_COLUMNS_WH = ["仓库", "参考人数"]
TRIAL_REF_COLUMNS_JOB = ["工种", "参考人数"]


def _distinct_persons(rows):
    return {r["工号"] or r["姓名"] for r in rows if r["工号"] or r["姓名"]}


def build_trial_failure(temp_rows):
    tf = [r for r in temp_rows if r["状态"] == "试工不通过"]
    daily, sup, wh, job = (defaultdict(set), defaultdict(set),
                           defaultdict(set), defaultdict(set))
    for r in tf:
        person = r["工号"] or r["姓名"]
        if not person:
            continue
        daily[(r["派遣结束日期"] or r["派遣开始日期"], r["供应商"],
               r["仓库"], r["工种"])].add(person)
        sup[r["供应商"]].add(person)
        wh[r["仓库"]].add(person)
        job[r["工种"]].add(person)
    # 参考人数：全部派遣去重人数
    ref_sup, ref_wh, ref_job = (defaultdict(set), defaultdict(set),
                               defaultdict(set))
    for r in temp_rows:
        person = r["工号"] or r["姓名"]
        if not person:
            continue
        ref_sup[r["供应商"]].add(person)
        ref_wh[r["仓库"]].add(person)
        ref_job[r["工种"]].add(person)
    by_n = lambda kv: -len(kv[1])
    return {
        "trial_failure_daily":
            (TRIAL_DAILY_COLUMNS,
             [{"日期": k[0], "供应商": k[1], "仓库": k[2], "工种": k[3],
               "试工不通过人数": len(v)} for k, v in sorted(daily.items())]),
        "trial_failure_supplier":
            (TRIAL_SUPPLIER_COLUMNS,
             [{"供应商": k, "试工不通过人数": len(v)}
              for k, v in sorted(sup.items(), key=by_n)]),
        "trial_failure_warehouse":
            (TRIAL_WAREHOUSE_COLUMNS,
             [{"仓库": k, "试工不通过人数": len(v)}
              for k, v in sorted(wh.items(), key=by_n)]),
        "trial_failure_job":
            (TRIAL_JOB_COLUMNS,
             [{"工种": k, "试工不通过人数": len(v)}
              for k, v in sorted(job.items(), key=by_n)]),
        "trial_failure_supplier_reference":
            (TRIAL_REF_COLUMNS_SUP,
             [{"供应商": k, "参考人数": len(v)}
              for k, v in sorted(ref_sup.items(), key=by_n)]),
        "trial_failure_warehouse_reference":
            (TRIAL_REF_COLUMNS_WH,
             [{"仓库": k, "参考人数": len(v)}
              for k, v in sorted(ref_wh.items(), key=by_n)]),
        "trial_failure_job_reference":
            (TRIAL_REF_COLUMNS_JOB,
             [{"工种": k, "参考人数": len(v)}
              for k, v in sorted(ref_job.items(), key=by_n)]),
    }


def build_acceptance(temp_rows):
    """已确认/试工不通过/待确认去重人数，供漏斗“已接受”阶段用"""
    buckets = defaultdict(set)
    for r in temp_rows:
        person = r["工号"] or r["姓名"]
        if person and r["状态"]:
            buckets[r["状态"]].add(person)
    return {
        "acceptance_summary":
            (["已确认人数", "试工不通过人数", "待确认人数"],
             [{"已确认人数": len(buckets.get("已确认", set())),
               "试工不通过人数": len(buckets.get("试工不通过", set())),
               "待确认人数": len(buckets.get("待确认", set()))}]),
    }


# ------------------------------------------------------------------
# 漏斗（人头口径，同一批人）
# ------------------------------------------------------------------
# 口径（说人话）：
#   - 以临时工派遣表的去重人数为“已派遣”（全量口径）。
#     注意：发单详情的“已派遣 1404 人次”是需求池口径，数据不全，
#     漏斗不用它（实测派遣表去重 2813 人）。
#   - 已到岗：在派遣人群里、有首打卡时间的去重人数。
#   - 已接受：在已到岗里、派遣状态=已确认的去重人数
#     （SOP 的 Accepted = confirmed arrivals）。
#   - 未到岗待核实：派了但没打卡记录的去重人数。按 SOP，
#     缺考勤只能记待核实，不能直接当没来。
#   - 到岗且试工不通过：在已到岗里、派遣状态=试工不通过的去重人数。

FUNNEL_PERSON_COLUMNS = ["已派遣人数", "到岗人数", "已接受人数",
                         "未到岗待核实人数", "到岗且试工不通过人数"]


def build_funnel_person(att_rows, temp_rows):
    dispatched = _distinct_persons(temp_rows)
    has_type = any(r["考勤类型"] for r in att_rows)
    arrived = {r["工号"] or r["姓名"] for r in att_rows
               if (r["工号"] or r["姓名"]) and r["首打卡"]
               and (not has_type or r["考勤类型"] == "派遣考勤")}
    confirmed = {r["工号"] or r["姓名"] for r in temp_rows
                 if (r["工号"] or r["姓名"]) and r["状态"] == "已确认"}
    failed = {r["工号"] or r["姓名"] for r in temp_rows
              if (r["工号"] or r["姓名"]) and r["状态"] == "试工不通过"}
    return {
        "funnel_person":
            (FUNNEL_PERSON_COLUMNS,
             [{"已派遣人数": len(dispatched),
               "到岗人数": len(arrived & dispatched),
               "已接受人数": len(arrived & confirmed),
               "未到岗待核实人数": len(dispatched - arrived),
               "到岗且试工不通过人数": len(arrived & failed)}]),
    }


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
ARRIVAL_TRACKING_DAILY_COLUMNS = [
    "日期", "拟到岗人次", "到岗人次", "已接受人次", "NoShow人次", "被退回人次",
]


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


def build_arrival_tracking(at_rows):
    """人员到岗表 -> 5 个数据集（人次口径，与已派遣 1404 对得上）"""
    total, arrived, accepted, noshow, sentback = _at_stats(at_rows)
    from collections import defaultdict
    by_wh = defaultdict(list)
    by_sup = defaultdict(list)
    by_day = defaultdict(list)
    by_reason = defaultdict(int)
    for r in at_rows:
        by_wh[r["仓库"] or "未分类"].append(r)
        by_sup[r["机构"] or "未分类"].append(r)
        by_day[r["到岗日期"] or "未分类"].append(r)
        if r["不符合要求原因"]:
            by_reason[r["不符合要求原因"]] += 1
    wh_rows = []
    for wh in sorted(by_wh):
        t, a, k, n, s = _at_stats(by_wh[wh])
        wh_rows.append({"仓库": wh, "拟到岗人次": t, "到岗人次": a,
                        "已接受人次": k, "NoShow人次": n, "被退回人次": s})
    sup_rows = []
    for sup in sorted(by_sup):
        t, a, k, n, s = _at_stats(by_sup[sup])
        sup_rows.append({"供应商": sup, "拟到岗人次": t, "到岗人次": a,
                         "已接受人次": k, "NoShow人次": n, "被退回人次": s})
    day_rows = []
    for d in sorted(by_day):
        t, a, k, n, s = _at_stats(by_day[d])
        day_rows.append({"日期": d, "拟到岗人次": t, "到岗人次": a,
                         "已接受人次": k, "NoShow人次": n, "被退回人次": s})
    reason_rows = [{"不符合要求原因": k, "人次": v}
                   for k, v in sorted(by_reason.items(),
                                      key=lambda x: -x[1])]
    return {
        "arrival_tracking_summary": (
            ARRIVAL_TRACKING_SUMMARY_COLUMNS,
            [{"拟到岗人次": total, "到岗人次": arrived, "已接受人次": accepted,
              "NoShow人次": noshow, "被退回人次": sentback}]),
        "arrival_tracking_warehouse": (
            ARRIVAL_TRACKING_WAREHOUSE_COLUMNS, wh_rows),
        "arrival_tracking_supplier": (
            ARRIVAL_TRACKING_SUPPLIER_COLUMNS, sup_rows),
        "arrival_tracking_reason": (
            ARRIVAL_TRACKING_REASON_COLUMNS, reason_rows),
        "arrival_tracking_daily": (
            ARRIVAL_TRACKING_DAILY_COLUMNS, day_rows),
    }


ARRIVAL_TRACKING_EMPTY_SCHEMAS = {
    "arrival_tracking_summary": ARRIVAL_TRACKING_SUMMARY_COLUMNS,
    "arrival_tracking_warehouse": ARRIVAL_TRACKING_WAREHOUSE_COLUMNS,
    "arrival_tracking_supplier": ARRIVAL_TRACKING_SUPPLIER_COLUMNS,
    "arrival_tracking_reason": ARRIVAL_TRACKING_REASON_COLUMNS,
    "arrival_tracking_daily": ARRIVAL_TRACKING_DAILY_COLUMNS,
}


# ------------------------------------------------------------------
# 派遣表现：派遣名单（应派）× 到岗表（实到）
# ------------------------------------------------------------------
# 口径（2026-10-07 用户定）：
#   应派 = 派遣人员名单按供应商/仓库求和「供应商需派遣人数」
#   实到 = 人员到岗表按机构/仓库计数（有 OTWS ID 的记录）
#   达成率 = 实到 ÷ 应派
# 仓库名归一化：到岗表用英文名（如 Los Angeles-8），派遣名单用中文名
# （如 洛杉矶8号仓），按编号+后缀映射；(CP)=中邮 特殊处理。

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


DISPATCH_SUPPLIER_PERF_COLUMNS = ["供应商", "应派人数", "实到人次", "达成率"]
DISPATCH_WAREHOUSE_PERF_COLUMNS = ["仓库", "应派人数", "实到人次", "达成率"]


def build_dispatch_performance(dispatch_rows, at_rows):
    """派遣名单 × 到岗表 -> 供应商/仓库表现（实到÷应派）"""
    # 应派：派遣名单按供应商、仓库求和
    sup_need = defaultdict(int)
    wh_need = defaultdict(int)
    for r in dispatch_rows:
        sup = r.get("供应商") or "未分类"
        wh = r.get("需求仓") or "未分类"
        n = r.get("供应商需派遣人数") or 0
        sup_need[sup] += n
        wh_need[wh] += n
    # 实到：到岗表按机构、归一化仓库计数
    sup_arr = defaultdict(int)
    wh_arr = defaultdict(int)
    for r in at_rows:
        sup = r.get("机构") or "未分类"
        wh = _norm_wh_at(r.get("仓库") or "未分类")
        sup_arr[sup] += 1
        wh_arr[wh] += 1
    sup_rows = []
    for sup in sorted(set(sup_need) | set(sup_arr)):
        need = sup_need.get(sup, 0)
        arr = sup_arr.get(sup, 0)
        rate = round(arr / need * 100, 1) if need > 0 else 0
        sup_rows.append({"供应商": sup, "应派人数": need,
                        "实到人次": arr, "达成率": rate})
    sup_rows.sort(key=lambda r: -r["达成率"])
    wh_rows = []
    for wh in sorted(set(wh_need) | set(wh_arr)):
        need = wh_need.get(wh, 0)
        arr = wh_arr.get(wh, 0)
        rate = round(arr / need * 100, 1) if need > 0 else 0
        wh_rows.append({"仓库": wh, "应派人数": need,
                       "实到人次": arr, "达成率": rate})
    wh_rows.sort(key=lambda r: -r["达成率"])
    return {
        "dispatch_supplier_perf": (
            DISPATCH_SUPPLIER_PERF_COLUMNS, sup_rows),
        "dispatch_warehouse_perf": (
            DISPATCH_WAREHOUSE_PERF_COLUMNS, wh_rows),
    }


DISPATCH_PERF_EMPTY_SCHEMAS = {
    "dispatch_supplier_perf": DISPATCH_SUPPLIER_PERF_COLUMNS,
    "dispatch_warehouse_perf": DISPATCH_WAREHOUSE_PERF_COLUMNS,
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

MATCH_SUPPLIER_COLUMNS = ["供应商", "已派遣", "实到", "到岗率"]
MATCH_WAREHOUSE_COLUMNS = ["仓库", "已派遣", "实到", "到岗率"]


def build_arrival_match(alloc_rows, at_rows):
    """发单详情 × 到岗表 -> 供应商/仓库到岗率"""
    from collections import defaultdict
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


# 考勤文件为空时，OT/到岗按空数据集产出（列名保留，前端有兜底展示）
OT_EMPTY_SCHEMAS = {
    "ot_daily": OT_DAILY_COLUMNS,
    "ot_warehouse": OT_WAREHOUSE_COLUMNS,
    "ot_supplier": OT_SUPPLIER_COLUMNS,
    "ot_job": OT_JOB_COLUMNS,
    "arrival_daily": ARRIVAL_DAILY_COLUMNS,
    "arrival_supplier": ARRIVAL_SUPPLIER_COLUMNS,
    "arrival_warehouse": ARRIVAL_WAREHOUSE_COLUMNS,
    "arrival_summary": ["到岗人数", "到岗人次", "有工时人数"],
}

# 临时工派遣文件为空时，试工/确认按空数据集产出（列名保留，前端有兜底展示）
TRIAL_EMPTY_SCHEMAS = {
    "trial_failure_daily": TRIAL_DAILY_COLUMNS,
    "trial_failure_supplier": TRIAL_SUPPLIER_COLUMNS,
    "trial_failure_warehouse": TRIAL_WAREHOUSE_COLUMNS,
    "trial_failure_job": TRIAL_JOB_COLUMNS,
    "trial_failure_supplier_reference": TRIAL_REF_COLUMNS_SUP,
    "trial_failure_warehouse_reference": TRIAL_REF_COLUMNS_WH,
    "trial_failure_job_reference": TRIAL_REF_COLUMNS_JOB,
    "acceptance_summary": ["已确认人数", "试工不通过人数", "待确认人数"],
}


# ------------------------------------------------------------------
# 总装
# ------------------------------------------------------------------

def build_all(raw):
    """返回 {dataset_name: (columns, rows)}，共 30 个数据集"""
    demand_cols, demand_rows = build_demand(raw)
    alloc_cols, alloc_rows = build_allocation(raw)
    att_rows = dedupe(raw.get("attendance", []), ATTENDANCE_KEY,
                      ATTENDANCE_NUM, "考勤")

    datasets = {
        "demand": (demand_cols, demand_rows),
        "missing_supplier_allocation": build_missing_supplier(demand_rows),
        "supplier_allocation": (alloc_cols, alloc_rows),
        "supplier_summary": build_supplier_summary(alloc_rows),
        "supplier_warehouse": build_supplier_warehouse(alloc_rows),
        "supplier_job": build_supplier_job(alloc_rows),
        "warehouse_summary": build_warehouse_summary(demand_rows, alloc_rows),
        "warehouse_alloc_summary": build_warehouse_alloc_summary(alloc_rows),
        "warehouse_job": build_warehouse_job(demand_rows),
        "dispatch": build_dispatch(raw),
    }
    if att_rows:
        datasets.update(build_ot(att_rows))
        datasets.update(build_arrival(att_rows))
    else:
        for name, columns in OT_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    temp_rows = raw.get("temp_dispatch", [])
    if temp_rows:
        datasets.update(build_trial_failure(temp_rows))
        datasets.update(build_acceptance(temp_rows))
    else:
        for name, columns in TRIAL_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    if att_rows and temp_rows:
        datasets.update(build_funnel_person(att_rows, temp_rows))
    else:
        datasets["funnel_person"] = empty_dataset(FUNNEL_PERSON_COLUMNS)
    at_rows = raw.get("arrival_tracking", [])
    if at_rows:
        datasets.update(build_arrival_tracking(at_rows))
    else:
        for name, columns in ARRIVAL_TRACKING_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    if alloc_rows and at_rows:
        datasets.update(build_arrival_match(alloc_rows, at_rows))
    else:
        for name, columns in MATCH_EMPTY_SCHEMAS.items():
            datasets[name] = empty_dataset(columns)
    return datasets
