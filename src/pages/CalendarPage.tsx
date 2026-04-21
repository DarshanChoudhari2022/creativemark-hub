import { useState, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared";
import { formatDateDDMMYYYY } from "@/lib/format";
import { toast } from "sonner";

import { calendarEvents as dataCalendarEvents } from "@/data/calendar";
import { leads } from "@/data/leads";
import type { CalendarEventType } from "@/types";

interface PageCalendarEvent {
  id: string;
  date: string;
  title: string;
  type: CalendarEventType;
  time?: string;
  client?: string;
  assignedTo?: string;
  notes?: string;
}

const TYPE_COLORS: Record<CalendarEventType, { bg: string; text: string; dot: string }> = {
  Shoot: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  Meeting: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  Deadline: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  Holiday: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  Internal: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
};

const getDerivedEvents = (): PageCalendarEvent[] => {
  const derived: PageCalendarEvent[] = dataCalendarEvents.map(e => ({
    id: e.id,
    date: e.start.slice(0, 10),
    title: e.title,
    type: e.type,
    time: e.start.includes("T") ? e.start.slice(11, 16) : undefined,
    client: e.clientName,
    assignedTo: e.assignedEmployeeNames?.[0],
    notes: e.notes,
  }));

  leads.forEach(l => {
    if (l.nextFollowupDate) {
      derived.push({
        id: `FU-${l.id}`,
        date: l.nextFollowupDate,
        title: `Follow-up: ${l.name}`,
        type: "Meeting",
        client: l.organization || l.name,
        assignedTo: l.assignedToName,
        notes: `Stage: ${l.stage} | Heat: ${l.heat}`,
      });
    }
  });

  return derived;
};

const CalendarPage = () => {
  const [events, setEvents] = useState<PageCalendarEvent[]>(getDerivedEvents());
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // April 2026
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", type: "Meeting" as CalendarEventType, client: "", assignedTo: "", notes: "" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const filteredEvents = useMemo(() =>
    events.filter(e => typeFilter === "all" || e.type === typeFilter),
    [events, typeFilter]);

  const getEventsForDay = (day: number) => {
    const dateStr = getDateStr(day);
    return filteredEvents.filter(e => e.date === dateStr);
  };

  const selectedDayEvents = selectedDate
    ? filteredEvents.filter(e => e.date === selectedDate).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
    : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const addEvent = () => {
    if (!form.title || !form.date) { toast.error("Title and date are required"); return; }
    setEvents([...events, { ...form, id: `EV-${String(events.length + 1).padStart(3, "0")}` }]);
    setAddOpen(false);
    setForm({ title: "", date: "", time: "", type: "Meeting", client: "", assignedTo: "", notes: "" });
    toast.success("Event added");
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={`${events.length} events this month`}
        actions={
          <>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(["Shoot", "Meeting", "Deadline", "Holiday", "Internal"] as EventType[]).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Event</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                    <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: EventType) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(["Shoot", "Meeting", "Deadline", "Holiday", "Internal"] as EventType[]).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Client</Label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Optional" /></div>
                  <div><Label>Assigned To</Label><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Optional" /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addEvent}>Save Event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* Type Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.entries(TYPE_COLORS) as [EventType, typeof TYPE_COLORS[EventType]][]).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
            <span className="text-muted-foreground">{type}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <Button size="sm" variant="ghost" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="font-bold text-lg">{monthName}</h2>
            <Button size="sm" variant="ghost" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="bg-muted p-2 text-center text-xs font-bold text-muted-foreground">{d}</div>
            ))}
            {days.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="bg-card p-2 min-h-[80px]" />;
              const dateStr = getDateStr(day);
              const dayEvents = getEventsForDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={day}
                  className={`bg-card p-1.5 min-h-[80px] cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-white" : "text-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${TYPE_COLORS[ev.type].bg} ${TYPE_COLORS[ev.type].text}`}>
                        {ev.time && <span className="font-mono mr-0.5">{ev.time}</span>}{ev.title.slice(0, 20)}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Day Detail Panel */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-base">
              {selectedDate ? formatDateDDMMYYYY(new Date(selectedDate + "T00:00:00")) : "Select a date"}
            </h3>
          </div>

          {selectedDate ? (
            selectedDayEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => {
                  const colors = TYPE_COLORS[ev.type];
                  return (
                    <div key={ev.id} className={`p-3 rounded-lg border border-border ${colors.bg}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`font-semibold text-sm ${colors.text}`}>{ev.title}</div>
                          {ev.time && <div className="text-xs font-mono text-muted-foreground mt-0.5">{ev.time}</div>}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${colors.text} border-current`}>{ev.type}</Badge>
                      </div>
                      {ev.client && <div className="text-xs text-muted-foreground mt-1.5">Client: <span className="font-medium text-foreground">{ev.client}</span></div>}
                      {ev.assignedTo && <div className="text-xs text-muted-foreground mt-0.5">Assigned: <span className="font-medium text-foreground">{ev.assignedTo}</span></div>}
                      {ev.notes && <div className="text-xs text-muted-foreground mt-1 italic">{ev.notes}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No events on this day</div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">Click a date to see events</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CalendarPage;
