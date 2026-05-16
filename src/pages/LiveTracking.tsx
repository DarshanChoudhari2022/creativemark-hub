import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/shared';
import { Card } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Navigation, Clock, AlertTriangle, CheckCircle2, WifiOff, Activity, Play, Square, Route as RouteIcon, X, Locate, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { EmployeeMovementTimeline } from '@/components/EmployeeMovementTimeline';
import { MobileTrackingSheet } from '@/components/MobileTrackingSheet';

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

// Pan + zoom the map onto the selected employee's path. Defined as a child
// of MapContainer so we have access to the map instance via useMap().
function MapFocus({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 14), { duration: 0.5 });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.5 });
  }, [points, map]);
  return null;
}

// Activity thresholds. Match these to the field-app heartbeat (2 min) so a
// healthy employee always lands in "Live".
const LIVE_MS = 5 * 60 * 1000;      // < 5 min  → Live
const RECENT_MS = 30 * 60 * 1000;   // < 30 min → Recent
const STALE_MS = 24 * 60 * 60 * 1000; // < 24 h  → Stale (else Offline)

type EmpStatus = 'live' | 'recent' | 'stale' | 'offline';
function classifyEmployee(emp: { last_location_update?: string | null }): EmpStatus {
  if (!emp.last_location_update) return 'offline';
  const age = Date.now() - new Date(emp.last_location_update).getTime();
  if (age < LIVE_MS) return 'live';
  if (age < RECENT_MS) return 'recent';
  if (age < STALE_MS) return 'stale';
  return 'offline';
}

// Fix Leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icon factory keyed by status colour.
function makeIcon(color: 'green' | 'blue' | 'orange' | 'grey') {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}
const ICONS: Record<EmpStatus, L.Icon> = {
  live: makeIcon('green'),
  recent: makeIcon('blue'),
  stale: makeIcon('orange'),
  offline: makeIcon('grey'),
};

/**
 * MapFocus — auto-zooms / pans map to fit a set of points.
 * Re-triggers whenever `points` change (e.g. new GPS ping arrives
 * for the selected employee).
 */
function MapFocus({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true, duration: 0.8 });
    }
  }, [points, map]);
  return null;
}

/**
 * AutoFollow — keeps map centered on the selected employee's latest
 * position whenever it changes. This is the Zomato "follow rider" behavior.
 */
function AutoFollow({ lat, lng, enabled }: { lat: number; lng: number; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !lat || !lng) return;
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [lat, lng, enabled, map]);
  return null;
}

/**
 * SmoothMarker — wraps a react-leaflet Marker and smoothly animates
 * its position when coordinates change (like a Zomato delivery boy
 * marker sliding on the map).
 */
function SmoothMarker({ position, icon, eventHandlers, opacity, children }: {
  position: [number, number];
  icon: L.Icon | L.DivIcon;
  eventHandlers?: any;
  opacity?: number;
  children?: React.ReactNode;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPos = useRef<[number, number]>(position);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const [oldLat, oldLng] = prevPos.current;
    const [newLat, newLng] = position;
    if (oldLat === newLat && oldLng === newLng) return;

    // Animate over 1 second in 30 steps
    const steps = 30;
    const dLat = (newLat - oldLat) / steps;
    const dLng = (newLng - oldLng) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      marker.setLatLng([
        oldLat + dLat * step,
        oldLng + dLng * step,
      ]);
      if (step >= steps) {
        clearInterval(interval);
        prevPos.current = position;
      }
    }, 33); // ~30fps
    return () => clearInterval(interval);
  }, [position]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      eventHandlers={eventHandlers}
      opacity={opacity}
    >
      {children}
    </Marker>
  );
}

