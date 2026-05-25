import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/shared';
import { Card } from '@/components/ui/card';
import { exportToCSV } from '../lib/utils';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CapacitorHttp } from '@capacitor/core';

let olaProtocolRegistered = false;
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Navigation, Clock, AlertTriangle, CheckCircle2, WifiOff, Activity, Play, Square, Route as RouteIcon, X, Locate, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { EmployeeMovementTimeline } from '@/components/EmployeeMovementTimeline';
import { MobileTrackingSheet } from '@/components/MobileTrackingSheet';

const MAP_STYLE: any = {
  version: 8,
  sources: {
    'osm-raster-tiles': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};


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

// Status → marker dot color
const STATUS_COLORS: Record<EmpStatus, string> = {
  live: '#22c55e',
  recent: '#3b82f6',
  stale: '#f59e0b',
  offline: '#94a3b8',
};

/**
 * Create an HTML marker element for an employee, using the avatar-marker
 * CSS classes configured in index.css.
 */
function createMarkerElement(name: string, status: EmpStatus): HTMLDivElement {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const el = document.createElement('div');
  el.className = 'maplibre-marker-wrapper mapbox-marker-wrapper';
  el.innerHTML = `<div class="avatar-marker-container"><div class="avatar-marker-dot status-${status}">${initials}</div><div class="avatar-marker-arrow"></div></div>`;
  return el;
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

  type MapProvider = 'olamaps' | 'mapbox' | 'osm';
  const [mapProvider, setMapProvider] = useState<MapProvider>(() => {
    if (import.meta.env.VITE_OLA_MAPS_API_KEY) return 'olamaps';
    if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) return 'mapbox';
    return 'osm';
  });

  // Refs for map and markers
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<Map<string, { marker: any; popup: any; element: HTMLDivElement }>>(new Map());
  const popupRef = useRef<any | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const employeesRef = useRef<any[]>([]);
  const autoFollowRef = useRef(true);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { autoFollowRef.current = autoFollow; }, [autoFollow]);

  // Responsive detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Data fetchers ─────────────────────────────────────────────
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
      for (const s of data as Shift[]) {
        if (!map[s.employee_id]) map[s.employee_id] = s;
      }
      setShiftsToday(map);
    }
  };

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

  // ── Initialize map ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let mapInstance: any = null;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      // Destroy previous map if it exists
      if (mapRef.current) {
        markersRef.current.forEach(({ marker }) => marker.remove());
        markersRef.current.clear();
        mapRef.current.remove();
        mapRef.current = null;
      }

      const mapEngine = mapProvider === 'mapbox' ? mapboxgl : maplibregl;

      if (mapProvider === 'mapbox') {
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
      }

      const mapOptions: any = {
        container: mapContainerRef.current,
        center: [78.9629, 20.5937], // Center of India [lng, lat]
        zoom: 5,
      };

      if (mapProvider === 'olamaps') {
        const OLA_API_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY;

        // Register custom protocol to route tile/sprite/glyph requests through
        // the main thread. CapacitorHttp patches main-thread XMLHttpRequest to
        // use the native Android HTTP client, which has NO Origin header and
        // therefore bypasses Ola Maps' domain restrictions.
        if (!olaProtocolRegistered) {
          maplibregl.addProtocol('ola', (params: any, callback: any) => {
            const httpsUrl = params.url.replace('ola://', 'https://');
            const xhr = new XMLHttpRequest();
            xhr.open('GET', httpsUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                callback(null, xhr.response, null, null);
              } else {
                callback(new Error(`HTTP ${xhr.status}`));
              }
            };
            xhr.onerror = () => callback(new Error('XHR network error'));
            xhr.send();
            return { cancel: () => xhr.abort() };
          });
          olaProtocolRegistered = true;
        }

        // Pre-fetch style.json via CapacitorHttp (native HTTP – no CORS / no
        // Origin header) and rewrite every URL inside to use our custom "ola://"
        // protocol so subsequent tile/sprite/glyph loads also bypass CORS.
        try {
          const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_API_KEY}`;
          const styleRes = await CapacitorHttp.get({ url: styleUrl });

          if (cancelled) return; // component unmounted during fetch

          const styleObj = typeof styleRes.data === 'string' ? JSON.parse(styleRes.data) : styleRes.data;

          // Helper: append api_key and swap https→ola://
          const rewriteUrl = (u: string) => {
            if (!u || typeof u !== 'string') return u;
            if (!u.includes('api_key=')) {
              const sep = u.includes('?') ? '&' : '?';
              u = `${u}${sep}api_key=${OLA_API_KEY}`;
            }
            return u.replace(/^https:\/\//, 'ola://');
          };

          // Rewrite sprite, glyphs, and all tile source URLs
          if (styleObj.sprite) styleObj.sprite = rewriteUrl(styleObj.sprite);
          if (styleObj.glyphs) styleObj.glyphs = rewriteUrl(styleObj.glyphs);
          if (styleObj.sources) {
            for (const src of Object.values(styleObj.sources) as any[]) {
              if (src.tiles) src.tiles = src.tiles.map(rewriteUrl);
              if (src.url) src.url = rewriteUrl(src.url);
            }
          }

          mapOptions.style = styleObj;
        } catch (err) {
          console.error('Ola Maps style fetch failed, falling back to OSM', err);
          mapOptions.style = MAP_STYLE; // fallback to OSM
        }

        mapOptions.transformRequest = (url: string, _resourceType: string) => {
          if (url.includes('olamaps.io')) {
            let newUrl = url;
            if (!newUrl.includes('api_key=')) {
              const sep = newUrl.includes('?') ? '&' : '?';
              newUrl = `${newUrl}${sep}api_key=${OLA_API_KEY}`;
            }
            if (newUrl.startsWith('https://')) {
              newUrl = newUrl.replace('https://', 'ola://');
            }
            return { url: newUrl };
          }
          return { url };
        };
      } else if (mapProvider === 'mapbox') {
        mapOptions.style = 'mapbox://styles/mapbox/navigation-day-v1';
      } else {
        mapOptions.style = MAP_STYLE;
      }

      if (cancelled) return;

      const map = new (mapEngine as any).Map(mapOptions);
      mapInstance = map;

      map.addControl(new (mapEngine as any).NavigationControl(), 'top-right');

      map.on('load', () => {
        // Add empty route source + layer (will be updated when employee selected)
        map.addSource('employee-route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
        });

        map.addLayer({
          id: 'employee-route-line',
          type: 'line',
          source: 'employee-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#2563EB',
            'line-width': 4,
            'line-opacity': 0.75,
            'line-dasharray': [3, 2],
          },
        });
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      // Cleanup markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
  }, [mapProvider]);

  // ── Sync markers with employees ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    const mapEngine = mapProvider === 'mapbox' ? mapboxgl : maplibregl;
    const existingIds = new Set(markersRef.current.keys());
    const currentIds = new Set(employees.map(e => e.id));

    // Remove markers for employees no longer in view
    existingIds.forEach(id => {
      if (!currentIds.has(id)) {
        const entry = markersRef.current.get(id);
        if (entry) {
          entry.marker.remove();
          markersRef.current.delete(id);
        }
      }
    });

    // Add or update markers
    employees.forEach(emp => {
      if (!emp.current_lat || !emp.current_lng) return;
      const status = classifyEmployee(emp);
      const isSelected = selectedId === emp.id;

      const existing = markersRef.current.get(emp.id);
      if (existing) {
        // Smooth animate to new position
        const currentLngLat = existing.marker.getLngLat();
        const newLng = emp.current_lng;
        const newLat = emp.current_lat;

        if (Math.abs(currentLngLat.lng - newLng) > 0.00001 || Math.abs(currentLngLat.lat - newLat) > 0.00001) {
          animateMarker(existing.marker, currentLngLat, { lng: newLng, lat: newLat });
        }

        // Update opacity for selection state
        existing.element.style.opacity = selectedId && !isSelected ? '0.5' : '1';

        // Update status class
        const dot = existing.element.querySelector('.avatar-marker-dot');
        if (dot) {
          dot.className = `avatar-marker-dot status-${status}`;
        }
      } else {
        // Create new marker
        const el = createMarkerElement(emp.name, status);
        el.style.cursor = 'pointer';
        el.style.opacity = selectedId && !isSelected ? '0.5' : '1';

        el.addEventListener('click', () => {
          selectEmployee(emp.id);
        });

        const marker = new (mapEngine as any).Marker({ element: el, anchor: 'bottom' })
          .setLngLat([emp.current_lng, emp.current_lat])
          .addTo(map);

        const popup = new (mapEngine as any).Popup({ offset: [0, -48], closeButton: true, closeOnClick: false, maxWidth: '280px' });

        markersRef.current.set(emp.id, { marker, popup, element: el });
      }
    });

    // Fit bounds if no employee selected and we have employees
    if (!selectedId && employees.length > 0) {
      const bounds = new (mapEngine as any).LngLatBounds();
      employees.forEach(emp => {
        if (emp.current_lat && emp.current_lng) {
          bounds.extend([emp.current_lng, emp.current_lat]);
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      }
    }
  }, [employees, loading, selectedId, mapProvider]);

  // ── Update route polyline ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource('employee-route') as any;
    if (!source) return;

    if (selectedId && route.length >= 2) {
      source.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          // MapLibre/Mapbox use [lng, lat], our route is [lat, lng]
          coordinates: route.map(([lat, lng]) => [lng, lat]),
        },
        properties: {},
      });
    } else {
      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
        properties: {},
      });
    }
  }, [route, selectedId]);

  // ── Auto-follow selected employee ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || !autoFollow) return;

    const emp = employees.find(e => e.id === selectedId);
    if (emp && emp.current_lat && emp.current_lng) {
      map.panTo([emp.current_lng, emp.current_lat], { duration: 500 });
    }
  }, [employees, selectedId, autoFollow]);

  // ── Fit to route/employee when selection changes ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    const mapEngine = mapProvider === 'mapbox' ? mapboxgl : maplibregl;
    const emp = employees.find(e => e.id === selectedId);
    if (!emp) return;

    if (route.length > 0) {
      const bounds = new (mapEngine as any).LngLatBounds();
      route.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 17, duration: 800 });
    } else if (emp.current_lat && emp.current_lng) {
      map.flyTo({ center: [emp.current_lng, emp.current_lat], zoom: Math.max(map.getZoom(), 16), duration: 800 });
    }
  }, [selectedId, route, mapProvider]);

  // ── Smooth marker animation ───────────────────────────────────
  function animateMarker(
    marker: any,
    from: { lng: number; lat: number },
    to: { lng: number; lat: number }
  ) {
    const duration = 1000;
    const start = performance.now();

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const lng = from.lng + (to.lng - from.lng) * ease;
      const lat = from.lat + (to.lat - from.lat) * ease;
      marker.setLngLat([lng, lat]);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Supabase realtime + polling ───────────────────────────────
  useEffect(() => {
    fetchEmployees();
    fetchVisitsToday();
    fetchShiftsToday();

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

    const interval = setInterval(() => {
      fetchEmployees();
      fetchVisitsToday();
      fetchShiftsToday();
    }, 30_000);

    const ticker = setInterval(() => setEmployees((p) => [...p]), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, []);

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

  const counts = useMemo(() => {
    const c: Record<EmpStatus, number> = { live: 0, recent: 0, stale: 0, offline: 0 };
    for (const e of employees) c[classifyEmployee(e)]++;
    return c;
  }, [employees]);

  const filteredEmployees = useMemo(
    () => filter === 'all' ? employees : employees.filter(e => classifyEmployee(e) === filter),
    [employees, filter]
  );

  const selectEmployee = useCallback((id: string) => {
    if (selectedIdRef.current === id) {
      setSelectedId(null);
      setRoute([]);
      return;
    }
    setSelectedId(id);
    setAutoFollow(true);
    fetchRouteFor(id);
  }, []);

  const selectedEmp = useMemo(
    () => (selectedId ? employees.find((e) => e.id === selectedId) : null),
    [selectedId, employees]
  );

  // ── Show popup for selected employee on marker click ──────────
  useEffect(() => {
    if (!selectedEmp || !mapRef.current) return;

    // Close existing popup
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [selectedId]);

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
            <div className="absolute top-3 left-3 z-[10] bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg p-3 max-w-[300px]">
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
            <>
              {/* Map Provider Switcher */}
              <div className="absolute top-3 right-12 z-[10] flex gap-2">
                <div className="bg-card/90 backdrop-blur-md border border-border shadow-md rounded-full px-1.5 py-1 flex items-center gap-1">
                  {import.meta.env.VITE_OLA_MAPS_API_KEY && (
                    <button
                      onClick={() => setMapProvider('olamaps')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                        mapProvider === 'olamaps'
                          ? 'bg-slate-900 text-white shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Ola Maps
                    </button>
                  )}
                  <button
                    onClick={() => setMapProvider('osm')}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                      mapProvider === 'osm'
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    OpenStreetMap
                  </button>
                  {import.meta.env.VITE_MAPBOX_ACCESS_TOKEN && (
                    <button
                      onClick={() => setMapProvider('mapbox')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                        mapProvider === 'mapbox'
                          ? 'bg-slate-900 text-white shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Mapbox GL
                    </button>
                  )}
                </div>
              </div>

              <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

              {/* Mobile: Re-center FAB */}
              {isMobile && selectedId && selectedEmp && (
                <button
                  onClick={() => setAutoFollow(true)}
                  className="absolute bottom-48 right-3 z-[10] bg-white shadow-lg border border-border rounded-full w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                  title="Re-center on employee"
                >
                  <Locate className="w-5 h-5 text-primary" />
                </button>
              )}
            </>
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
