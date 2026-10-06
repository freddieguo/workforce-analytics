import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path("data/processed")


def main():

    input_path = PROCESSED_DIR / "dispatch.csv"
    output_path = PROCESSED_DIR / "supplier_allocation.csv"

    df = pd.read_csv(input_path)

    allocation_columns = [
        "需求日期",
        "需求仓",
        "需求组",
        "工种",
        "班次",
        "供应商",
        "供应商ID"
    ]

    metric_columns = [
        "供应商需派遣人数",
        "供应商未派遣人数",
        "供应商已派遣人数"
    ]

    # =====================================================
    # 每个供应商分配只保留一条
    # =====================================================

    allocation = (
        df[
            allocation_columns + metric_columns
        ]
        .drop_duplicates()
        .copy()
    )

    # =====================================================
    # 计算 Fill Rate
    # =====================================================

    allocation["供应商Fill Rate"] = (
        allocation["供应商已派遣人数"]
        / allocation["供应商需派遣人数"]
        .replace(0, pd.NA)
        * 100
    )

    # =====================================================
    # 保存
    # =====================================================

    allocation.to_csv(
        output_path,
        index=False,
        encoding="utf-8-sig"
    )

    print("\n" + "=" * 70)
    print("供应商分配表")
    print("=" * 70)

    print(
        f"\n分配数量：{len(allocation):,}"
    )

    print(
        f"\n保存：{output_path}"
    )

    print("\n前 20 条：")

    print(
        allocation.head(20)
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()