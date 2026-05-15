import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, Clock, Play, Square, Eye, Footprints,
  ChevronDown, ChevronUp, AlertTriangle, Loader2,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'shift_start' | 'gps_ping' | 'visit' | 'shift_end';
  timestamp: string;
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  meta?: Record<string, any>;
}

interface Props {
  employeeId: string;
  employeeName: string;
  shiftStartedAt: string | null;
  shiftEndedAt: string | null;
}

export function EmployeeMovementTimeline({ employeeId, employeeName, shiftStartedAt, shiftEndedAt }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAllPings, setShowAllPings] = useState(false);

  useEffect(() => {
    if (!employeeId || !shiftStartedAt) { setLoading(false); return; }
    loadTimeline();
    // Poll every 60s for live shifts
    const interval = !shiftEndedAt ? setInterval(loadTimeline, 60_000) : undefined;
    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, shiftStartedAt, shiftEndedAt]);

  const loadTimeline = async () => {
    setLoading(true);
    const from = shiftStartedAt!;
    const to = shiftEndedAt || new Date().toISOString();

    const [locRes, visitRes] = await Promise.all([
      supabase
        .from('employee_location_history')
        .select('id, lat, lng, timestamp, accuracy_m, is_mock')
        .eq('employee_id', employeeId)
        .gte('timestamp', from)
        .lte('timestamp', to)
        .order('timestamp', { ascending: true })
        .limit(1000),
      supabase
        .from('society_data')
        .select('id, name, address, contact_person, created_at, lat, lng, selfie_url, verification_status')
        .eq('employee_id', employeeId)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: true }),
    ]);

    const all: TimelineEvent[] = [];

    // Shift start event
    all.push({
      id: 'shift-start',
      type: 'shift_start',
      timestamp: from,
      lat: null, lng: null,
      meta: {},
    });

    // GPS pings
    if (locRes.data) {
      for (const p of locRes.data) {
        all.push({
          id: p.id,
          type: 'gps_ping',
          timestamp: p.timestamp,
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy_m,
          meta: { is_mock: p.is_mock },
        });
      }
    }

    // Visits
    if (visitRes.data) {
      for (const v of visitRes.data) {
        all.push({
          id: v.id,
          type: 'visit',
          timestamp: v.created_at,
          lat: v.lat,
          lng: v.lng,
          meta: {
            name: v.name,
            address: v.address,
            contact_person: v.contact_person,
            selfie_url: v.selfie_url,
            verification_status: v.verification_status,
          },
        });
      }
    }

    // Shift end event
    if (shiftEndedAt) {
      all.push({
        id: 'shift-end',
        type: 'shift_end',
        timestamp: shiftEndedAt,
        lat: null, lng: null,
      });
    }

    // Sort chronologically
    all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setEvents(all);
    setLoading(false);
  };

  if (!shiftStartedAt) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        No shift started today — timeline unavailable.
      </div>
    );
  }

  const gpsCount = events.filter(e => e.type === 'gps_ping').length;
  const visitCount = events.filter(e => e.type === 'visit').length;

  // Filter: collapse consecutive GPS pings unless expanded
  const displayEvents = showAllPings
    ? events
    : events.filter((e, i) => {
        if (e.type !== 'gps_ping') return true;
        // Always show first/last ping
        if (i === 0 || i === events.length - 1) return true;
        // Show ping if adjacent to a non-ping event
        const prev = events[i - 1];
        const next = events[i + 1];
        if (prev?.type !== 'gps_ping' || next?.type !== 'gps_ping') return true;
        // Show every 5th ping
        const pingsBeforeMe = events.slice(0, i).filter(x => x.type === 'gps_ping').length;
        return pingsBeforeMe % 5 === 0;
      });

  const skippedPings = gpsCount - displayEvents.filter(e => e.type === 'gps_ping').length;

  return (
    <div className="mt-1">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between gap-2 py-2 px-1 text-left hover:bg-muted/20 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">Movement Timeline</span>
          <Badge variant="outline" className="text-[10px] py-0 h-5">
            {gpsCount} pings · {visitCount} visits
          </Badge>
          {!shiftEndedAt && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="relative pl-5 pb-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading timeline…
            </div>
          ) : events.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              No movement data recorded during this shift.
            </div>
          ) : (
            <>
              {/* Vertical line */}
              <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

              {displayEvents.map((evt, idx) => (
                <TimelineItem key={evt.id} event={evt} isLast={idx === displayEvents.length - 1} />
              ))}

              {/* Show/hide pings toggle */}
              {skippedPings > 0 && (
                <button
                  onClick={() => setShowAllPings(p => !p)}
                  className="ml-3 text-[11px] text-primary hover:underline mt-1"
                >
                  {showAllPings ? 'Collapse GPS pings' : `Show all ${gpsCount} GPS pings (${skippedPings} hidden)`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineItem({ event: evt, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const time = format(new Date(evt.timestamp), 'HH:mm:ss');
  const timeShort = format(new Date(evt.timestamp), 'HH:mm');

  const dot = {
    shift_start: 'bg-green-500',
    shift_end: 'bg-slate-500',
    visit: 'bg-primary',
    gps_ping: evt.meta?.is_mock ? 'bg-red-400' : 'bg-blue-400',
  }[evt.type];

  const icon = {
    shift_start: <Play className="w-3 h-3 text-green-600 fill-green-600" />,
    shift_end: <Square className="w-3 h-3 text-slate-500 fill-slate-500" />,
    visit: <Eye className="w-3 h-3 text-primary" />,
    gps_ping: <Navigation className="w-3 h-3 text-blue-500" />,
  }[evt.type];

  const mapsUrl = evt.lat && evt.lng ? `https://www.google.com/maps?q=${evt.lat},${evt.lng}` : null;

  return (
    <div className={`relative flex items-start gap-3 ${isLast ? '' : 'pb-3'}`}>
      {/* Dot on the vertical line */}
      <div className={`absolute left-[-14px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${dot} z-10`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {evt.type === 'shift_start' && (
          <div className="flex items-center gap-2 text-xs">
            {icon}
            <span className="font-semibold text-green-700">Shift Started</span>
            <span className="text-muted-foreground">{timeShort}</span>
          </div>
        )}

        {evt.type === 'shift_end' && (
          <div className="flex items-center gap-2 text-xs">
            {icon}
            <span className="font-semibold text-slate-600">Shift Ended</span>
            <span className="text-muted-foreground">{timeShort}</span>
          </div>
        )}

        {evt.type === 'gps_ping' && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {icon}
            <span className="text-muted-foreground font-mono">{time}</span>
            {evt.accuracy != null && (
              <span className="text-[10px] text-muted-foreground">±{Math.round(evt.accuracy)}m</span>
            )}
            {evt.meta?.is_mock && (
              <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> Mock GPS
              </span>
            )}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" /> Map
              </a>
            )}
          </div>
        )}

        {evt.type === 'visit' && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 -ml-1">
            <div className="flex items-start gap-2">
              {icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate">{evt.meta?.name || 'Visit'}</span>
                  <span className="text-[10px] text-muted-foreground">{timeShort}</span>
                  {evt.meta?.verification_status && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] py-0 h-4 ${
                        evt.meta.verification_status === 'verified_real' ? 'bg-green-50 text-green-700 border-green-200' :
                        evt.meta.verification_status === 'verified_fake' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {evt.meta.verification_status === 'verified_real' ? 'Real' :
                       evt.meta.verification_status === 'verified_fake' ? 'Fake' : 'Pending'}
                    </Badge>
                  )}
                </div>
                {evt.meta?.address && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{evt.meta.address}</div>
                )}
                {evt.meta?.contact_person && (
                  <div className="text-[10px] text-muted-foreground">Contact: {evt.meta.contact_person}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" /> View on Map
                    </a>
                  )}
                  {evt.meta?.selfie_url && (
                    <a href={evt.meta.selfie_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">
                      📸 Selfie
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeMovementTimeline;
