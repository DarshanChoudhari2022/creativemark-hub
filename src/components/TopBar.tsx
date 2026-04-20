import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateDDMMYYYY } from "@/lib/format";
import { notifications } from "@/data/dashboard";

export const TopBar = () => {
  const today = formatDateDDMMYYYY();
  const unread = notifications.filter((n) => n.urgent).length;

  return (
    <header className="h-16 border-b border-border bg-background flex items-center gap-3 px-4 sticky top-0 z-30">
      <SidebarTrigger className="text-foreground" />
      <div className="hidden md:flex items-center gap-2 max-w-md w-full ml-2">
        <div className="relative w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients, leads, invoices…" className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-muted-foreground">{today}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-4 py-3 border-b font-semibold text-sm">Notifications</div>
            <div className="max-h-80 overflow-auto">
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b last:border-0 flex items-start gap-2 hover:bg-muted/40">
                  {n.urgent && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="flex-1">
                    <div className="text-sm">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">SK</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-semibold">Sandeep Khurana</div>
            <div className="text-[11px] text-muted-foreground">Owner</div>
          </div>
        </div>
      </div>
    </header>
  );
};
