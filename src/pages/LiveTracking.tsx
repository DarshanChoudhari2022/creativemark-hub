import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Card } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Fix Leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icon for employees
const employeeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Active employee icon (updated recently)
const activeEmployeeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LiveTracking = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchEmployees();

    // Subscribe to real-time location updates from employees
    const channel = supabase.channel('employee_locations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employees' },
        (payload) => {
          const updatedEmp = payload.new;
          // Only update if location data is present
          if (updatedEmp.current_lat && updatedEmp.current_lng) {
            setEmployees((prev) => {
              const exists = prev.find(e => e.id === updatedEmp.id);
              if (exists) {
                return prev.map(e => e.id === updatedEmp.id ? { ...e, ...updatedEmp } : e);
              } else {
                return [...prev, updatedEmp];
              }
            });
          }
        }
      )
      .subscribe();

    // Polling backup every 30 seconds
    const interval = setInterval(fetchEmployees, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

  // Default center of India if no employees, otherwise center on the first employee
  const center: [number, number] = employees.length > 0 && employees[0].current_lat 
    ? [employees[0].current_lat, employees[0].current_lng] 
    : [20.5937, 78.9629]; 

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Live Tracking"
        subtitle="Track field salespersons in real-time"
        actions={
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Live Updates Active
          </Badge>
        }
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px] mt-2">
        
        {/* Left Side: Map */}
        <Card className="lg:col-span-3 h-full overflow-hidden border-border/50 shadow-sm relative z-0">
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
              
              {employees.map((emp) => {
                // Determine if employee is "Active" (updated in the last 15 mins)
                const lastUpdate = new Date(emp.last_location_update);
                const isActive = (new Date().getTime() - lastUpdate.getTime()) < 15 * 60 * 1000;

                return (
                  <Marker 
                    key={emp.id} 
                    position={[emp.current_lat, emp.current_lng]}
                    icon={isActive ? activeEmployeeIcon : employeeIcon}
                  >
                    <Popup className="rounded-lg">
                      <div className="font-sans">
                        <div className="font-bold text-base mb-1">{emp.name}</div>
                        <div className="text-sm text-muted-foreground mb-2">{emp.role}</div>
                        <div className="text-xs flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3 h-3" />
                          Updated {formatDistanceToNow(new Date(emp.last_location_update), { addSuffix: true })}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </Card>

        {/* Right Side: Employee List */}
        <Card className="h-full border-border/50 shadow-sm flex flex-col">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              Field Team Status
            </h3>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {employees.length === 0 && !loading && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <MapPin className="w-8 h-8 mx-auto mb-3 opacity-20" />
                No employees are currently sharing their location.
              </div>
            )}

            {employees.map(emp => {
              const lastUpdate = new Date(emp.last_location_update);
              const isActive = (new Date().getTime() - lastUpdate.getTime()) < 15 * 60 * 1000;

              return (
                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {getInitials(emp.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{emp.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LiveTracking;
