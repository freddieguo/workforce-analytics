"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarIconType =
  | "overview"
  | "supplier"
  | "warehouse"
  | "trial"
  | "data"
  | "group"
  | "cancel"
  | "agency";

function SidebarIcon({
  type,
}: {
  type: SidebarIconType;
}) {
  const common = "h-[18px] w-[18px] stroke-[1.8]";

  if (type === "overview") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
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

  if (type === "group") {
    // 供应商与仓库的父项：两层叠放，意思是一组里有两个分析
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M12 3l9 5-9 5-9-5 9-5Z" />
        <path d="M3 13l9 5 9-5" />
      </svg>
    );
  }

  if (type === "cancel") {
    // 被结束：一个人 + 右上角的 ×，意思是一个人被结束了，不再是三条横线
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M17 8l5 5" />
        <path d="M22 8l-5 5" />
      </svg>
    );
  }

  if (type === "agency") {
    // 机构分析：一栋楼，不再跟供应商分析撞用两个人那个图标
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M9 21v-4h6v4" />
        <path d="M8 7h2" />
        <path d="M14 7h2" />
        <path d="M8 11h2" />
        <path d="M14 11h2" />
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
      <path d="M4 6h16" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M4 18h10" strokeLinecap="round" />
    </svg>
  );
}

/* 供应商与仓库不再各占一条，收进下面这个折叠组里。
   两个页面的路由 /supplier、/warehouse 都不动，只改侧边栏怎么显示。 */
const supplierWarehouseGroup = [
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
];

const navigation = [
  {
    name: "总览 Overview",
    href: "/",
    icon: "overview" as SidebarIconType,
  },
  {
    name: "工种分析 Job Analysis",
    href: "/job",
    icon: "data" as SidebarIconType,
  },
  {
    name: "被退回分析 Sent Back Analysis",
    href: "/trial",
    icon: "trial" as SidebarIconType,
  },
  {
    name: "被结束分析 Cancel Analysis",
    href: "/cancel",
    icon: "cancel" as SidebarIconType,
  },
  {
    name: "月报 Monthly Report",
    href: "/monthly",
    icon: "data" as SidebarIconType,
  },  
  {
    name: "机构分析 Agency Analysis",
    href: "/agency",
    icon: "agency" as SidebarIconType,
  },
];

function NavLink({
  href,
  icon,
  name,
  active,
  onClick,
}: {
  href: string;
  icon: SidebarIconType;
  name: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 ${
        active
          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.4)]"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
          active
            ? "bg-white/20 text-white shadow-inner"
            : "bg-white/[0.04] text-slate-500 group-hover:bg-white/10 group-hover:text-indigo-300"
        }`}
      >
        <SidebarIcon type={icon} />
      </span>
      <span
        className={`text-[13px] leading-tight ${
          active ? "font-bold" : "font-medium"
        }`}
      >
        {name}
      </span>
      {active && (
        <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));
  const closeMobile = () => setMobileOpen(false);

  /* 折叠组：点父项只展开/收起，不跳转；点子项才跳转并在手机上收起抽屉。
     已经在供应商或仓库页时，组默认就是展开的；从别的页点进来时也自动展开。 */
  const groupActive =
    isActive("/supplier") || isActive("/warehouse");
  const [groupOpen, setGroupOpen] = useState(groupActive);
  useEffect(() => {
    if (groupActive) setGroupOpen(true);
  }, [pathname]);

  return (
    <>
      {/* 移动端悬浮菜单按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="打开菜单 Open menu"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.5)] transition-transform active:scale-95 lg:hidden"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col overflow-hidden bg-[#0b1226] text-white transition-transform duration-300 lg:z-30 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-violet-600/15 blur-[80px]" />

      {/* Brand */}
      <div className="relative flex items-center gap-3.5 border-b border-white/[0.07] px-6 pb-6 pt-7">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 opacity-60 blur-md" />
          <img
            src="/logo.jpeg"
            alt="品牌 Logo Brand logo"
            className="relative h-11 w-11 rounded-2xl bg-white object-contain p-1.5 shadow-xl"
          />
        </div>
        <div>
          <div className="text-[16px] font-extrabold tracking-wide text-white">
            HR <span className="font-semibold text-indigo-300">数据看板</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            HR Dashboard
          </div>
        </div>
        {/* 移动端关闭按钮 */}
        <button
          onClick={closeMobile}
          aria-label="关闭菜单 Close menu"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-300 transition hover:bg-white/20 lg:hidden"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <div className="relative flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-3 flex items-center gap-2 px-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            数据分析 Analytics
          </p>
          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <nav className="space-y-1.5">
          {/* 总览 */}
          <NavLink
            href={navigation[0].href}
            icon={navigation[0].icon}
            name={navigation[0].name}
            active={isActive(navigation[0].href)}
            onClick={closeMobile}
          />

          {/* 供应商与仓库：一个父项，点开是两条 */}
          <div>
            <button
              type="button"
              onClick={() => setGroupOpen((v) => !v)}
              aria-expanded={groupOpen}
              className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-300 ${
                groupActive
                  ? "bg-white/[0.06] text-white"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  groupActive
                    ? "bg-white/10 text-indigo-300"
                    : "bg-white/[0.04] text-slate-500 group-hover:bg-white/10 group-hover:text-indigo-300"
                }`}
              >
                <SidebarIcon type="group" />
              </span>
              <span
                className={`flex-1 text-[13px] leading-tight ${
                  groupActive ? "font-bold" : "font-medium"
                }`}
              >
                达成率分析 Fulfillment Rate Analysis
              </span>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                  groupOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {groupOpen && (
              <div className="ml-[21px] mt-1.5 space-y-1.5 border-l border-white/10 pl-3">
                {supplierWarehouseGroup.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    name={item.name}
                    active={isActive(item.href)}
                    onClick={closeMobile}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 其余各项：工种、被退回、被结束、机构 */}
          {navigation.slice(1).map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              name={item.name}
              active={isActive(item.href)}
              onClick={closeMobile}
            />
          ))}
        </nav>

        <div className="mb-3 mt-8 flex items-center gap-2 px-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            系统 System
          </p>
          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <NavLink
          href="/quality"
          icon="data"
          name="数据质量 Data Quality"
          active={pathname === "/quality"}
          onClick={closeMobile}
        />
      </div>

      {/* Bottom */}
      <div className="relative border-t border-white/[0.07] p-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.12] to-transparent p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/25 blur-2xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-bold text-slate-100">
              数据管道 Data Pipeline
            </span>
          </div>
          <p className="relative mt-1.5 text-[11px] leading-5 text-slate-400">
            所有处理后的数据集均已可用
          </p>
        </div>
      </div>
    </aside>
    </>
  );
}
