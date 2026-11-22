"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { LogoFull } from "./Logo";
import { FEATURES } from "@/lib/featureFlags";
import { submissionCheckBetaClient } from "@/lib/submission/beta";
import { supportMailto } from "@/lib/contact";

const ICON = (d) => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// Submission Check product (on in previews; in production only with SUBMISSION_CHECK_BETA=on):
// one workflow, four destinations. Tender Intelligence pages still work at their
// addresses (older analyses open from History), they are just not in the menu.
const PRODUCT_NAV = [
  { label: "Home", href: "/submission-check", match: (p) => p === "/submission-check", icon: ICON("m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25") },
  { label: "New check", href: "/submission-check/new", match: (p) => p === "/submission-check/new" || p === "/submission-check/demo" || /^\/submission-check\/[0-9a-f-]{36}$/i.test(p) || p.endsWith("/submission-check") && p.startsWith("/analysis/"), icon: ICON("M12 4.5v15m7.5-7.5h-15") },
  { label: "History", href: "/submission-check/history", match: (p) => p === "/submission-check/history", icon: ICON("M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z") },
  { label: "Account", href: "/account", match: (p) => p === "/account", icon: ICON("M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z") },
];

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: "New Analysis",
    href: "/upload",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    label: "Tender Package",
    href: "/workspace/new",
    requires: "showTenderPackageRoute",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    ),
  },
  {
    label: "Bid Compare",
    href: "/bid-compare",
    requires: "showBidCompareRoute",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: "Deadlines",
    href: "/deadlines",
    requires: "showDeadlineTrackerRoute",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Pricing",
    href: "/pricing",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
];

export default function AppShell({ user, onLogout, children, breadcrumbs }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex transition-colors duration-300" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[240px] flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-primary)" }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5" style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--ink)" }}>
          <LogoFull size={28} />
          <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}>
            Beta
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {(submissionCheckBetaClient() ? PRODUCT_NAV : NAV_ITEMS.filter((item) => !item.requires || FEATURES[item.requires])).map((item) => {
            const isActive = item.match ? item.match(pathname || "") : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setSidebarOpen(false); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-colors duration-150 ${
                  isActive ? "sidebar-active" : "sidebar-item"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-emerald-500" aria-hidden="true" />}
                <span className={isActive ? "text-emerald-500" : ""} style={!isActive ? { color: "var(--text-muted)" } : {}}>
                  {item.icon}
                </span>
                {item.label}

              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="px-3 pb-4">
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold flex-shrink-0">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {user?.email || "user@example.com"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle size="small" />
              <a
                href={supportMailto()}
                className="py-1.5 px-2 rounded-lg text-xs font-medium transition-colors duration-200 flex items-center justify-center"
                style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                title="Contact support"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </a>
              <button
                onClick={onLogout}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200"
                style={{ border: "1px solid var(--border-secondary)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-input)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 lg:ml-[240px] flex flex-col min-h-screen">
        {/* Top Bar */}
        <header
          className="sticky top-0 z-20 h-14 flex items-center gap-4 px-4 sm:px-6 backdrop-blur-md"
          style={{ background: "var(--bg-primary-translucent)", borderBottom: "1px solid var(--border-primary)" }}
        >
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ border: "1px solid var(--border-secondary)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--text-secondary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Breadcrumbs — full on sm+, current page only on mobile */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <>
              {/* Mobile: show current page name */}
              <span className="sm:hidden text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {breadcrumbs[breadcrumbs.length - 1].label}
              </span>
              {/* Desktop: full breadcrumb trail */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                    {crumb.href ? (
                      <button
                        onClick={() => router.push(crumb.href)}
                        className="hover:underline transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-primary)" }}>{crumb.label}</span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center ml-auto mr-auto" style={{ color: "var(--ink)" }}>
            <LogoFull size={26} />
          </div>

          {/* Right side - mobile theme toggle */}
          <div className="lg:hidden">
            <ThemeToggle size="small" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
