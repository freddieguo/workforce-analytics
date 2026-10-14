"""
common.py — 原始 Excel 读取与归一化

只做一件事：把 OTWS 导出文件读成干净的 Python 记录。
不做任何业务聚合，聚合在 datasets.py 里。

只认 2 种文件（按 sheet 名 + 表头识别，不按文件名）：
  - 有「需求详情」+「发单详情」sheet  -> 需求池文件（旧格式）
  - 只有「需求详情」sheet，或 Sheet1 内容是需求详情（需求区域/需求仓/需求日期） -> 需求池文件（新格式单 Sheet，只有需求，没有发单分拆）
  - 有 Sheet1（含 NO SHOW / 不符合要求原因列） -> 人员到岗表

防重复导入：按文件内容哈希去重。同一个文件放两次（哪怕改了名），
只算一次。内容有重叠但不完全相同的文件（比如全月文件 + 每日文件
同时存在）不会自动去重——同一天的数据只放在一个文件里。
"""

import hashlib
import re
from pathlib import Path

import openpyxl

# 注意：不要用 read_only=True。OTWS 导出的文件用了 inlineStr 存单元格，
# openpyxl 3.1.2 的 read_only 流式解析读这种文件只吐出表头一行就停，
# 会误判成空文件（2026-10-06 实测）。普通模式读取正常。

# 收集数据问题，最后统一打印，不中断流程
warnings = []


def warn(msg):
    warnings.append(msg)


def reset_warnings():
    warnings.clear()


# ------------------------------------------------------------------
# 基础转换
# ------------------------------------------------------------------

def to_int(value):
    """1.0 -> 1, None/空 -> 0"""
    if value is None or value == "":
        return 0
    try:
        f = float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0
    return int(f) if f == int(f) else f


def to_str(value):
    if value is None:
        return ""
    return str(value).strip()


def to_float(value):
    """None/空 -> 0.0"""
    if value is None or (isinstance(value, str) and not value.strip()):
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def parse_date(value, context=""):
    """
    需求日期归一化 -> "YYYY-MM-DD"。
    遇到 "2026-09-30~2026-10-01" 这种区间写法，取开始日期
    （需求开始到岗的日期；基本信息透视表对区间行的记法本身就不一致，
    有记在开始日的、有两天都记的，这里统一按开始日期归属，并在
    warning 里记一笔，透视表逐日比对时排除区间行）。
    解析失败返回 "" 并记 warning（调用方决定是否丢弃该行）。
    """
    if value is None or str(value).strip() == "":
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$", s)
    if m:
        warn(f"日期区间写法已取开始日期: {s} -> {m.group(1)} ({context})")
        return m.group(1)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})$", s)
    if m:
        return m.group(1)
    # MM-DD-YYYY（美式，人员到岗表 Report Date 如 09-15-2026）。
    # 第一部分 >12 时只能是 DD-MM-YYYY，按日-月解析；否则按美式月-日。
    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})$", s)
    if m:
        a, b, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a > 12 and 1 <= b <= 12 and 1 <= a <= 31:
            return f"{yr:04d}-{b:02d}-{a:02d}"  # DD-MM-YYYY
        if 1 <= a <= 12 and 1 <= b <= 31:
            return f"{yr:04d}-{a:02d}-{b:02d}"  # MM-DD-YYYY
        warn(f"无法解析的日期: {s} ({context})")
        return ""
    # Excel 数字日期
    try:
        f = float(s)
        from datetime import datetime, timedelta
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=int(f))).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        pass
    warn(f"无法解析的日期: {s} ({context})")
    return ""


# ------------------------------------------------------------------
# 工种归一化
# ------------------------------------------------------------------
# 需求详情里是 "Cherry Picker I"（带 Level），发单详情里是 "Cherry Picker"。
# 跨表对比时用归一化名，原始名保留在「原始工种」列里备查。
# 只去掉末尾的罗马数字 Level（I/II/III），不合并不同工种
#（比如不会把「卸柜员」和 Lumper 合并）。

_LEVEL_SUFFIX = re.compile(r"\s+[IVX]{1,3}$")


def norm_job(name):
    original = to_str(name)
    normalized = _LEVEL_SUFFIX.sub("", original).strip()
    return normalized or original, original


# ------------------------------------------------------------------
# 文件分类与内容哈希
# ------------------------------------------------------------------

