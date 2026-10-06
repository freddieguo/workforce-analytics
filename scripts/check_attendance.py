import pandas as pd
from pathlib import Path


DATA_DIR = Path("data")


def main():

    files = list(DATA_DIR.glob("考勤记录*.xlsx"))

    if not files:
        raise FileNotFoundError("没有找到考勤记录 Excel")

    print("\n" + "=" * 70)
    print("考勤数据检查")
    print("=" * 70)

    for file in files:

        print(f"\n读取：{file.name}")

        df = pd.read_excel(file)

        print(
            f"行数：{len(df):,}"
        )

        print(
            f"列数：{len(df.columns)}"
        )

        print("\n字段：")

        for i, column in enumerate(df.columns, 1):
            print(f"{i}. {column}")

        print("\n前 5 行：")

        print(
            df.head().to_string(index=False)
        )


if __name__ == "__main__":
    main()