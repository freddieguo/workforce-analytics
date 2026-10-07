import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path("data/processed")


def main():

    input_path = PROCESSED_DIR / "supplier_allocation.csv"

    df = pd.read_csv(input_path)

    print("\n" + "=" * 70)
    print("仓库分析")
    print("=" * 70)

    # =====================================================
    # 1. 按仓库汇总供应商分配数据
    # =====================================================

    warehouse_summary = (
        df
        .groupby("需求仓", dropna=False)
        .agg(
            需求人数=("供应商需派遣人数", "sum"),
            已派遣人数=("供应商已派遣人数", "sum"),
            未派遣人数=("供应商未派遣人数", "sum"),
            分配次数=("需求仓", "size")
        )
        .reset_index()
    )

    # =====================================================
    # 2. 计算 Fill Rate
    # =====================================================

    warehouse_summary["Fill Rate"] = (
        warehouse_summary["已派遣人数"]
        / warehouse_summary["需求人数"].replace(0, pd.NA)
        * 100
    )

    # 按需求人数从高到低
    warehouse_summary = warehouse_summary.sort_values(
        "需求人数",
        ascending=False
    )

    # =====================================================
    # 3. 输出
    # =====================================================

    print("\n仓库数量：")
    print(len(warehouse_summary))

    print("\n仓库整体表现：")

    print(
        warehouse_summary.to_string(index=False)
    )

    # =====================================================
    # 4. 按仓库 + 工种分析
    # =====================================================

    warehouse_job = (
        df
        .groupby(
            ["需求仓", "工种"],
            dropna=False
        )
        .agg(
            需求人数=("供应商需派遣人数", "sum"),
            已派遣人数=("供应商已派遣人数", "sum"),
            未派遣人数=("供应商未派遣人数", "sum"),
            分配次数=("需求仓", "size")
        )
        .reset_index()
    )

    warehouse_job["Fill Rate"] = (
        warehouse_job["已派遣人数"]
        / warehouse_job["需求人数"].replace(0, pd.NA)
        * 100
    )

    # =====================================================
    # 5. 保存
    # =====================================================

    warehouse_summary.to_csv(
        PROCESSED_DIR / "warehouse_summary.csv",
        index=False,
        encoding="utf-8-sig"
    )

    warehouse_job.to_csv(
        PROCESSED_DIR / "warehouse_job.csv",
        index=False,
        encoding="utf-8-sig"
    )

    print("\n" + "=" * 70)
    print("分析结果已保存")
    print("=" * 70)

    print("\n生成：")
    print("warehouse_summary.csv")
    print("warehouse_job.csv")


if __name__ == "__main__":
    main()
    