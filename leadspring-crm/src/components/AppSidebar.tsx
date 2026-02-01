import { LayoutDashboard, Users, FileText, BarChart3, Settings, LogOut, ClipboardList, DollarSign, CalendarCheck } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Lead Manager", url: "/leads", icon: FileText },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Team", url: "/team", icon: Users },
  { title: "Sales", url: "/sales", icon: DollarSign },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  // { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className={`flex items-center gap-2 px-4 py-6 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="h-8 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold border border-light-foreground flex-shrink-0">
              EBS
            </div>
            {!isCollapsed && <span className="font-semibold text-lg">EvineCRM</span>}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    className={isCollapsed ? "ml-3" : ""}
                  >
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={`flex items-center gap-3 px-4 py-3 border-t ${isCollapsed ? 'justify-between' : ''}`}>
              {/* <Avatar className="h-8 w-8">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar> */}
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              )}
              {isCollapsed ? (
                <div className="w-full flex justify-end px-3">
                  <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                  </SidebarMenuButton>
                </div>
              ) : (
                <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>Logout</span>}
                </SidebarMenuButton>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
