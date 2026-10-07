import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")
OUTPUT_DIR = DATA_DIR / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# 1. 读取临时工派遣数据
# ============================================================

files = list(DATA_DIR.glob("临时工派遣*.xlsx"))

if not files:
    print("❌ 没有找到 临时工派遣*.xlsx")
    exit()

dfs = []

for file in files:
    print(f"读取：{file.name}")

    df = pd.read_excel(file)
    df = df.dropna(how="all")

    dfs.append(df)

df = pd.concat(dfs, ignore_index=True)

print(f"\n原始记录数：{len(df):,}")


# ============================================================
# 2. 检查字段
# ============================================================

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

    print("\n当前字段：")
    for c in df.columns:
        print(f"  - {c}")

    exit()


# ============================================================
# 3. 基础清洗
# ============================================================

for col in ["工号", "供应商名称", "物理仓", "工种", "状态"]:
    df[col] = df[col].astype(str).str.strip()

df["派遣开始日期"] = pd.to_datetime(
    df["派遣开始日期"],
    errors="coerce"
)


# ============================================================
# 4. 计算「参照派遣人数」
#
# 注意：
# 临时工派遣是一张每日派遣记录表。
# 同一个人可能出现很多天。
#
# 因此不能：
#     count rows
#
# 这里使用：
#     工号 + 供应商 + 仓库 + 工种
#
# 作为当前月的人员参照粒度。
#
# 这不是正式的“新到岗人数”。
# ============================================================

dispatch_person = (
    df[
        [
            "工号",
            "供应商名称",
            "物理仓",
            "工种"
        ]
    ]
    .drop_duplicates()
)

print(f"参照派遣关系数：{len(dispatch_person):,}")


# ============================================================
# 5. 试工不通过
# ============================================================

trial_df = df[
    df["状态"] == "试工不通过"
].copy()

print(f"试工不通过记录：{len(trial_df):,}")


# ============================================================
# 6. Supplier：派遣人数 + 试工不通过
# ============================================================

dispatch_supplier = (
    dispatch_person
    .groupby("供应商名称")
    .agg(
        派遣人数=("工号", "nunique")
    )
    .reset_index()
)

trial_supplier = (
    trial_df
    .groupby("供应商名称")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
)

supplier_summary = (
    dispatch_supplier
    .merge(
        trial_supplier,
        on="供应商名称",
        how="outer"
    )
    .fillna(0)
)

supplier_summary["派遣人数"] = (
    supplier_summary["派遣人数"].astype(int)
)

supplier_summary["试工不通过人数"] = (
    supplier_summary["试工不通过人数"].astype(int)
)

supplier_summary = supplier_summary.sort_values(
    "试工不通过人数",
    ascending=False
)

supplier_summary.to_csv(
    OUTPUT_DIR / "trial_failure_supplier_reference.csv",
    index=False,
    encoding="utf-8-sig"
)


# ============================================================
# 7. Warehouse：派遣人数 + 试工不通过
# ============================================================

dispatch_warehouse = (
    dispatch_person
    .groupby("物理仓")
    .agg(
        派遣人数=("工号", "nunique")
    )
    .reset_index()
)

trial_warehouse = (
    trial_df
    .groupby("物理仓")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
)

warehouse_summary = (
    dispatch_warehouse
    .merge(
        trial_warehouse,
        on="物理仓",
        how="outer"
    )
    .fillna(0)
)

warehouse_summary["派遣人数"] = (
    warehouse_summary["派遣人数"].astype(int)
)

warehouse_summary["试工不通过人数"] = (
    warehouse_summary["试工不通过人数"].astype(int)
)

warehouse_summary = warehouse_summary.sort_values(
    "试工不通过人数",
    ascending=False
)

warehouse_summary.to_csv(
    OUTPUT_DIR / "trial_failure_warehouse_reference.csv",
    index=False,
    encoding="utf-8-sig"
)


# ============================================================
# 8. Job：派遣人数 + 试工不通过
# ============================================================

dispatch_job = (
    dispatch_person
    .groupby("工种")
    .agg(
        派遣人数=("工号", "nunique")
    )
    .reset_index()
)

trial_job = (
    trial_df
    .groupby("工种")
    .agg(
        试工不通过人数=("工号", "nunique")
    )
    .reset_index()
)

job_summary = (
    dispatch_job
    .merge(
        trial_job,
        on="工种",
        how="outer"
    )
    .fillna(0)
)

job_summary["派遣人数"] = (
    job_summary["派遣人数"].astype(int)
)

job_summary["试工不通过人数"] = (
    job_summary["试工不通过人数"].astype(int)
)

job_summary = job_summary.sort_values(
    "试工不通过人数",
    ascending=False
)

job_summary.to_csv(
    OUTPUT_DIR / "trial_failure_job_reference.csv",
    index=False,
    encoding="utf-8-sig"
)


# ============================================================
# 9. 输出结果
# ============================================================

print("\n========================================")
print("✅ 试工不通过参照分析完成")
print("========================================")

print("\n--- Supplier ---")
print(
    supplier_summary.to_string(index=False)
)

print("\n--- Warehouse Top 15 ---")
print(
    warehouse_summary.head(15).to_string(index=False)
)

print("\n--- Job ---")
print(
    job_summary.to_string(index=False)
)

print("\n生成文件：")
print("  trial_failure_supplier_reference.csv")
print("  trial_failure_warehouse_reference.csv")
print("  trial_failure_job_reference.csv")