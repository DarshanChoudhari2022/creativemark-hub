import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Square, Route as RouteIcon, ChevronUp, ChevronDown, MapPin, Navigation, X, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { EmployeeMovementTimeline } from '@/components/EmployeeMovementTimeline';

type EmpStatus = 'live' | 'recent' | 'stale' | 'offline';

interface Shift {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  start_selfie_url: string | null;
  end_selfie_url: string | null;
  duration_min: number | null;
  visit_count: number | null;
}

interface Props {
  employees: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visitsToday: Record<string, number>;
  shiftsToday: Record<string, Shift>;
  classifyEmployee: (emp: any) => EmpStatus;
  route: [number, number][];
  routeLoading: boolean;
}

const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

export function MobileTrackingSheet({
  employees, selectedId, onSelect, visitsToday, shiftsToday, classifyEmployee, route, routeLoading
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedEmp = selectedId ? employees.find(e => e.id === selectedId) : null;
  const shift = selectedId ? shiftsToday[selectedId] : null;

  // Collapse when selection changes
  useEffect(() => { if (selectedId) setExpanded(false); }, [selectedId]);

  const dotCls = (status: EmpStatus) =>
    status === 'live' ? 'bg-green-500' : status === 'recent' ? 'bg-blue-500' : status === 'stale' ? 'bg-amber-500' : 'bg-slate-300';

  const statusLabel = (status: EmpStatus) =>
    status === 'live' ? 'Live' : status === 'recent' ? 'Recent' : status === 'stale' ? 'Stale' : 'Offline';

  return (
    <div
      ref={sheetRef}
      className="tracking-bottom-sheet"
      style={{ transform: expanded ? 'translateY(0)' : 'translateY(calc(100% - 180px))' }}
    >
      {/* Handle */}
      <div className="sheet-handle cursor-pointer" onClick={() => setExpanded(p => !p)} />

      {/* Header */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Field Team</span>
          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
            {employees.filter(e => classifyEmployee(e) === 'live').length} Live
          </Badge>
        </div>
        <button onClick={() => setExpanded(p => !p)} className="p-1">
          {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
        </button>
      </div>

      {/* Selected employee banner */}
      {selectedEmp && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarFallback className="bg-primary text-white font-bold text-xs">
                  {getInitials(selectedEmp.name)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${dotCls(classifyEmployee(selectedEmp))}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{selectedEmp.name}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <RouteIcon className="w-3 h-3" />
                {routeLoading ? 'Loading route...' : route.length > 0 ? `${route.length} GPS points tracked` : 'No route data'}
              </div>
              {shift && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  {shift.ended_at ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 text-green-600 fill-green-600" />}
                  {format(new Date(shift.started_at), 'HH:mm')}
                  {shift.ended_at ? ` → ${format(new Date(shift.ended_at), 'HH:mm')}` : ' → ongoing'}
                </div>
              )}
            </div>
            <button onClick={() => onSelect(selectedEmp.id)} className="p-1.5 rounded-full hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Google Maps deep link */}
          {selectedEmp.current_lat && selectedEmp.current_lng && (
            <a
              href={`https://www.google.com/maps?q=${selectedEmp.current_lat},${selectedEmp.current_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Exact Location in Google Maps
            </a>
          )}

          {/* Movement timeline */}
          {shift && (
            <div className="mt-2 pt-2 border-t border-primary/10">
              <EmployeeMovementTimeline
                employeeId={selectedEmp.id}
                employeeName={selectedEmp.name}
                shiftStartedAt={shift.started_at}
                shiftEndedAt={shift.ended_at}
              />
            </div>
          )}
        </div>
      )}

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
        {employees.map(emp => {
          const status = classifyEmployee(emp);
          const lastUpdate = emp.last_location_update ? new Date(emp.last_location_update) : null;
          const isSelected = selectedId === emp.id;
          const empShift = shiftsToday[emp.id];

          return (
            <button
              key={emp.id}
              onClick={() => onSelect(emp.id)}
              className={`employee-track-card w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white border border-border/60 ${isSelected ? 'selected' : ''}`}
            >
              <div className="relative">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[11px]">
                    {getInitials(emp.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${dotCls(status)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                  {emp.name}
                  {empShift && !empShift.ended_at && (
                    <Play className="w-2.5 h-2.5 text-green-600 fill-green-600" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : 'never'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className={`text-[9px] mb-1 ${
                  status === 'live' ? 'bg-green-50 text-green-700 border-green-200' :
                  status === 'recent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  status === 'stale' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {statusLabel(status)}
                </Badge>
                <div className="text-[10px] text-muted-foreground">{visitsToday[emp.id] || 0} visits</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