const LiveTracking = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [visitsToday, setVisitsToday] = useState<Record<string, number>>({});
  const [shiftsToday, setShiftsToday] = useState<Record<string, Shift>>({});
  const [filter, setFilter] = useState<'all' | EmpStatus>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [autoFollow, setAutoFollow] = useState(true);
  // Mirror selectedId into a ref so the realtime handler (registered once,
  // empty deps) can always read the *current* selection without forcing a
  // channel re-subscribe on every click.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Responsive detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Custom avatar DivIcon factory
  const makeAvatarIcon = useCallback((name: string, status: EmpStatus) => {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
    return L.divIcon({
      className: 'leaflet-marker-avatar',
      iconSize: [48, 56],
      iconAnchor: [24, 56],
      popupAnchor: [0, -48],
      html: `<div class="avatar-marker-container"><div class="avatar-marker-dot status-${status}">${initials}</div><div class="avatar-marker-arrow"></div></div>`,
    });
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role, current_lat, current_lng, last_location_update')
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  };

  // Today's visit count per employee (for the right sidebar tile + popup).
  const fetchVisitsToday = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('society_data')
      .select('employee_id')
      .gte('created_at', start.toISOString());
    if (!error && data) {
      const map: Record<string, number> = {};
      for (const row of data as any[]) {
        if (row.employee_id) map[row.employee_id] = (map[row.employee_id] || 0) + 1;
      }
      setVisitsToday(map);
    }
  };

  // Latest shift (open or closed) per employee that started today.
  const fetchShiftsToday = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('employee_shifts')
      .select('id, employee_id, started_at, ended_at, start_selfie_url, end_selfie_url, duration_min, visit_count')
      .gte('started_at', start.toISOString())
      .order('started_at', { ascending: false });
    if (!error && data) {
      const map: Record<string, Shift> = {};
      // First seen wins (data is sorted desc, so we get the latest shift)
      for (const s of data as Shift[]) {
        if (!map[s.employee_id]) map[s.employee_id] = s;
      }
      setShiftsToday(map);
    }
  };

  // Pull the day's location history for one employee and stash it as a
  // polyline. We cap at 500 points to keep the canvas snappy.
  const fetchRouteFor = async (employeeId: string) => {
    setRouteLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('employee_location_history')
      .select('lat, lng, timestamp')
      .eq('employee_id', employeeId)
      .gte('timestamp', start.toISOString())
      .order('timestamp', { ascending: true })
      .limit(500);
    setRouteLoading(false);
    if (error || !data) {
      setRoute([]);
      return;
    }
    setRoute((data as any[]).map((p) => [p.lat, p.lng] as [number, number]));
  };

  useEffect(() => {
    fetchEmployees();
    fetchVisitsToday();
    fetchShiftsToday();

    // Subscribe to real-time location updates from employees
    const channel = supabase.channel('employee_locations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employees' },
        (payload) => {
          const updatedEmp = payload.new;
          if (updatedEmp.current_lat && updatedEmp.current_lng) {
            setEmployees((prev) => {
              const exists = prev.find(e => e.id === updatedEmp.id);
              if (exists) {
                return prev.map(e => e.id === updatedEmp.id ? { ...e, ...updatedEmp } : e);
              }
              return [...prev, updatedEmp];
            });
            // Live-extend the polyline if the selected employee just moved.
            const sel = selectedIdRef.current;
            if (sel && updatedEmp.id === sel) {
              setRoute((prev) => [...prev, [updatedEmp.current_lat, updatedEmp.current_lng] as [number, number]]);
            }
          }
        }
      )
      .subscribe();

    // Polling backup every 30 seconds (also re-classifies stale employees)
    const interval = setInterval(() => {
      fetchEmployees();
      fetchVisitsToday();
      fetchShiftsToday();
    }, 30_000);

    // Force re-render every 30s so the "X minutes ago" labels and the
    // Live/Stale classification stay current even without DB activity.
    const ticker = setInterval(() => setEmployees((p) => [...p]), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, []);

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

  // Default center of India if no employees, otherwise center on the first employee
  const center: [number, number] = employees.length > 0 && employees[0].current_lat
    ? [employees[0].current_lat, employees[0].current_lng]
    : [20.5937, 78.9629];

  const counts = useMemo(() => {
    const c: Record<EmpStatus, number> = { live: 0, recent: 0, stale: 0, offline: 0 };
    for (const e of employees) c[classifyEmployee(e)]++;
    return c;
  }, [employees]);

  const filteredEmployees = useMemo(
    () => filter === 'all' ? employees : employees.filter(e => classifyEmployee(e) === filter),
    [employees, filter]
  );

  // Click-to-focus from sidebar. Loads the polyline once.
  const selectEmployee = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setRoute([]);
      return;
    }
    setSelectedId(id);
    setAutoFollow(true); // re-enable auto-follow when selecting a new employee
    fetchRouteFor(id);
  };

  const selectedEmp = useMemo(
    () => (selectedId ? employees.find((e) => e.id === selectedId) : null),
    [selectedId, employees]
  );

  return (
    <div className={`h-full flex flex-col ${isMobile ? 'tracking-page-mobile' : ''}`}>
      {!isMobile && <PageHeader
        title="Live Tracking"
        subtitle="Track field salespersons in real-time"
        actions={
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Live Updates Active
          </Badge>
        }
      />}

      {/* Status filter pills — hidden on mobile (filters in bottom sheet) */}
      {!isMobile && (
        <div className="flex flex-wrap gap-2 mt-2 mb-3">
          {([
            { key: 'all',     label: 'All',      icon: Activity,        cls: 'bg-slate-100 text-slate-700 border-slate-200',     active: 'bg-slate-900 text-white border-slate-900' },
            { key: 'live',    label: 'Live',     icon: CheckCircle2,    cls: 'bg-green-50 text-green-700 border-green-200',       active: 'bg-green-600 text-white border-green-600' },
            { key: 'recent',  label: 'Recent',   icon: Clock,           cls: 'bg-blue-50 text-blue-700 border-blue-200',          active: 'bg-blue-600 text-white border-blue-600' },
            { key: 'stale',   label: 'Stale',    icon: AlertTriangle,   cls: 'bg-amber-50 text-amber-700 border-amber-200',       active: 'bg-amber-600 text-white border-amber-600' },
            { key: 'offline', label: 'Offline',  icon: WifiOff,         cls: 'bg-slate-50 text-slate-600 border-slate-200',       active: 'bg-slate-600 text-white border-slate-600' },
          ] as const).map(opt => {
            const Icon = opt.icon;
            const count = opt.key === 'all' ? employees.length : counts[opt.key as EmpStatus];
            const isActive = filter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${isActive ? opt.active : opt.cls + ' hover:opacity-80'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
                <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold ${isActive ? 'bg-white/20' : 'bg-white'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`flex-1 ${isMobile ? 'relative -mx-4 -mt-2 -mb-4 md:-mx-6 md:-mb-6' : 'grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px] mt-2'}`}>
        
        {/* Left Side: Map */}
        <Card className={`${isMobile ? 'h-full border-0 shadow-none rounded-none' : 'lg:col-span-3 h-full border-border/50 shadow-sm'} overflow-hidden relative z-0`}>
          {/* Selected-employee banner overlay (shows above map). */}
          {selectedEmp && (
            <div className="absolute top-3 left-3 z-[1000] bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg p-3 max-w-[300px]">
              <div className="flex items-start gap-2">
                <RouteIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{selectedEmp.name}'s route today</div>
                  <div className="text-[11px] text-muted-foreground">
                    {routeLoading
                      ? 'Loading path...'
                      : route.length > 0
                        ? `${route.length} GPS points · live updates`
                        : 'No location history today yet.'}
                  </div>
                  {shiftsToday[selectedEmp.id] && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Shift: {format(new Date(shiftsToday[selectedEmp.id].started_at), 'HH:mm')}
                      {shiftsToday[selectedEmp.id].ended_at
                        ? ` → ${format(new Date(shiftsToday[selectedEmp.id].ended_at!), 'HH:mm')}`
                        : ' → ongoing'}
                    </div>
                  )}
                  {selectedEmp.current_lat && selectedEmp.current_lng && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedEmp.current_lat},${selectedEmp.current_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in Google Maps
                    </a>
                  )}
                </div>
                <button
                  onClick={() => selectEmployee(selectedEmp.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!loading ? (
            <MapContainer
              center={center}
              zoom={employees.length > 0 ? 12 : 5}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {/* Today's route for the selected employee. Animated dashed line like Zomato. */}
              {selectedId && route.length >= 2 && (
                <Polyline
                  positions={route}
                  pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.75, dashArray: '12 8', className: 'animated-route' }}
                />
              )}

              {/* Auto-follow the selected employee's live position (Zomato-style) */}
              {selectedId && selectedEmp && selectedEmp.current_lat && (
                <AutoFollow
                  lat={selectedEmp.current_lat}
                  lng={selectedEmp.current_lng}
                  enabled={autoFollow}
                />
              )}

              {/* Auto-zoom to fit the polyline (or single marker) when selection changes. */}
              {selectedId && (
                <MapFocus
                  points={
                    route.length > 0
                      ? route
                      : selectedEmp && selectedEmp.current_lat
                        ? [[selectedEmp.current_lat, selectedEmp.current_lng]]
                        : []
                  }
                />
              )}

              {filteredEmployees.map((emp) => {
                const status = classifyEmployee(emp);
                const lastUpdate = emp.last_location_update ? new Date(emp.last_location_update) : null;
                const shift = shiftsToday[emp.id];
                const isSelected = selectedId === emp.id;
                return (
                  <SmoothMarker
                    key={emp.id}
                    position={[emp.current_lat, emp.current_lng]}
                    icon={isMobile ? makeAvatarIcon(emp.name, status) : ICONS[status]}
                    eventHandlers={{ click: () => selectEmployee(emp.id) }}
                    opacity={selectedId && !isSelected ? 0.5 : 1}
                  >
                    <Popup className="rounded-lg">
                      <div className="font-sans">
                        <div className="font-bold text-base mb-1">{emp.name}</div>
                        <div className="text-sm text-muted-foreground mb-2">{emp.role}</div>
                        <div className="text-xs flex items-center gap-1.5 text-slate-500 mb-1">
                          <Clock className="w-3 h-3" />
                          {lastUpdate ? `Updated ${formatDistanceToNow(lastUpdate, { addSuffix: true })}` : 'No update yet'}
                        </div>
                        <div className="text-xs text-slate-600 mb-1">
                          <span className="font-medium">Visits today:</span> {visitsToday[emp.id] || 0}
                        </div>
                        {shift ? (
                          <div className="text-xs text-slate-600 flex items-center gap-1">
                            {shift.ended_at ? (
                              <><Square className="w-3 h-3 text-slate-500" /> Shift {format(new Date(shift.started_at), 'HH:mm')}–{format(new Date(shift.ended_at), 'HH:mm')}</>
                            ) : (
                              <><Play className="w-3 h-3 text-green-600" /> On shift since {format(new Date(shift.started_at), 'HH:mm')}</>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 font-medium">No shift started today</div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); selectEmployee(emp.id); }}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <RouteIcon className="w-3 h-3" />
                            {isSelected ? 'Hide route' : "Show today's route"}
                          </button>
                          <a
                            href={`https://www.google.com/maps?q=${emp.current_lat},${emp.current_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Google Maps
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </SmoothMarker>
                );
              })}
            </MapContainer>

            {/* Mobile: Re-center FAB */}
            {isMobile && selectedId && selectedEmp && (
              <button
                onClick={() => setAutoFollow(true)}
                className="absolute bottom-48 right-3 z-[1000] bg-white shadow-lg border border-border rounded-full w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                title="Re-center on employee"
              >
                <Locate className="w-5 h-5 text-primary" />
              </button>
            )}
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </Card>

        {/* Desktop: Right sidebar | Mobile: Bottom sheet */}
        {isMobile ? (
          <MobileTrackingSheet
            employees={filteredEmployees}
            selectedId={selectedId}
            onSelect={selectEmployee}
            visitsToday={visitsToday}
            shiftsToday={shiftsToday}
            classifyEmployee={classifyEmployee}
            route={route}
            routeLoading={routeLoading}
          />
        ) : (
        <Card className="h-full border-border/50 shadow-sm flex flex-col">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              Field Team Status
            </h3>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {filteredEmployees.length === 0 && !loading && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <MapPin className="w-8 h-8 mx-auto mb-3 opacity-20" />
                {filter === 'all'
                  ? 'No employees are currently sharing their location.'
                  : `No employees in "${filter}" status.`}
              </div>
            )}

            {filteredEmployees.map(emp => {
              const status = classifyEmployee(emp);
              const lastUpdate = emp.last_location_update ? new Date(emp.last_location_update) : null;
              const dotCls = status === 'live' ? 'bg-green-500' : status === 'recent' ? 'bg-blue-500' : status === 'stale' ? 'bg-amber-500' : 'bg-slate-300';
              const shift = shiftsToday[emp.id];
              const isSelected = selectedId === emp.id;
              return (
                <div key={emp.id}>
                  <button
                    onClick={() => selectEmployee(emp.id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                          {getInitials(emp.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${dotCls}`}></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                        {emp.name}
                        {shift && !shift.ended_at && (
                          <span title="Shift in progress" className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-semibold">
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : 'never'}
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {visitsToday[emp.id] || 0} today
                    </Badge>
                  </button>

                  {/* Movement timeline for selected employee */}
                  {isSelected && shift && (
                    <div className="ml-2 mr-1 mt-1 mb-2 border border-border/40 rounded-lg p-2 bg-muted/10">
                      <EmployeeMovementTimeline
                        employeeId={emp.id}
                        employeeName={emp.name}
                        shiftStartedAt={shift.started_at}
                        shiftEndedAt={shift.ended_at}
                      />
                    </div>
                  )}
                  {isSelected && !shift && (
                    <div className="ml-2 mr-1 mt-1 mb-2 text-[11px] text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      No shift started today — movement timeline unavailable.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
        )}
      </div>
    </div>
  );
};

export default LiveTracking;
