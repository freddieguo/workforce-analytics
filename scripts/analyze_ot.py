import pandas as pd
from pathlib import Path


DATA_DIR = Path("data")
PROCESSED_DIR = DATA_DIR / "processed"


def main():

    files = list(DATA_DIR.glob("考勤记录*.xlsx"))

    if not files:
        raise FileNotFoundError("没有找到考勤记录 Excel")

    print("\n" + "=" * 70)
    print("OT 数据分析")
    print("=" * 70)

    all_data = []

    for file in files:

        print(f"\n读取：{file.name}")

        df = pd.read_excel(file)

        df["来源文件"] = file.name

        all_data.append(df)

    attendance = pd.concat(
        all_data,
        ignore_index=True
    )

    # =====================================================
    # 1. 基础字段
    # =====================================================

    ot_columns = [
        "供应商名称",
        "供应商ID",
        "姓名",
        "工号",
        "工种",
        "员工类型",
        "区域",
        "仓库",
        "组",
        "考勤类型",
        "考勤日期",
        "工作时长",
        "加班时长",
        "时长总计",
        "班次",
        "考勤状态",
        "来源文件"
    ]

    ot_daily = attendance[ot_columns].copy()

    # =====================================================
    # 2. 转换数值字段
    # =====================================================

    numeric_columns = [
        "工作时长",
        "加班时长",
        "时长总计"
    ]

    for column in numeric_columns:
        ot_daily[column] = pd.to_numeric(
            ot_daily[column],
            errors="coerce"
        )

    # =====================================================
    # 3. 计算 OT Rate
    # =====================================================

    ot_daily["OT率"] = (
        ot_daily["加班时长"]
        / ot_daily["时长总计"].replace(0, pd.NA)
        * 100
    )

    # =====================================================
    # 4. 保存每日 OT 数据
    # =====================================================

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = PROCESSED_DIR / "ot_daily.csv"

    ot_daily.to_csv(
        output_path,
        index=False,
        encoding="utf-8-sig"
    )

    # =====================================================
    # 5. 总体 OT
    # =====================================================

    total_work = ot_daily["时长总计"].sum()
    total_ot = ot_daily["加班时长"].sum()

    overall_ot_rate = (
        total_ot / total_work * 100
        if total_work > 0
        else None
    )

    print("\n" + "-" * 70)
    print("总体 OT")
    print("-" * 70)

    print(f"考勤记录：{len(ot_daily):,}")
    print(f"总工作时长：{total_work:,.2f}")
    print(f"总加班时长：{total_ot:,.2f}")
    print(f"OT率：{overall_ot_rate:.2f}%")

    # =====================================================
    # 6. 仓库 OT
    # =====================================================

    warehouse = (
        ot_daily
        .groupby("仓库", dropna=False)
        .agg(
            总工作时长=("时长总计", "sum"),
            加班时长=("加班时长", "sum"),
            员工数=("工号", "nunique"),
            考勤记录=("工号", "count")
        )
        .reset_index()
    )

    warehouse["OT率"] = (
        warehouse["加班时长"]
        / warehouse["总工作时长"].replace(0, pd.NA)
        * 100
    )

    warehouse = warehouse.sort_values(
        "OT率",
        ascending=False
    )

    # =====================================================
    # 7. 供应商 OT
    # =====================================================

    supplier = (
        ot_daily
        .groupby(
            ["供应商名称", "供应商ID"],
            dropna=False
        )
        .agg(
            总工作时长=("时长总计", "sum"),
            加班时长=("加班时长", "sum"),
            员工数=("工号", "nunique"),
            考勤记录=("工号", "count")
        )
        .reset_index()
    )

    supplier["OT率"] = (
        supplier["加班时长"]
        / supplier["总工作时长"].replace(0, pd.NA)
        * 100
    )

    supplier = supplier.sort_values(
        "OT率",
        ascending=False
    )

    # =====================================================
    # 8. 工种 OT
    # =====================================================

    job = (
        ot_daily
        .groupby("工种", dropna=False)
        .agg(
            总工作时长=("时长总计", "sum"),
            加班时长=("加班时长", "sum"),
            员工数=("工号", "nunique"),
            考勤记录=("工号", "count")
        )
        .reset_index()
    )

    job["OT率"] = (
        job["加班时长"]
        / job["总工作时长"].replace(0, pd.NA)
        * 100
    )

    job = job.sort_values(
        "OT率",
        ascending=False
    )

    # =====================================================
    # 9. 保存分析结果
    # =====================================================

    warehouse.to_csv(
        PROCESSED_DIR / "ot_warehouse.csv",
        index=False,
        encoding="utf-8-sig"
    )

    supplier.to_csv(
        PROCESSED_DIR / "ot_supplier.csv",
        index=False,
        encoding="utf-8-sig"
    )

    job.to_csv(
        PROCESSED_DIR / "ot_job.csv",
        index=False,
        encoding="utf-8-sig"
    )

    print("\n" + "=" * 70)
    print("OT 分析文件已生成")
    print("=" * 70)

    print("ot_daily.csv")
    print("ot_warehouse.csv")
    print("ot_supplier.csv")
    print("ot_job.csv")


if __name__ == "__main__":
    main()