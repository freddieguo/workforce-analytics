import subprocess
import sys
from pathlib import Path


SCRIPTS = [
    "load_data.py",
    "build_allocation.py",
    "analyze_supplier.py",
    "analyze_warehouse.py",
    "analyze_ot.py",
    "analyze_trial_failure.py",
    "analyze_trial_failure_reference.py",
]


def run_script(script_name):
    print("\n" + "=" * 60)
    print(f"▶ 正在运行：{script_name}")
    print("=" * 60)

    result = subprocess.run(
        [sys.executable, f"scripts/{script_name}"],
        text=True
    )

    if result.returncode != 0:
        print(f"\n❌ {script_name} 运行失败")
        sys.exit(result.returncode)

    print(f"\n✅ {script_name} 完成")


def main():
    print("\n")
    print("=" * 60)
    print("        Workforce Analytics - Data Pipeline")
    print("=" * 60)

    for script in SCRIPTS:
        run_script(script)

    print("\n" + "=" * 60)
    print("🎉 所有数据分析完成")
    print("=" * 60)

    print("\nprocessed 文件已更新。")


if __name__ == "__main__":
    main()