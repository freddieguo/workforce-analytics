"""
run_all.py — 数据管线总入口

用法：
    python run_all.py [raw_dir] [dashboard.json 输出路径]

默认：
    raw_dir  = ../data/raw          （6 个 OTWS 导出 Excel 放这里）
    输出     = ../data/processed/dashboard.json

流程只有三步：读原始文件 -> 建 25 个数据集 -> 写 dashboard.json。
最后打印校验报告：行数、口径勾稽、数据问题 warning。
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import load_raw, warnings
from datasets import build_all


def check_consistency(raw):
    """口径勾稽，有问题只记 warning，不改数据。返回 (errors, infos)。"""
    errors, infos = [], []

    # 1. 发单已发单人数按组汇总 == 需求已发单人数（应完全一致）
    d_sum = defaultdict(int)
    for r in raw["demand"]:
        d_sum[(r["需求日期"], r["需求仓"], r["需求组"], r["工种"], r["班次"])] += r["已发单人数"]
    a_sum = defaultdict(int)
    for r in raw["alloc"]:
        a_sum[(r["需求日期"], r["需求仓"], r["需求组"], r["工种"], r["班次"])] += r["供应商需派遣人数"]
    # 注意：工种一方带 Level 一方不带，这里按归一化名对比
    mismatch = sum(1 for k, v in d_sum.items() if a_sum.get(k, 0) != v)
    infos.append(f"需求-发单已发单人数勾稽: {len(d_sum) - mismatch}/{len(d_sum)} 组一致")

    # 2. 超分：已发单 > 需求人数（源数据问题，如实保留）
    over = [r for r in raw["demand"] if r["已发单人数"] > r["需求人数"]]
    if over:
        infos.append(f"超分提醒: {len(over)} 条需求的已发单人数超过需求人数 "
                     f"(如 {over[0]['需求日期']} {over[0]['需求仓']} "
                     f"{over[0]['工种']} 需求{over[0]['需求人数']}人/已发单{over[0]['已发单人数']}人)，"
                     f"数据原样保留未做截断")

    # 3. 基本信息透视表交叉校验
    #    说明：透视表对 "09-06~09-07" 这类区间行的记法是逐日重复记
    #    （2个人在09-06和09-07各记2），而管线按一行一条需求处理，
    #    所以区间行所在组会出现 1 组差异，这是已知的、合理的。
    if raw["basic_info"]:
        d_grp = defaultdict(int)
        for r in raw["demand"]:
            d_grp[(r["需求区域"], r["需求仓"], r["需求组"], r["需求日期"])] += r["需求人数"]
        bad = [(k, d_grp.get(k, 0), v["需求总人数"])
               for k, v in raw["basic_info"].items()
               if d_grp.get(k, 0) != v["需求总人数"]]
        infos.append(f"基本信息透视表校验: {len(raw['basic_info']) - len(bad)}/"
                     f"{len(raw['basic_info'])} 组需求总人数一致")
        for k, mine, pivot in bad[:5]:
            infos.append(f"    差异组 {k[1]}/{k[2]}/{k[3]}: 管线={mine} 透视表={pivot}")

    # 4. 空源文件
    for path, kind in raw["empty_sources"]:
        infos.append(f"空源文件: {Path(path).name}（{kind}）只有表头没有数据行")

    return errors, infos


def main():
    here = Path(__file__).parent
    root = here.parent
    raw_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "raw"
    out_path = (Path(sys.argv[2]) if len(sys.argv) > 2
                else root / "data" / "processed" / "dashboard.json")

    print("=" * 60)
    print("  Workforce Analytics - 数据管线")
    print("=" * 60)

    # ---- 1. 读原始文件 ----
    print(f"\n[1/3] 读取原始文件: {raw_dir}")
    raw = load_raw(raw_dir)
    for path, kind in raw["files"].items():
        print(f"      {Path(path).name} -> {kind}")
    if not raw["demand"]:
        print("\n❌ 没有读到任何需求数据，停止。")
        sys.exit(1)
    print(f"      需求 {len(raw['demand'])} 行 / "
          f"发单 {len(raw['alloc'])} 行 / "
          f"派遣名单 {len(raw['dispatch'])} 行 / "
          f"考勤 {len(raw['attendance'])} 行 / "
          f"临时工派遣 {len(raw['temp_dispatch'])} 行")

    # ---- 2. 建数据集 ----
    print("\n[2/3] 构建数据集")
    datasets = build_all(raw)
    dashboard = {}
    for name, (columns, rows) in datasets.items():
        dashboard[name] = {"rows": len(rows), "columns": columns, "data": rows}
        flag = " (空)" if not rows else ""
        print(f"      {name:36s} {len(rows):6d} 行{flag}")

    # ---- 3. 写 dashboard.json ----
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, ensure_ascii=False)
    print(f"\n[3/3] 已写入: {out_path} ({out_path.stat().st_size // 1024} KB)")

    # ---- 校验报告 ----
    print("\n" + "-" * 60)
    print("校验报告")
    print("-" * 60)
    errors, infos = check_consistency(raw)
    for info in infos:
        print(f"  • {info}")
    if warnings:
        print("\n数据问题 warning（已如实保留，未改动数据）：")
        seen = set()
        for w in warnings:
            if w not in seen:
                seen.add(w)
                print(f"  ⚠ {w}")
    if errors:
        print("\n❌ 校验失败:")
        for e in errors:
            print(f"  {e}")
        sys.exit(1)
    print("\n🎉 管线完成")


if __name__ == "__main__":
    main()
