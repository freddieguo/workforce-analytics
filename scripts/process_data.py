import pandas as pd
from pathlib import Path


DATA_DIR = Path("data")


def read_excel_files():
    files = list(DATA_DIR.glob("*.xlsx"))

    if not files:
        print("❌ data 文件夹里没有 Excel 文件")
        return

    print(f"发现 {len(files)} 个 Excel 文件\n")

    for file in files:
        try:
            df = pd.read_excel(file)

            print("=" * 70)
            print(f"文件: {file.name}")
            print(f"行数: {len(df):,}")
            print(f"列数: {len(df.columns)}")

            print("\n字段:")
            for column in df.columns:
                print(f"  - {column}")

        except Exception as e:
            print(f"❌ 读取失败: {file.name}")
            print(f"原因: {e}")


if __name__ == "__main__":
    read_excel_files()