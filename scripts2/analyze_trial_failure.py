import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")
OUTPUT_DIR = DATA_DIR / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# =========================
# 1. 读取临时工派遣数据
# =========================

files = list(DATA_DIR.glob("临时工派遣*.xlsx"))

if not files:
    print("❌ 没有找到 临时工派遣*.xlsx")
    exit()

dfs = []

for file in files:
    print(f"读取：{file.name}")

    df = pd.read_excel(file)

    # 去掉完全空白行
    df = df.dropna(how="all")

    # 保留来源文件
    df["来源文件"] = file.name

    dfs.append(df)


df = pd.concat(dfs, ignore_index=True)

print(f"\n总记录数：{len(df):,}")
print(f"字段数：{len(df.columns)}")


# =========================
# 2. 检查必要字段
# =========================

required_columns = [
    "工号",
    "供应商名称",
    "物理仓",
    "工种",
    "派遣开始日期",
    "状态"
]

missing = [c for c in required_columns if c not in df.columns]

if missing:
    print("\n❌ 缺少字段：")
    for c in missing:
        print(f"  - {c}")

    print("\n当前实际字段：")
    for c in df.columns:
        print(f"  - {c}")

    exit()


# =========================
# 3. 只保留「试工不通过」
# =========================

trial_df = df[
    df["状态"].astype(str).str.strip() == "试工不通过"
].copy()

print(f"\n试工不通过记录：{len(trial_df):,}")


# =========================
# 4. 日期处理
# =========================

trial_df["派遣开始日期"] = pd.to_datetime(
    trial_df["派遣开始日期"],
    errors="coerce"
)

trial_df["日期"] = trial_df["派遣开始日期"].dt.date


# =========================
# 5. 每日试工不通过
# =========================

daily = (
    trial_df
    .groupby("日期")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
    .sort_values("日期")
)

daily.to_csv(
    OUTPUT_DIR / "trial_failure_daily.csv",
    index=False,
    encoding="utf-8-sig"
)


# =========================
# 6. 按仓库
# =========================

warehouse = (
    trial_df
    .groupby("物理仓")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
    .sort_values(
        "试工不通过人数",
        ascending=False
    )
)

warehouse.to_csv(
    OUTPUT_DIR / "trial_failure_warehouse.csv",
    index=False,
    encoding="utf-8-sig"
)


# =========================
# 7. 按供应商
# =========================

supplier = (
    trial_df
    .groupby("供应商名称")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
    .sort_values(
        "试工不通过人数",
        ascending=False
    )
)

supplier.to_csv(
    OUTPUT_DIR / "trial_failure_supplier.csv",
    index=False,
    encoding="utf-8-sig"
)


# =========================
# 8. 按工种
# =========================

job = (
    trial_df
    .groupby("工种")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
    .sort_values(
        "试工不通过人数",
        ascending=False
    )
)

job.to_csv(
    OUTPUT_DIR / "trial_failure_job.csv",
    index=False,
    encoding="utf-8-sig"
)


# =========================
# 9. 输出结果
# =========================

print("\n✅ 分析完成")

print("\n--- 按仓库 Top 10 ---")
print(warehouse.head(10).to_string(index=False))

print("\n--- 按供应商 ---")
print(supplier.to_string(index=False))

print("\n--- 按工种 ---")
print(job.to_string(index=False))

print("\n生成文件：")
print("  trial_failure_daily.csv")
print("  trial_failure_warehouse.csv")
print("  trial_failure_supplier.csv")
print("  trial_failure_job.csv")