def _file_hash(path):
    """文件内容 SHA256。内容完全相同的文件 -> 同一个哈希。"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def classify_workbook(path):
    wb = openpyxl.load_workbook(path, read_only=False, data_only=True)
    sheets = set(wb.sheetnames)
    kind = "unknown"
    if "需求详情" in sheets and "发单详情" in sheets:
        kind = "demand_pool"
    elif "需求详情" in sheets:
        # 新格式：只有需求详情一个 sheet，没有发单详情/基本信息
        kind = "demand_pool"
    elif "Sheet1" in sheets:
        # Sheet1 可能是人员到岗表，也可能是新格式单 Sheet 需求详情（Sheet 名是默认的 Sheet1）
        ws = wb["Sheet1"]
        hdr = " ".join(
            str(ws.cell(1, c).value or "") for c in range(1, ws.max_column + 1)
        ).upper()
        if "NO SHOW" in hdr and "FUFILLED" in hdr:
            # 人员到岗表：Sheet1，有 NO SHOW 和 Not Fufilled Reason 列
            kind = "arrival_tracking"
        elif "需求区域" in hdr and "需求仓" in hdr and "需求日期" in hdr:
            # 新格式单 Sheet 需求池：Sheet1 内容是需求详情
            kind = "demand_pool"
    wb.close()
    return kind


# ------------------------------------------------------------------
# 需求池文件：需求详情 / 发单详情 / 基本信息
# ------------------------------------------------------------------

def read_demand_detail(ws):
    """需求详情 -> list[dict]，一行一条需求（日期+仓+组+工种+班次）"""
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        if r[0] is None and r[1] is None:
            continue
        date_raw = r[3]
        is_range = isinstance(date_raw, str) and "~" in date_raw
        date = parse_date(date_raw, context=f"需求详情第{i+1}行")
        if not date:
            warn(f"需求详情第{i+1}行日期为空，已跳过")
            continue
        job_norm, job_orig = norm_job(r[4])
        rows.append({
            "_is_range": is_range,  # 校验用：透视表逐日比对时排除
            "需求区域": to_str(r[0]),
            "需求仓": to_str(r[1]),
            "需求组": to_str(r[2]),
            "需求日期": date,
            "工种": job_norm,
            "原始工种": job_orig,
            "班次": to_str(r[5]),
            "需求人数": to_int(r[6]),
            "待发单人数": to_int(r[7]),
            "已发单人数": to_int(r[8]),
            "待派遣人数": to_int(r[9]),
            "已派遣人数": to_int(r[10]),
            "用工要求": to_str(r[11]),
            "建议派遣人员": to_str(r[12]),
            "关联申请编号": to_str(r[13]),
        })
    return rows


def read_alloc_detail(ws):
    """发单详情 -> list[dict]，一行一条供应商分配"""
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        if r[0] is None:
            continue
        date = parse_date(r[6], context=f"发单详情第{i+1}行")
        if not date:
            warn(f"发单详情第{i+1}行日期为空，已跳过")
            continue
        job_norm, job_orig = norm_job(r[7])
        rows.append({
            "供应商": to_str(r[0]),
            "供应商名称": to_str(r[0]),
            "供应商ID": to_str(r[1]),
            "类型": to_str(r[2]),
            "需求区域": to_str(r[3]),
            "需求仓": to_str(r[4]),
            "需求组": to_str(r[5]),
            "需求日期": date,
            "工种": job_norm,
            "原始工种": job_orig,
            "班次": to_str(r[8]),
            # 口径：已发单人数 = 分给该供应商的人数（供应商的"需求"）
            "供应商需派遣人数": to_int(r[9]),
            "供应商未派遣人数": to_int(r[10]),
            "供应商已派遣人数": to_int(r[11]),
            "用工要求": to_str(r[12]),
            "建议派遣人员": to_str(r[13]),
        })
    return rows


def read_basic_info(ws):
    """
    基本信息（透视表）-> {(区域,仓,组,日期): {需求总人数, 补员, ...}}
    只用于交叉校验，不进 dashboard。
    """
    # 第0行是日期头（每7列一个日期），第1行是子列头
    header0, header1 = None, None
    info = {}
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            header0 = [to_str(v) for v in r]
            continue
        if i == 1:
            header1 = [to_str(v) for v in r]
            continue
        if r[0] is None:
            continue
        area, wh, grp = to_str(r[0]), to_str(r[1]), to_str(r[2])
        # 每7列一组：需求总人数|补员|待发单人数|已发单人数|待派遣人数|已派遣人数|需求完成率
        for start in range(3, len(header0) - 1, 7):
            date_label = header0[start]  # 如 "09-01(周二)"
            m = re.match(r"(\d{2})-(\d{2})", date_label)
            if not m:
                continue
            date = f"2026-{m.group(1)}-{m.group(2)}"
            vals = [to_int(r[start + k]) if start + k < len(r) else 0
                    for k in range(6)]
            if any(vals):
                info[(area, wh, grp, date)] = {
                    "需求总人数": vals[0],
                    "补员": vals[1],
                    "待发单人数": vals[2],
                    "已发单人数": vals[3],
                    "待派遣人数": vals[4],
                    "已派遣人数": vals[5],
                }
    return info


def read_arrival_tracking(ws):
    """
    人员到岗表 (Sheet1) -> list[dict]，一行一条拟到岗记录。

    用户口径：
      - NO SHOW 未勾选（0/空）= 到岗
      - 到岗 且 不符合要求原因 为空 = 已接受
      - NO SHOW 勾选（1）= no show
      - 不符合要求原因 非空 = not qualify（被退回）
    """
    header = [to_str(v) for v in next(ws.iter_rows(values_only=True))]
    hdr_up = [h.upper() for h in header]
    if not any("NO SHOW" in h for h in hdr_up):
        return None
    # 列定位（表头是中英双语，取包含关键词的列）
    def col(*keys):
        for i, h in enumerate(hdr_up):
            if all(k in h for k in keys):
                return i
        return None
    i_loc = col("LOCATION")
    i_date = col("REPORT DATE")
    i_pos = col("POSITION")
    i_agency = col("AGENCY")
    i_name = col("EMPLOYEE NAME")
    i_id = col("OTWS ID")
    i_noshow = next((i for i, h in enumerate(hdr_up) if "NO SHOW" in h), None)
    i_reason = next((i for i, h in enumerate(hdr_up) if "FUFILLED" in h), None)
    rows = []
    for n, row in enumerate(ws.iter_rows(values_only=True)):
        if n == 0:
            continue
        name = to_str(row[i_name]) if i_name is not None else ""
        wid = to_str(row[i_id]) if i_id is not None else ""
        # 用户口径：有 OTWS ID 才算需求日到场
        if not wid:
            continue
        noshow_raw = to_str(row[i_noshow]).strip() if i_noshow is not None else ""
        reason = to_str(row[i_reason]).strip() if i_reason is not None else ""
        is_noshow = noshow_raw == "1"
        arrived = not is_noshow
        accepted = arrived and not reason
        rows.append({
            "仓库": to_str(row[i_loc]).strip() if i_loc is not None else "未分类",
            "到岗日期": parse_date(row[i_date], context=f"人员到岗第{n+1}行")
                        if i_date is not None else None,
            "职位": to_str(row[i_pos]) if i_pos is not None else "",
            "机构": to_str(row[i_agency]).strip() if i_agency is not None else "未分类",
            "姓名": name,
            "工号": wid,
            "是否NoShow": is_noshow,
            "不符合要求原因": reason,
            "到岗": arrived,
            "已接受": accepted,
        })
    return rows


# ------------------------------------------------------------------
# 入口：读整个 raw 目录
# ------------------------------------------------------------------

def load_raw(raw_dir):
    """
    返回 {
      "demand": [...],        # 需求详情行
      "alloc": [...],         # 发单详情行
      "arrival_tracking": [...],  # 人员到岗行
      "basic_info": {...},    # 基本信息透视（仅校验用）
      "files": {path: kind},  # 识别到的文件
      "empty_sources": [...], # 有表头但零数据的文件
      "skipped_dupes": [...], # 内容重复被跳过的文件
    }
    每天导数：把当天的新文件放进 raw 目录，重跑即可。
    同一文件放两次（改名也算）会被内容哈希认出并跳过。
    """
    reset_warnings()
    raw_dir = Path(raw_dir)
    out = {
        "demand": [], "alloc": [], "arrival_tracking": [],
        "basic_info": {}, "files": {}, "empty_sources": [],
        "skipped_dupes": [],
    }
    seen_hashes = {}
    for path in sorted(raw_dir.glob("*.xlsx")):
        if path.name.startswith("~$"):
            continue
        # 文件级去重：内容完全相同的文件只读一次
        digest = _file_hash(path)
        if digest in seen_hashes:
            out["skipped_dupes"].append(str(path))
            warn(f"文件内容与 {seen_hashes[digest]} 完全相同，已跳过"
                 f"（防重复导入）: {path.name}")
            continue
        seen_hashes[digest] = path.name
        kind = classify_workbook(path)
        out["files"][str(path)] = kind
        wb = openpyxl.load_workbook(path, read_only=False, data_only=True)
        if kind == "demand_pool":
            # 旧格式：需求详情 + 发单详情 + 基本信息；新格式：只有需求详情，或 Sheet1 即需求详情
            if "需求详情" in wb.sheetnames:
                out["demand"].extend(read_demand_detail(wb["需求详情"]))
            elif "Sheet1" in wb.sheetnames:
                out["demand"].extend(read_demand_detail(wb["Sheet1"]))
            if "发单详情" in wb.sheetnames:
                out["alloc"].extend(read_alloc_detail(wb["发单详情"]))
            else:
                warn(f"{path.name} 没有发单详情 sheet，已发单/已派遣分拆将为空")
            # 基本信息不再读取：只用于校验，不进看板，已去掉（不再 check 基本信息）
        elif kind == "arrival_tracking":
            at = (read_arrival_tracking(wb["Sheet1"])
                  if "Sheet1" in wb.sheetnames else None)
            if at:
                out["arrival_tracking"].extend(at)
            else:
                out["empty_sources"].append((str(path), kind))
                warn(f"{path.name} 只有表头、没有数据行，到岗/接受指标将为空")
        else:
            warn(f"无法识别的文件已跳过: {path.name}")
        wb.close()
    return out
