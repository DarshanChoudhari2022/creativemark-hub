import { LayoutDashboard, Users, UserCog, Target, FileText, Wallet, CalendarDays, Settings, Handshake, BarChart3 } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Employees", url: "/employees", icon: UserCog },
  { title: "Leads", url: "/leads", icon: Target },
  { title: "Quotations & Bills", url: "/quotations", icon: FileText },
  { title: "Recovery", url: "/recovery", icon: Wallet },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Partners", url: "/partners", icon: Handshake },
  { title: "Settings", url: "/settings", icon: Settings },
];

import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ONLY_ROUTES = ["/analytics", "/quotations", "/recovery", "/settings", "/partners"];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const collapsed = state === "collapsed";

  const visibleItems = items.filter(item => {
    if (user?.role === "Employee" && ADMIN_ONLY_ROUTES.includes(item.url)) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 flex items-center px-3 border-b border-sidebar-border">
        <BrandLogo collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className="relative h-10">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-md px-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="!bg-primary/10 !text-primary font-semibold before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-primary"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
