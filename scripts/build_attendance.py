"""
build_attendance.py — 解析考勤表（22 列格式），生成 OT + 到岗数据集，
合并进 data/processed/dashboard.json。

用法：
    python3 scripts/build_attendance.py [考勤xlsx路径]

不给路径时，自动在 data/raw/ 下找“有数据的考勤表”
（sheet 名含“考勤”、表头含“考勤日期”的 xlsx；只有表头的空导出会被跳过）。

考勤表列（A~V）：
  供应商名称 供应商ID 姓名 工号 工种 员工类型 区域 仓库 组 考勤类型
  考勤日期 记录生成时间 白班工作时长 下午班工作时长 晚班工作时长
  工作时长 加班时长 时长总计 班次 考勤方案 首打卡时间 末打卡时间

口径（说人话版）：
  - 表里一行 = 一个人某一天的一条考勤记录。
  - 到岗：填了“首打卡时间”就算到过——打卡机留了记录，人肯定来过。
    有工作时长 / 只有打卡没有工时，分开记，不混在一起。
  - 到岗人数只算“派遣考勤”（派出去的人）；“混读考勤”只在报告里提一句，
    不算进到岗人数。如果表里没有考勤类型这一列，就不过滤。
  - 同一个工号同一天出现多行：保留最后一条，数字对不上记一条 warning。
  - 工种归一化跟主管道一致：只去掉末尾的罗马数字
    （Cherry Picker II -> Cherry Picker），不合并不同工种。
  - 日期按本地年月日解析，不做 UTC 转换（避免日期提前一天）。
  - 加班率 = 加班时长 / 工作时长，分母为 0 时记 N/A，前端展示时处理。

注意顺序：先跑 run_all.py，再跑这个脚本。
run_all.py 每次都会把 ot_* 数据集重置为空，这个脚本负责把考勤数填回去。

只依赖 openpyxl + 标准库，可独立运行。
"""

import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

import openpyxl

# ------------------------------------------------------------------
# 小工具（从主管道抄来的最小集，保证独立运行）
# ------------------------------------------------------------------

_LEVEL_SUFFIX = re.compile(r"\s+[IVX]{1,3}$")


def to_str(v):
    if v is None:
        return ""
    return str(v).strip()


