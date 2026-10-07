import pandas as pd
from pathlib import Path


DATA_DIR = Path("data")


def inspect_dispatch_files():
    files = list(DATA_DIR.glob("派遣人员名单*.xlsx"))

    if not files:
        print("没有找到派遣人员名单 Excel")
        return

    for file in files:
        print("\n" + "=" * 80)
        print(f"文件：{file.name}")

        df = pd.read_excel(file)

        print(f"总行数：{len(df):,}")

        # 显示前 10 行关键字段
        columns = [
            "需求区域",
            "需求仓",
            "需求组",
            "需求日期",
            "工种",
            "班次",
            "供应商需派遣人数",
            "供应商未派遣人数",
            "供应商已派遣人数",
        ]

        existing_columns = [
            col for col in columns
            if col in df.columns
        ]

        print("\n关键字段：")
        print(df[existing_columns].head(10).to_string(index=False))

        # 检查每个字段的数据类型
        print("\n数据类型：")
        print(df[existing_columns].dtypes)

        # 检查关键字段缺失
        print("\n缺失值：")
        print(df[existing_columns].isna().sum())


if __name__ == "__main__":
    inspect_dispatch_files()