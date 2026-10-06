import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path("data/processed")


def calculate_summary(df, group_columns):
    """
    按指定维度汇总供应商派遣表现。
    """

    summary = (
        df
        .groupby(group_columns, dropna=False)
        .agg(
            需求人数=("供应商需派遣人数", "sum"),
            已派遣人数=("供应商已派遣人数", "sum"),
            未派遣人数=("供应商未派遣人数", "sum"),
            分配次数=("供应商", "size")
        )
        .reset_index()
    )

    # Fill Rate = 已派遣 / 需求
    summary["Fill Rate"] = (
        summary["已派遣人数"]
        / summary["需求人数"].replace(0, pd.NA)
        * 100
    )

    return summary


def main():

    input_path = PROCESSED_DIR / "supplier_allocation.csv"

    df = pd.read_csv(input_path)

    print("\n" + "=" * 70)
    print("供应商分析")
    print("=" * 70)

    # =====================================================
    # 1. 基础数据
    # =====================================================

    print(f"\n供应商分配记录：{len(df):,}")

    # 有供应商名称的记录
    supplier_df = df[
        df["供应商"].notna()
    ].copy()

    # 没有供应商名称的记录
    missing_supplier_df = df[
        df["供应商"].isna()
    ].copy()

    print(
        f"有供应商记录：{len(supplier_df):,}"
    )

    print(
        f"缺少供应商记录：{len(missing_supplier_df):,}"
    )

    # =====================================================
    # 2. 供应商总体表现
    # =====================================================

    supplier_summary = calculate_summary(
        supplier_df,
        ["供应商", "供应商ID"]
    )

    supplier_summary = supplier_summary.sort_values(
        "Fill Rate",
        ascending=False
    )

    print("\n" + "-" * 70)
    print("1. 供应商总体表现")
    print("-" * 70)

    print(
        supplier_summary.to_string(index=False)
    )

    # =====================================================
    # 3. 供应商 × 仓库
    # =====================================================

    supplier_warehouse = calculate_summary(
        supplier_df,
        [
            "供应商",
            "供应商ID",
            "需求仓"
        ]
    )

    supplier_warehouse = supplier_warehouse.sort_values(
        ["供应商", "Fill Rate"],
        ascending=[True, False]
    )

    print("\n" + "-" * 70)
    print("2. 供应商 × 仓库")
    print("-" * 70)

    print(
        supplier_warehouse.head(50)
        .to_string(index=False)
    )

    # =====================================================
    # 4. 供应商 × 工种
    # =====================================================

    supplier_job = calculate_summary(
        supplier_df,
        [
            "供应商",
            "供应商ID",
            "工种"
        ]
    )

    supplier_job = supplier_job.sort_values(
        ["供应商", "Fill Rate"],
        ascending=[True, False]
    )

    print("\n" + "-" * 70)
    print("3. 供应商 × 工种")
    print("-" * 70)

    print(
        supplier_job.head(50)
        .to_string(index=False)
    )

    # =====================================================
    # 5. 保存分析结果
    # =====================================================

    supplier_summary.to_csv(
        PROCESSED_DIR / "supplier_summary.csv",
        index=False,
        encoding="utf-8-sig"
    )

    supplier_warehouse.to_csv(
        PROCESSED_DIR / "supplier_warehouse.csv",
        index=False,
        encoding="utf-8-sig"
    )

    supplier_job.to_csv(
        PROCESSED_DIR / "supplier_job.csv",
        index=False,
        encoding="utf-8-sig"
    )

    missing_supplier_df.to_csv(
        PROCESSED_DIR / "missing_supplier_allocation.csv",
        index=False,
        encoding="utf-8-sig"
    )

    print("\n" + "=" * 70)
    print("分析结果已保存")
    print("=" * 70)

    print("\n生成：")
    print("supplier_summary.csv")
    print("supplier_warehouse.csv")
    print("supplier_job.csv")
    print("missing_supplier_allocation.csv")


if __name__ == "__main__":
    main()