def to_float(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def norm_job(name):
    original = to_str(name)
    normalized = _LEVEL_SUFFIX.sub("", original).strip()
    return normalized or original


def parse_date(v):
    """只取本地年月日，返回 YYYY-MM-DD 字符串，解析失败返回 ''"""
    if v is None or (isinstance(v, str) and not v.strip()):
        return ""
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = to_str(v).replace("/", "-")
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return ""


warnings = []


def warn(msg):
    warnings.append(msg)


# ------------------------------------------------------------------
# 找考勤文件
# ------------------------------------------------------------------

EXPECTED_COLS = ["供应商名称", "姓名", "工号", "工种", "仓库", "组",
                 "考勤类型", "考勤日期", "工作时长", "加班时长", "首打卡时间"]


def is_attendance_workbook(path):
    """有数据的考勤表：sheet 名含考勤，且表头含考勤日期"""
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception:
        return False
    try:
        for sn in wb.sheetnames:
            if "考勤" not in sn:
                continue
            ws = wb[sn]
            header = None
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    header = [to_str(v) for v in row]
                    break
            if header and "考勤日期" in header:
                return True
        return False
    finally:
        wb.close()


def find_attendance_file(raw_dir):
    found = []
    for p in sorted(Path(raw_dir).glob("*.xlsx")):
        if is_attendance_workbook(p):
            found.append(p)
    return found


# ------------------------------------------------------------------
# 读考勤表明细
# ------------------------------------------------------------------

def read_attendance(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = None
    for sn in wb.sheetnames:
        if "考勤" in sn:
            ws = wb[sn]
            break
    if ws is None:
        wb.close()
        raise ValueError(f"{path} 里没有考勤 sheet")

    header, rows = None, []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            header = [to_str(v) for v in row]
            missing = [c for c in EXPECTED_COLS if c not in header]
            if missing:
                wb.close()
                raise ValueError(f"表头缺列: {missing}，实际表头: {header}")
            continue
        if all(v is None or (isinstance(v, str) and not v.strip()) for v in row):
            continue
        d = dict(zip(header, row))
        att_date = parse_date(d.get("考勤日期"))
        if not att_date:
            warn(f"第{i+1}行考勤日期解析失败已跳过: {d.get('考勤日期')!r}")
            continue
        rows.append({
            "供应商": to_str(d.get("供应商名称")) or "未分类",
            "供应商ID": to_str(d.get("供应商ID")),
            "姓名": to_str(d.get("姓名")),
            "工号": to_str(d.get("工号")),
            "工种": norm_job(d.get("工种")) or "未分类",
            "仓库": to_str(d.get("仓库")) or "未分类",
            "组": to_str(d.get("组")),
            "考勤类型": to_str(d.get("考勤类型")),
            "考勤日期": att_date,
            "工作时长": round(to_float(d.get("工作时长")), 2),
            "加班时长": round(to_float(d.get("加班时长")), 2),
            "首打卡": to_str(d.get("首打卡时间")),
            "末打卡": to_str(d.get("末打卡时间")),
        })
    wb.close()

    # 去重：同一工号同一天多行 -> 保留最后一条
    deduped = {}
    for r in rows:
        key = (r["工号"], r["考勤日期"])
        if key in deduped:
            old = deduped[key]
            if (old["工作时长"], old["加班时长"]) != (r["工作时长"], r["加班时长"]):
                warn(f"同一工号同一天有多条记录已取最后一条: "
                     f"{r['姓名']}({r['工号']}) {r['考勤日期']}")
        deduped[key] = r
    return list(deduped.values())


# ------------------------------------------------------------------
# 建数据集
# ------------------------------------------------------------------

def build_ot(rows):
    """ot_daily / ot_warehouse / ot_supplier / ot_job：含所有行"""
    daily = defaultdict(lambda: {"工作时长": 0.0, "加班时长": 0.0})
    wh = defaultdict(lambda: {"工作时长": 0.0, "加班时长": 0.0})
    sup = defaultdict(lambda: {"工作时长": 0.0, "加班时长": 0.0})
    job = defaultdict(lambda: {"工作时长": 0.0, "加班时长": 0.0})
    for r in rows:
        for agg, key in ((daily, (r["考勤日期"], r["供应商"], r["仓库"], r["工种"])),
                         (wh, r["仓库"]), (sup, r["供应商"]), (job, r["工种"])):
            agg[key]["工作时长"] += r["工作时长"]
            agg[key]["加班时长"] += r["加班时长"]

    def fin(agg):
        for v in agg.values():
            v["工作时长"] = round(v["工作时长"], 2)
            v["加班时长"] = round(v["加班时长"], 2)
        return agg

    daily, wh, sup, job = fin(daily), fin(wh), fin(sup), fin(job)
    ot_daily = [{"考勤日期": k[0], "供应商": k[1], "仓库": k[2], "工种": k[3],
                 **v} for k, v in sorted(daily.items())]
    ot_warehouse = [{"仓库": k, **v} for k, v in
                    sorted(wh.items(), key=lambda kv: -kv[1]["加班时长"])]
    ot_supplier = [{"供应商": k, **v} for k, v in
                   sorted(sup.items(), key=lambda kv: -kv[1]["加班时长"])]
    ot_job = [{"工种": k, **v} for k, v in
              sorted(job.items(), key=lambda kv: -kv[1]["加班时长"])]
    return {
        "ot_daily": (["考勤日期", "供应商", "仓库", "工种", "工作时长", "加班时长"], ot_daily),
        "ot_warehouse": (["仓库", "工作时长", "加班时长"], ot_warehouse),
        "ot_supplier": (["供应商", "工作时长", "加班时长"], ot_supplier),
        "ot_job": (["工种", "工作时长", "加班时长"], ot_job),
    }


def build_arrival(rows):
    """
    到岗数据集：有首打卡时间 = 有物理到场证据。
    只算考勤类型=派遣考勤（匹配已派遣人群）；没有考勤类型列时不过滤。
    """
    has_type_col = any(r["考勤类型"] for r in rows)
    arrived = [r for r in rows
               if r["首打卡"] and (not has_type_col or r["考勤类型"] == "派遣考勤")]

    by_day = defaultdict(list)
    by_sup, by_wh = defaultdict(list), defaultdict(list)
    for r in arrived:
        by_day[r["考勤日期"]].append(r)
        by_sup[r["供应商"]].append(r)
        by_wh[r["仓库"]].append(r)

    def stats(rs):
        persons = {r["工号"] or r["姓名"] for r in rs if r["工号"] or r["姓名"]}
        return {"到岗人数": len(persons),
                "到岗人次": len(rs),
                "有工时人数": len({r["工号"] or r["姓名"] for r in rs
                                   if (r["工号"] or r["姓名"]) and r["工作时长"] > 0})}

    arrival_daily = [{"考勤日期": k, **stats(v)} for k, v in sorted(by_day.items())]
    arrival_supplier = [{"供应商": k, **stats(v)} for k, v in
                        sorted(by_sup.items(), key=lambda kv: -len(kv[1]))]
    arrival_warehouse = [{"仓库": k, **stats(v)} for k, v in
                         sorted(by_wh.items(), key=lambda kv: -len(kv[1]))]
    return {
        "arrival_daily": (["考勤日期", "到岗人数", "到岗人次", "有工时人数"], arrival_daily),
        "arrival_supplier": (["供应商", "到岗人数", "到岗人次", "有工时人数"], arrival_supplier),
        "arrival_warehouse": (["仓库", "到岗人数", "到岗人次", "有工时人数"], arrival_warehouse),
    }, arrived


# ------------------------------------------------------------------
# 主流程
# ------------------------------------------------------------------

def main():
    here = Path(__file__).parent
    root = here.parent
    raw_dir = root / "data" / "raw"
    dashboard_path = root / "data" / "processed" / "dashboard.json"

    if len(sys.argv) > 1:
        att_path = Path(sys.argv[1])
        if not att_path.exists():
            print(f"❌ 找不到文件: {att_path}")
            sys.exit(1)
    else:
        found = find_attendance_file(raw_dir)
        if not found:
            print(f"❌ 在 {raw_dir} 下没找到有数据的考勤表 "
                  f"（sheet 含“考勤”且表头含“考勤日期”的 xlsx）。")
            print("   只有表头的空导出会被自动跳过，请确认导出的表有数据行。")
            sys.exit(1)
        att_path = found[0]
        if len(found) > 1:
            print(f"   找到 {len(found)} 个考勤表，用第一个: {att_path.name}")

    print("=" * 60)
    print("  考勤解析 - OT + 到岗数据集")
    print("=" * 60)
    print(f"\n[1/3] 读取: {att_path.name}")
    rows = read_attendance(att_path)
    print(f"      考勤记录 {len(rows)} 行（已按工号+日期去重）")

    if not dashboard_path.exists():
        print(f"\n❌ 找不到 {dashboard_path}，请先跑 python3 scripts/run_all.py")
        sys.exit(1)

    print("\n[2/3] 构建数据集")
    datasets = {}
    datasets.update(build_ot(rows))
    arrival_sets, arrived = build_arrival(rows)
    datasets.update(arrival_sets)
    for name, (cols, data) in datasets.items():
        print(f"      {name:20s} {len(data):6d} 行")

    print("\n[3/3] 合并进 dashboard.json")
    with open(dashboard_path, encoding="utf-8") as f:
        dashboard = json.load(f)
    for name, (cols, data) in datasets.items():
        dashboard[name] = {"rows": len(data), "columns": cols, "data": data}
    with open(dashboard_path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, ensure_ascii=False)
    print(f"      已写入: {dashboard_path} ({dashboard_path.stat().st_size // 1024} KB)")

    # ---- 校验报告 ----
    print("\n" + "-" * 60)
    print("校验报告")
    print("-" * 60)
    dates = sorted({r["考勤日期"] for r in rows})
    total_work = round(sum(r["工作时长"] for r in rows), 2)
    total_ot = round(sum(r["加班时长"] for r in rows), 2)
    ot_rate = f"{total_ot / total_work * 100:.1f}%" if total_work else "N/A"
    persons = {r["工号"] or r["姓名"] for r in arrived if r["工号"] or r["姓名"]}
    type_dist = defaultdict(int)
    for r in rows:
        type_dist[r["考勤类型"] or "（空）"] += 1
    print(f"  • 考勤日期范围: {dates[0]} ~ {dates[-1]}（{len(dates)} 天）")
    print(f"  • 考勤类型分布: " + " / ".join(f"{k} {v}行" for k, v in type_dist.items()))
    print(f"  • 到岗: {len(persons)} 人 / {len(arrived)} 人次 "
          f"（有首打卡时间、考勤类型=派遣考勤）")
    print(f"  • 总工作时长: {total_work} 小时 / 总加班时长: {total_ot} 小时 / "
          f"加班率: {ot_rate}")
    print(f"  • 供应商 {len({r['供应商'] for r in rows})} 家 / "
          f"仓库 {len({r['仓库'] for r in rows})} 个 / "
          f"工种 {len({r['工种'] for r in rows})} 种")
    if warnings:
        seen = set()
        print("\n  数据问题 warning（已如实保留，未改动数据）：")
        for w in warnings:
            if w not in seen:
                seen.add(w)
                print(f"  ⚠ {w}")
    print("\n🎉 完成。改完后重启 npm run dev 再看页面。")


if __name__ == "__main__":
    main()
