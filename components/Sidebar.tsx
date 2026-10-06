"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarIconType =
  | "overview"
  | "supplier"
  | "warehouse"
  | "ot"
  | "trial"
  | "data";

function SidebarIcon({
  type,
}: {
  type: SidebarIconType;
}) {
  const common = "h-5 w-5 stroke-[1.8]";

  if (type === "overview") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  if (type === "supplier") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (type === "warehouse") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M3 21h18" />
        <path d="M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M8 10h2" />
        <path d="M14 10h2" />
      </svg>
    );
  }

  if (type === "ot") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M3 3v18h18" />
        <path d="m7 16 4-5 3 3 5-7" />
      </svg>
    );
  }

  if (type === "trial") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6" />
        <path d="m15 9-6 6" />
      </svg>
    );
  }

  return (
    <svg
      className={common}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
      <circle cx="7" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="10" cy="18" r="1" />
    </svg>
  );
}

const navigation = [
  {
    name: "总览 Overview",
    href: "/",
    icon: "overview" as SidebarIconType,
  },
  {
    name: "供应商分析 Supplier Analysis",
    href: "/supplier",
    icon: "supplier" as SidebarIconType,
  },
  {
    name: "仓库分析 Warehouse Analysis",
    href: "/warehouse",
    icon: "warehouse" as SidebarIconType,
  },
  {
    name: "加班分析 OT Analysis",
    href: "/ot",
    icon: "ot" as SidebarIconType,
  },
  {
    name: "试工不通过 Trial Failure",
    href: "/trial",
    icon: "trial" as SidebarIconType,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-[#111827] text-white lg:flex">

      {/* Brand */}
      <div className="flex h-[82px] items-center border-b border-white/10 px-7">
        <img
          src="/logo.jpeg"
          alt="品牌 Logo Brand logo"
          className="mr-3 h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1"
        />

        <div>
          <div className="text-[15px] font-bold tracking-wide">
            人力 Workforce
          </div>

          <div className="text-[11px] text-slate-400">
            分析平台 ANALYTICS PLATFORM
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-6">

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          数据分析 Analytics
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "flex items-center rounded-xl bg-indigo-500/15 px-3 py-3 text-indigo-300"
                    : "flex items-center rounded-xl px-3 py-3 text-slate-400 transition hover:bg-white/5 hover:text-white"
                }
              >
                <SidebarIcon type={item.icon} />

                <span
                  className={`ml-3 text-sm ${
                    isActive ? "font-medium" : ""
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* System */}
        <p className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          系统 System
        </p>

        <Link
          href="/quality"
          className={
            pathname === "/quality"
              ? "flex items-center rounded-xl bg-indigo-500/15 px-3 py-3 text-indigo-300"
              : "flex items-center rounded-xl px-3 py-3 text-slate-400 transition hover:bg-white/5 hover:text-white"
          }
        >
          <SidebarIcon type="data" />

          <span
            className={`ml-3 text-sm ${
              pathname === "/quality"
                ? "font-medium"
                : ""
            }`}
          >
            数据质量 Data Quality
          </span>
        </Link>
      </div>

      {/* Bottom */}
      <div className="mt-auto border-t border-white/10 p-5">
        <div className="rounded-xl bg-white/5 p-4">
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />

            <span className="ml-2 text-xs font-medium text-slate-300">
              数据管道 Data Pipeline
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            所有处理后的数据集均已可用 All processed datasets are available
          </p>
        </div>
      </div>
    </aside>
  );
}
