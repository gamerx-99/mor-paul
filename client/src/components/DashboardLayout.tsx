import { useAuth } from "@/_core/hooks/useAuth";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import AccessGate from "@/pages/AccessGate";
import { Banknote, FileBarChart, HeartPulse, KeyRound, LayoutDashboard, LogOut, PackageOpen, PanelLeft, Settings2, Stethoscope, UsersRound } from "lucide-react";
import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

type ClinicalRole = "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT";

const menuItems: Array<{ icon: typeof LayoutDashboard; label: string; path: string; disabled?: boolean; roles?: ClinicalRole[] }> = [
  { icon: LayoutDashboard, label: "ภาพรวม", path: "/", roles: ["DOCTOR", "ASSISTANT"] },
  { icon: UsersRound, label: "ลงทะเบียน", path: "/front-desk", roles: ["ASSISTANT"] },
  { icon: HeartPulse, label: "คัดกรองและคิว", path: "/queue", roles: ["ASSISTANT", "DOCTOR"] },
  { icon: Stethoscope, label: "ห้องตรวจ", path: "/doctor-console", roles: ["DOCTOR"] },
  { icon: PackageOpen, label: "คลังยาและราคา", path: "/medications", roles: ["SYSTEM_ADMIN"] },
  { icon: Banknote, label: "จ่ายยาและการเงิน", path: "/cashier", roles: ["ASSISTANT"] },
  { icon: FileBarChart, label: "รายงานสรุป", path: "/reports", roles: ["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"] },
  { icon: Settings2, label: "บัญชีบุคลากร", path: "/staff", roles: ["SYSTEM_ADMIN"] },
];

const roleLabel: Record<ClinicalRole, string> = {
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  DOCTOR: "แพทย์",
  ASSISTANT: "ผู้ช่วย",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) return <AccessGate />;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const visibleMenuItems = menuItems.filter(item => !item.roles || (user && item.roles.includes(user.role)));
  const activeMenuItem = visibleMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? <div className="min-w-0"><span className="block truncate font-semibold tracking-tight">คลินิกหมอพัลลภ</span><span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B6B67]">HIS · Care Route</span></div> : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => item.disabled ? toast("โมดูลนี้จะเปิดใช้งานในระยะถัดไป") : setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 font-normal transition-all ${item.disabled ? "opacity-55" : ""}`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.displayName || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user ? roleLabel[user.role] : "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)} className="cursor-pointer">
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="flex md:hidden border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="tracking-tight text-foreground">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1 p-4 pb-20 md:pb-4">{children}</main>

        {/* Mobile Bottom Navigation - always rendered immediately on mobile without requiring interaction */}
        <nav
          aria-label="แถบนำทางหลักสำหรับมือถือ"
          data-slot="mobile-bottom-nav"
          className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:backdrop-blur md:hidden"
        >
          {visibleMenuItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path + "/"));
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  if (item.disabled) {
                    toast("โมดูลนี้จะเปิดใช้งานในระยะถัดไป");
                  } else {
                    setLocation(item.path);
                  }
                }}
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                } ${item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="truncate max-w-[72px] leading-tight text-center">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </SidebarInset>
    </>
  );
}
