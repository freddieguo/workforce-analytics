import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path("data/processed")


def main():

    path = PROCESSED_DIR / "dispatch.csv"

    df = pd.read_csv(path)

    print("\n" + "=" * 70)
    print("供应商分配结构检查")
    print("=" * 70)

    # 用来判断一次供应商分配的字段
    allocation_columns = [
        "需求日期",
        "需求仓",
        "需求组",
        "工种",
        "班次",
        "供应商",
        "供应商ID"
    ]

    print("\n检查字段：")
    print(allocation_columns)

    # =====================================================
    # 1. 检查这些字段组合有多少种
    # =====================================================

    allocation = (
        df[
            allocation_columns +
            [
                "供应商需派遣人数",
                "供应商未派遣人数",
                "供应商已派遣人数"
            ]
        ]
        .drop_duplicates()
    )

    print(
        f"\n原始派遣记录：{len(df):,}"
    )

    print(
        f"去除完全相同记录后：{len(allocation):,}"
    )

    # =====================================================
    # 2. 检查同一个分配组合是否出现多个不同人数
    # =====================================================

    check = (
        df.groupby(allocation_columns, dropna=False)[
            [
                "供应商需派遣人数",
                "供应商未派遣人数",
                "供应商已派遣人数"
            ]
        ]
        .nunique()
        .reset_index()
    )

    problematic = check[
        (check["供应商需派遣人数"] > 1) |
        (check["供应商未派遣人数"] > 1) |
        (check["供应商已派遣人数"] > 1)
    ]

    print(
        f"\n同一分配组合出现不同人数的情况："
        f"{len(problematic):,} 条"
    )

    if len(problematic) > 0:

        print("\n前 20 条问题记录：")

        print(
            problematic.head(20).to_string(index=False)
        )

    else:

        print(
            "\n✓ 没有发现同一分配组合对应多个不同人数。"
        )

    # =====================================================
    # 3. 看看一个分配通常对应几个员工
    # =====================================================

    worker_count = (
        df.groupby(allocation_columns, dropna=False)
        ["员工工号"]
        .count()
        .reset_index(name="员工记录数")
    )

    print("\n员工记录数分布：")

    print(
        worker_count["员工记录数"]
        .value_counts()
        .sort_index()
        .head(20)
    )


if __name__ == "__main__":
    main()