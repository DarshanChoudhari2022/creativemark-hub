import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared";
import { calendarEvents, EventType } from "@/data/calendar";
import { employees } from "@/data/employees";
import { clients } from "@/data/clients";

const TYPE_COLOR: Record<EventType, string> = {
  shoot: "bg-primary text-primary-foreground",
  meeting: "bg-foreground text-background",
  internal: "bg-muted-foreground/70 text-background",
};
const TYPE_DOT: Record<EventType, string> = {
  shoot: "bg-primary",
  meeting: "bg-foreground",
  internal: "bg-muted-foreground",
};

const CalendarPage = () => {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date(2026, 3, 1)); // April 2026
  const [empFilter, setEmpFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const filtered = calendarEvents.filter((e) =>
    (empFilter === "all" || e.employeeId === empFilter) &&
    (clientFilter === "all" || e.clientId === clientFilter)
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const eventsForDay = (d: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return filtered.filter((e) => e.date === ds);
  };

  // Week view: derive Sunday of cursor's week
  const weekStart = new Date(cursor); weekStart.setDate(cursor.getDate() - cursor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  const move = (delta: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setCursor(d);
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Schedule across shoots, meetings, and internal events"
        actions={
          <div className="flex gap-2">
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button size="sm" variant={view === "month" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("month")}>Month</Button>
              <Button size="sm" variant={view === "week" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("week")}>Week</Button>
            </div>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-bold text-lg w-48 text-center">{view === "month" ? monthName : `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${monthName}`}</div>
            <Button size="icon" variant="outline" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(2026, 3, 20))}>Today</Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filter by employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filter by client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT.shoot}`} /> Shoot</div>
          <div className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT.meeting}`} /> Meeting</div>
          <div className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT.internal}`} /> Internal</div>
        </div>
      </Card>

      {view === "month" ? (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground mb-2 pb-2 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const evs = eventsForDay(d);
              return (
                <div key={d} className="min-h-[90px] border border-border rounded-md p-1.5 hover:bg-muted/30 transition-colors">
                  <div className="text-xs font-bold mb-1">{d}</div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e) => (
                      <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${TYPE_COLOR[e.type]}`}>{e.time} {e.title.split("—")[0]}</div>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const evs = filtered.filter((e) => e.date === ds);
              return (
                <div key={ds} className="min-h-[300px] border border-border rounded-md p-2">
                  <div className="text-xs text-muted-foreground">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                  <div className="text-lg font-bold mb-2">{d.getDate()}</div>
                  <div className="space-y-1">
                    {evs.map((e) => (
                      <div key={e.id} className={`text-[11px] p-1.5 rounded ${TYPE_COLOR[e.type]}`}>
                        <div className="font-bold">{e.time}</div>
                        <div className="truncate">{e.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default CalendarPage;
