import pandas as pd
from pathlib import Path
import re


DATA_DIR = Path("data")
PROCESSED_DIR = DATA_DIR / "processed"


# =========================================================
# 1. 合并派遣人员名单
# =========================================================

def load_dispatch_data():
    """
    将上半月和下半月的派遣人员名单直接上下合并。
    不删除、不去重、不修改原始记录。
    """

    files = sorted(DATA_DIR.glob("派遣人员名单*.xlsx"))

    if not files:
        raise FileNotFoundError("没有找到派遣人员名单 Excel")

    dataframes = []

    for file in files:
        print(f"读取：{file.name}")

        df = pd.read_excel(file)

        # Excel 第一行是重复表头，不是实际数据
        df = df[df["序号"] != "序号"].copy()

        # 标准化派遣人员字段名称
        df = df.rename(columns={
            "派遣人员名单": "供应商",
            "派遣人员名单.1": "供应商ID",
            "派遣人员名单.2": "员工姓名",
            "派遣人员名单.3": "员工工号",
            "派遣人员名单.4": "派遣开始日期"
        })

        # 保存原始文件名称
        df["来源文件"] = file.name

        dataframes.append(df)

    # 上半月 + 下半月
    combined = pd.concat(
        dataframes,
        ignore_index=True
    )

    return combined


# =========================================================
# 2. 合并用工需求池
# =========================================================

def load_demand_data():
    """
    将上下半月用工需求池转换成统一的日期格式，
    然后上下合并。

    原始 Excel：
        09-01 → 09-15
        09-16 → 09-30

    最终：
        日期 + 区域 + 仓库 + 组 + 各项指标
    """

    files = sorted(DATA_DIR.glob("用工需求池*.xlsx"))

    if not files:
        raise FileNotFoundError("没有找到用工需求池 Excel")

    all_records = []

    metric_names = [
        "需求总人数",
        "补员",
        "待发单人数",
        "已发单人数",
        "待派遣人数",
        "已派遣人数",
        "需求完成率"
    ]

    for file in files:

        print(f"读取：{file.name}")

        df = pd.read_excel(file)

        # Excel 第一行是指标名称，不是实际业务数据
        data_rows = df.iloc[1:].copy()

        columns = list(df.columns)

        # 找到日期列
        date_groups = []

        for i, column in enumerate(columns[3:]):
            match = re.match(r"(\d{2}-\d{2})", str(column))

            if match:
                date = match.group(1)

                # 每个日期只处理一次
                if not any(x[0] == date for x in date_groups):
                    date_groups.append((date, i + 3))

        # 逐日期读取
        for date, start_index in date_groups:

            # 每个日期对应 7 个指标
            date_columns = columns[
                start_index:start_index + 7
            ]

            for _, row in data_rows.iterrows():

                record = {
                    "日期": date,
                    "需求区域": row["需求区域"],
                    "需求仓": row["需求仓"],
                    "需求组": row["需求组"],
                    "来源文件": file.name
                }

                for metric, column in zip(
                    metric_names,
                    date_columns
                ):
                    record[metric] = row[column]

                all_records.append(record)

    return pd.DataFrame(all_records)


# =========================================================
# 3. 保存数据
# =========================================================

def save_data(dispatch_df, demand_df):

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    dispatch_path = PROCESSED_DIR / "dispatch.csv"
    demand_path = PROCESSED_DIR / "demand.csv"

    dispatch_df.to_csv(
        dispatch_path,
        index=False,
        encoding="utf-8-sig"
    )

    demand_df.to_csv(
        demand_path,
        index=False,
        encoding="utf-8-sig"
    )

    print("\n处理后的文件：")
    print(f"派遣人员：{dispatch_path}")
    print(f"用工需求：{demand_path}")


# =========================================================
# 4. 主程序
# =========================================================

def main():

    print("\n" + "=" * 70)
    print("派遣人员名单")
    print("=" * 70)

    dispatch_df = load_dispatch_data()

    print(
        f"\n合并后："
        f"{len(dispatch_df):,} 行 × "
        f"{len(dispatch_df.columns)} 列"
    )

    print("\n前 5 行：")

    print(
        dispatch_df[
            [
                "需求区域",
                "需求仓",
                "需求组",
                "需求日期",
                "工种",
                "班次"
            ]
        ].head().to_string(index=False)
    )


    print("\n" + "=" * 70)
    print("用工需求池")
    print("=" * 70)

    demand_df = load_demand_data()

    print(
        f"\n合并后："
        f"{len(demand_df):,} 行 × "
        f"{len(demand_df.columns)} 列"
    )

    print("\n前 10 行：")

    print(
        demand_df.head(10).to_string(index=False)
    )

    print("\n日期范围：")

    print(
        demand_df["日期"].min(),
        "→",
        demand_df["日期"].max()
    )


    # 保存
    save_data(
        dispatch_df,
        demand_df
    )


if __name__ == "__main__":
    main()