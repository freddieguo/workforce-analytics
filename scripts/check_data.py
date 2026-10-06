import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path("data/processed")


def main():

    dispatch_path = PROCESSED_DIR / "dispatch.csv"
    demand_path = PROCESSED_DIR / "demand.csv"

    print("\n" + "=" * 70)
    print("派遣人员数据检查")
    print("=" * 70)

    dispatch = pd.read_csv(dispatch_path)

    print(f"\n行数：{len(dispatch):,}")
    print(f"列数：{len(dispatch.columns)}")

    print("\n字段：")
    print(dispatch.columns.tolist())

    print("\n供应商：")

    if "供应商名称" in dispatch.columns:
        print(
            dispatch["供应商名称"]
            .dropna()
            .unique()
        )

    print("\n仓库：")

    if "需求仓" in dispatch.columns:
        print(
            dispatch["需求仓"]
            .dropna()
            .unique()
        )

        print("\n派遣人员相关字段前 20 行：")

    print(
    dispatch[
        [
            "供应商需派遣人数",
            "供应商未派遣人数",
            "供应商已派遣人数",
            "派遣人员名单",
            "派遣人员名单.1",
            "派遣人员名单.2",
            "派遣人员名单.3",
            "派遣人员名单.4"
        ]
    ].head(20).to_string(index=False)
)


    print("\n" + "=" * 70)
    print("用工需求数据检查")
    print("=" * 70)

    demand = pd.read_csv(demand_path)

    print(f"\n行数：{len(demand):,}")
    print(f"列数：{len(demand.columns)}")

    print("\n字段：")
    print(demand.columns.tolist())

    print("\n日期：")

    if "日期" in demand.columns:
        print(
            demand["日期"].min(),
            "→",
            demand["日期"].max()
        )

        print(
            "\n日期数量：",
            demand["日期"].nunique()
        )

    print("\n仓库：")

    if "需求仓" in demand.columns:
        print(
            demand["需求仓"]
            .dropna()
            .unique()
        )

    

if __name__ == "__main__":
    main()