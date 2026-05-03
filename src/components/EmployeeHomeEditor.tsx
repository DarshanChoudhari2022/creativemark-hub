import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, MapPin, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Parse a pasted Google Maps URL or raw "lat,lng" into { lat, lng }.
// Handles the common shapes:
//   https://maps.google.com/?q=18.5204,73.8567
//   https://www.google.com/maps/place/Foo/@18.5204,73.8567,17z
//   https://maps.app.goo.gl/xxxx  (we can't resolve short links client-side)
//   18.5204,73.8567
function parseLatLng(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const raw = input.trim();

  // Plain "lat,lng"
  const plain = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) {
    const lat = parseFloat(plain[1]);
    const lng = parseFloat(plain[2]);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }

  // Google Maps @lat,lng zoom pattern
  const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

  // ?q=lat,lng or &q=lat,lng
  const q = raw.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

  // !3dLAT!4dLNG (maps place URLs)
  const place = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) return { lat: parseFloat(place[1]), lng: parseFloat(place[2]) };

  return null;
}

interface Props {
  employeeId: string;
  homeLat: number | null;
  homeLng: number | null;
  homeRadiusM: number | null;
  onSaved?: () => void;
}

export function EmployeeHomeEditor({ employeeId, homeLat, homeLng, homeRadiusM, onSaved }: Props) {
  const [lat, setLat] = useState<string>(homeLat != null ? String(homeLat) : "");
  const [lng, setLng] = useState<string>(homeLng != null ? String(homeLng) : "");
  const [radius, setRadius] = useState<string>(String(homeRadiusM || 250));
  const [pasteUrl, setPasteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const isSet = homeLat != null && homeLng != null;

  const applyPaste = () => {
    const parsed = parseLatLng(pasteUrl);
    if (!parsed) {
      toast.error("Could not read coordinates. Paste a Google Maps URL or 'lat,lng'.");
      return;
    }
    setLat(String(parsed.lat));
    setLng(String(parsed.lng));
    setPasteUrl("");
    toast.success("Coordinates filled — click Save to persist.");
  };

  const save = async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseInt(radius, 10) || 250;
    if (!isFinite(latNum) || !isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      toast.error("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("employees")
      .update({ home_lat: latNum, home_lng: lngNum, home_radius_m: radiusNum })
      .eq("id", employeeId);
    setSaving(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success("Home location saved");
    setOpen(false);
    onSaved?.();
  };

  const clear = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("employees")
      .update({ home_lat: null, home_lng: null })
      .eq("id", employeeId);
    setSaving(false);
    if (error) {
      toast.error("Clear failed: " + error.message);
      return;
    }
    setLat(""); setLng("");
    toast.success("Home location cleared");
    onSaved?.();
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Home className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">Registered Home</div>
            {isSet ? (
              <div className="text-[11px] text-muted-foreground truncate">
                {homeLat!.toFixed(5)}, {homeLng!.toFixed(5)} · radius {homeRadiusM || 250}m
              </div>
            ) : (
              <div className="text-[11px] text-amber-700">
                Not set — near-home detection disabled.
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isSet && (
            <a
              href={`https://www.google.com/maps?q=${homeLat},${homeLng}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" /> View
            </a>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(o => !o)}>
            {open ? "Close" : isSet ? "Edit" : "Set"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div>
            <Label className="text-[11px]">Paste a Google Maps URL or "lat,lng"</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=18.5204,73.8567  or  18.5204,73.8567"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyPaste} disabled={!pasteUrl}>
                Parse
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px]">Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} className="h-8 text-xs" placeholder="18.5204" />
            </div>
            <div>
              <Label className="text-[11px]">Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} className="h-8 text-xs" placeholder="73.8567" />
            </div>
            <div>
              <Label className="text-[11px]">Radius (m)</Label>
              <Input value={radius} onChange={(e) => setRadius(e.target.value)} className="h-8 text-xs" inputMode="numeric" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            {isSet && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={clear} disabled={saving}>
                Clear
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving}>
              <Save className="w-3 h-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Tip: on Google Maps (desktop), right-click the employee's house → the first
            menu item is the lat/lng. Click it to copy and paste above.
          </div>
        </div>
      )}
    </div>
  );
}
