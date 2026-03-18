"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Monitor,
  Coins,
  Users,
  ScrollText,
  User,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Shield,
  AppWindow,
  Megaphone,
  UserCog,
  MessageCircle,
  Download,
  Search,
  ArrowLeftRight,
  Layers,
  ListChecks,
  FileText,
  RotateCcw,
  Globe,
  CheckCircle,
  Shuffle,
  Send,
  CreditCard,
  Receipt,
  Settings,
  Key,
  Star,
  Code,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: any;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Offers & Notifications", href: "/dashboard/offers", icon: Megaphone },
  { label: "Download APK", href: "/dashboard/download-apk", icon: Download },
  { label: "Check Mac", href: "/dashboard/check-mac", icon: Search },
  { label: "Switch MAC", href: "/dashboard/switch-mac", icon: ArrowLeftRight },
  { label: "Multi Apps Activation", href: "/dashboard/multi-apps-activation", icon: Layers },
  { label: "Activated Apps List", href: "/dashboard/activated-apps", icon: ListChecks },
  { label: "Add Playlist", href: "/dashboard/playlists", icon: FileText },
  { label: "Reset Playlist", href: "/dashboard/reset-playlist", icon: RotateCcw },
  { label: "Change Domain Url", href: "/dashboard/change-domain", icon: Globe },
];

const playlistTools: NavItem[] = [
  { label: "Playlist Checker", href: "/dashboard/playlist-checker", icon: CheckCircle },
  { label: "Playlist Converter", href: "/dashboard/playlist-converter", icon: Shuffle },
];

const resellerItems: NavItem[] = [
  { label: "Reseller List", href: "/dashboard/resellers", icon: Users },
  { label: "Add Sub Reseller", href: "/dashboard/resellers?action=add", icon: Users },
  { label: "Change Reseller", href: "/dashboard/reseller/change-reseller", icon: ArrowLeftRight },
  { label: "Parent Change Requests", href: "/dashboard/reseller/parent-change-requests", icon: Send },
  { label: "Recharge Request", href: "/dashboard/reseller/recharge-request", icon: CreditCard },
  { label: "My Charge Requests", href: "/dashboard/reseller/my-charge-requests", icon: Receipt },
];

const iboProTvItem: NavItem = { label: "IboProTv", href: "/dashboard/ibprotv", icon: Code };

const logItems: NavItem[] = [
  { label: "Credit Point Share Logs", href: "/dashboard/logs/credit-share", icon: ScrollText },
  { label: "Withdraw Point Share Logs", href: "/dashboard/logs/withdraw", icon: ScrollText },
];

const creditPlanItems: NavItem[] = [
  { label: "Payment Plans", href: "/dashboard/credit-plans/payment-plans", icon: CreditCard },
  { label: "Billing", href: "/dashboard/credit-plans/billing", icon: Receipt },
];

const settingsItems: NavItem[] = [
  { label: "Profile Settings", href: "/dashboard/profile", icon: User },
  { label: "UpdateCreditPasscode", href: "/dashboard/settings/credit-passcode", icon: Key },
];

const adminNavItems: NavItem[] = [
  { label: "Manage Apps", href: "/dashboard/admin/apps", icon: AppWindow },
  { label: "Announcements", href: "/dashboard/admin/announcements", icon: Megaphone },
  { label: "User Management", href: "/dashboard/admin/users", icon: UserCog },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function CollapsibleSection({
  title,
  icon: Icon,
  items,
  collapsed,
  pathname,
}: {
  title: string;
  icon: any;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
}) {
  const isAnyActive = items.some(
    (item) =>
      item.href &&
      (pathname === item.href || pathname.startsWith(item.href + "/"))
  );
  const [open, setOpen] = useState(isAnyActive);

  if (collapsed) {
    return (
      <>
        <hr className="my-1 border-sidebar-accent" />
        {items.map((item) => {
          const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href || item.label}
              href={item.href || "#"}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isAnyActive
            ? "text-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-sidebar-accent pl-3">
          {items.map((item) => {
            const isActive =
              item.href &&
              (pathname === item.href || pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href || item.label}
                href={item.href || "#"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-primary font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 shadow-xl",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-accent/50 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white font-bold text-sm shadow-md">
              IB
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight">
                <span className="text-red-400">IPTV</span>
                <span className="text-sidebar-foreground/90">Panel</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest text-sidebar-foreground/40">
                Reseller Dashboard
              </span>
            </div>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 hover:bg-sidebar-accent"
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* User info + Credit Balance */}
      {!collapsed && user && (
        <div className="border-b border-sidebar-accent/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-sidebar-foreground/90">{user.name}</div>
              <div className="text-[10px] text-sidebar-foreground/50 capitalize">{user.role.replace("_", " ")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 text-sm">
        {/* Main nav items */}
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href && pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href || "#"}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-all duration-200",
                isActive
                  ? "bg-red-500/10 text-red-400 border-l-2 border-red-400 -ml-[2px]"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Playlist Checker/Converter */}
        <CollapsibleSection
          title="Playlist Checker/Converter"
          icon={CheckCircle}
          items={playlistTools}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* Reseller Section */}
        <CollapsibleSection
          title="Reseller"
          icon={Users}
          items={resellerItems}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* IboProTv */}
        {(() => {
          const isActive = pathname.startsWith("/dashboard/ibprotv");
          return (
            <Link
              href={iboProTvItem.href || "#"}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-all duration-200",
                isActive
                  ? "bg-red-500/10 text-red-400 border-l-2 border-red-400 -ml-[2px]"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              title={collapsed ? iboProTvItem.label : undefined}
            >
              <iboProTvItem.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{iboProTvItem.label}</span>}
            </Link>
          );
        })()}

        {/* Logs Section */}
        <CollapsibleSection
          title="Logs"
          icon={ScrollText}
          items={logItems}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* Credit Plans Section */}
        <CollapsibleSection
          title="Credit Plans"
          icon={Coins}
          items={creditPlanItems}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* Settings Section */}
        <CollapsibleSection
          title="Settings"
          icon={Settings}
          items={settingsItems}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* Admin Section */}
        {isAdmin && (
          <CollapsibleSection
            title="Admin"
            icon={Shield}
            items={adminNavItems}
            collapsed={collapsed}
            pathname={pathname}
          />
        )}
      </nav>

      {/* Footer: WhatsApp + Telegram + Logout */}
      <div className="border-t border-sidebar-accent p-3 space-y-1">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Copyright */}
      {!collapsed && (
        <div className="px-4 py-2 text-[10px] text-sidebar-foreground/40">
          COPYRIGHT &copy; {new Date().getFullYear()}
        </div>
      )}
    </aside>
  );
}
