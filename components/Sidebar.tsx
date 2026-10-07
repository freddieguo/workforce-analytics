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

  const linkClass = (active: boolean) =>
    `group relative flex items-center overflow-hidden rounded-xl px-3 py-3 transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-indigo-500/25 to-violet-500/15 text-white shadow-lg shadow-indigo-500/10"
        : "text-slate-400 hover:translate-x-0.5 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-gradient-to-b from-[#0f172a] via-[#111c33] to-[#0f172a] text-white lg:flex">

      {/* Brand */}
      <div className="flex h-[82px] items-center border-b border-white/10 px-7">
        <div className="mr-3 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-[2px] shadow-lg shadow-indigo-500/30">
          <img
            src="/logo.jpeg"
            alt="品牌 Logo Brand logo"
            className="h-9 w-9 rounded-[10px] bg-white object-contain p-1"
          />
        </div>

        <div>
          <div className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-[15px] font-bold tracking-wide text-transparent">
            人力 Workforce
          </div>

          <div className="text-[11px] tracking-wider text-slate-500">
            分析平台 ANALYTICS
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6">

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
                className={linkClass(isActive)}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow shadow-indigo-400/50" />
                )}

                <span
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    isActive
                      ? "text-indigo-300"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                >
                  <SidebarIcon type={item.icon} />
                </span>

                <span
                  className={`ml-3 text-sm ${
                    isActive
                      ? "font-semibold text-white"
                      : ""
                  }`}
                >
                  {item.name}
                </span>

                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shadow shadow-indigo-400/60" />
                )}
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
          className={linkClass(
            pathname === "/quality"
          )}
        >
          {pathname === "/quality" && (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow shadow-indigo-400/50" />
          )}

          <span
            className={`transition-transform duration-200 group-hover:scale-110 ${
              pathname === "/quality"
                ? "text-indigo-300"
                : "text-slate-500 group-hover:text-slate-300"
            }`}
          >
            <SidebarIcon type="data" />
          </span>

          <span
            className={`ml-3 text-sm ${
              pathname === "/quality"
                ? "font-semibold text-white"
                : ""
            }`}
          >
            数据质量 Data Quality
          </span>

          {pathname === "/quality" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shadow shadow-indigo-400/60" />
          )}
        </Link>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/10 p-5">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 backdrop-blur">
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-400/20 blur-xl" />

          <div className="relative flex items-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />
            </span>

            <span className="ml-2 text-xs font-semibold text-slate-200">
              数据管道 Data Pipeline
            </span>
          </div>

          <p className="relative mt-2 text-[11px] leading-5 text-slate-400">
            所有处理后的数据集均已可用 All processed datasets are available
          </p>
        </div>
      </div>
    </aside>
  );
}
