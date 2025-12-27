import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Trophy,
  Compass,
  Crown,
  Zap,
  Settings,
  RotateCcw,
  Play,
  Pause,
  Navigation2,
  Search,
  MapPin,
  Activity,
  Flame,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

// --- Constants ---
const METERS_PER_STEP = 0.75;
const WALKING_SPEED_KMH = 5.0;

export default function FocusTacticalMap() {
  const [speedKmh, setSpeedKmh] = useState(WALKING_SPEED_KMH);
  // Add this state to handle the input text
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(15);

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
  };

  const {
    points,
    route,
    currentPos,
    isActive,
    setIsActive,
    progress,
    metrics,
    handleMapClick,
    searchLocation, // Pull this from the hook we fixed earlier
    isLoadingRoute, // Pull this for the button loading state
    reset,
  } = useRouteLogic(speedKmh);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0A0A0A] font-sans text-white">
      {/* 1. TOP STATUS HUD */}
      <div className="absolute top-6 left-0 w-full z-[2000] px-6 flex justify-between items-start pointer-events-none">
        <motion.div
          animate={{ y: isActive ? -10 : 0, opacity: isActive ? 0.7 : 1 }}
          className="flex items-center gap-4 bg-[#141414] border border-white/10 p-2 pr-6 rounded-2xl pointer-events-auto shadow-2xl"
        >
          <div className="w-12 h-12 bg-[#BFFF04] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(191,255,4,0.3)]">
            <User className="text-black w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                Operator
              </span>
              <span className="text-[#BFFF04] text-[10px] font-black">
                LVL 05
              </span>
            </div>
            <div className="text-lg font-black leading-none">Ghost_Walker</div>
          </div>
        </motion.div>

        <div className="flex flex-col gap-2">
          <Button className="w-12 h-12 rounded-xl bg-[#141414] border border-white/10 p-0 pointer-events-auto hover:bg-[#1A1A1A]">
            <Settings className="w-5 h-5 text-white" />
          </Button>
          <Button className="w-12 h-12 rounded-xl bg-[#141414] border border-white/10 p-0 pointer-events-auto hover:bg-[#1A1A1A]">
            <Flame className="w-5 h-5 text-orange-500" />
          </Button>
        </div>
      </div>

      {/* 2. MINIMALIST DARK MAP */}
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={zoomLevel}
        className="w-full h-full z-0 bg-[#0A0A0A]"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        <MapController
          onMapClick={handleMapClick}
          pos={currentPos}
          isActive={isActive}
          points={points}
        />

        {route && (
          <>
            <Polyline
              positions={route.path}
              pathOptions={{
                color: "#BFFF04",
                weight: 4,
                opacity: 1,
                lineCap: "round",
              }}
            />
            <Polyline
              positions={route.path}
              pathOptions={{
                color: "#BFFF04",
                weight: 12,
                opacity: 0.15,
                lineCap: "round",
              }}
            />
          </>
        )}

        {currentPos && (
          <Marker
            position={currentPos}
            icon={L.divIcon({
              className: "custom-marker",
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="absolute w-8 h-8 bg-[#BFFF04]/20 rounded-full animate-pulse"></div>
                  <div class="w-4 h-4 bg-[#BFFF04] rounded-full border-2 border-[#0A0A0A] shadow-[0_0_15px_#BFFF04]"></div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            })}
          />
        )}
      </MapContainer>

      {/* 3. SEARCH BAR (Functional Fix) */}
      {!isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-28 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md"
        >
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-1 flex items-center gap-2 shadow-2xl focus-within:border-[#BFFF04]/50 transition-colors">
            <div className="pl-4 text-white/30">
              <Search size={18} />
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim() !== "") {
                  searchLocation(searchQuery);
                  setSearchQuery("");
                }
              }}
              placeholder={
                !points.start
                  ? "Search starting point..."
                  : "Search destination..."
              }
              className="bg-transparent border-none outline-none text-sm w-full py-3 font-medium text-white placeholder:text-white/20"
            />
            <Button
              onClick={() => {
                if (searchQuery.trim() !== "") {
                  searchLocation(searchQuery);
                  setSearchQuery("");
                }
              }}
              disabled={isLoadingRoute}
              size="sm"
              className="bg-[#BFFF04] text-black font-bold rounded-xl mr-1 hover:bg-[#d4ff4d] min-w-[50px]"
            >
              {isLoadingRoute ? "..." : "GO"}
            </Button>
          </div>

          <div className="mt-2 flex justify-center">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">
              {points.start
                ? "Step 2: Set Destination"
                : "Step 1: Set Start Point"}
            </span>
          </div>
        </motion.div>
      )}

      {/* 4. TACTICAL HUD BOTTOM CARD */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2000] w-[92%] max-w-md">
        <Card className="bg-[#141414] border border-white/10 rounded-[32px] p-6 shadow-2xl">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatItem
              icon={<Navigation2 size={14} />}
              label="DIST"
              value={`${(metrics.distDone / 1000).toFixed(2)}km`}
            />
            <StatItem
              icon={<Activity size={14} />}
              label="STEPS"
              value={metrics.steps.toLocaleString()}
            />
            <StatItem
              icon={<Zap size={14} />}
              label="XP"
              value={`+${Math.floor(progress * 500)}`}
            />
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2">
                Estimated Arrival
              </div>
              <div className="text-6xl font-black tracking-tighter tabular-nums text-white">
                {formatPreciseTime(metrics.timeLeft)}
              </div>
            </div>

            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#BFFF04]"
                animate={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => {
                  setIsActive(!isActive);
                  handleZoomChange(isActive ? 4 : 15);
                }}
                disabled={!route}
                className={`h-16 flex-3 rounded-2xl text-lg font-black transition-all ${
                  isActive
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-[#BFFF04] text-black hover:bg-[#d4ff4d]"
                }`}
              >
                {isActive ? (
                  <Pause className="mr-2 fill-current" />
                ) : (
                  <Play className="mr-2 fill-current" />
                )}
                {isActive ? "PAUSE SESSION" : "INITIATE FOCUS"}
              </Button>
              <Button
                onClick={reset}
                className="h-16 flex-1 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <RotateCcw className="text-white" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function StatItem({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-[#BFFF04] mb-1 opacity-80">
        {icon}
        <span className="text-[9px] font-black tracking-widest uppercase">
          {label}
        </span>
      </div>
      <div className="text-sm font-black text-white">{value}</div>
    </div>
  );
}

// --- Logic Hook ---

export function useRouteLogic(speedKmh: number) {
  const [points, setPoints] = useState<{
    start: L.LatLng | null;
    end: L.LatLng | null;
  }>({
    start: null,
    end: null,
  });
  const [route, setRoute] = useState<any>(null);
  const [currentPos, setCurrentPos] = useState<L.LatLng | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [metrics, setMetrics] = useState({
    steps: 0,
    timeLeft: 0,
    distDone: 0,
  });

  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const progressRef = useRef(0);
  const speedMs = (speedKmh * 1000) / 3600;

  // 1. Unified Route Fetching Function
  const fetchRoute = React.useCallback(
    async (start: L.LatLng, end: L.LatLng) => {
      setIsLoadingRoute(true);
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.code !== "Ok") return;

        const r = data.routes[0];
        const routeData = {
          path: r.geometry.coordinates.map((c: any) => [c[1], c[0]]), // To LatLng
          line: turf.lineString(r.geometry.coordinates), // To GeoJSON
          distance: r.distance,
          duration: r.distance / speedMs,
        };

        setRoute(routeData);
        setMetrics({
          steps: 0,
          timeLeft: Math.ceil(r.distance / speedMs),
          distDone: 0,
        });
      } catch (err) {
        console.error("Routing error:", err);
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [speedMs]
  );

  // 2. Handle Map Clicks
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (isActive) return;

    if (!points.start) {
      setPoints({ ...points, start: e.latlng });
      setCurrentPos(e.latlng);
    } else if (!points.end) {
      setPoints({ ...points, end: e.latlng });
      fetchRoute(points.start, e.latlng);
    }
  };

  // 3. Search Logic
  const searchLocation = async (query: string) => {
    if (!query || isActive) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`
      );
      const data = await res.json();
      if (data?.length > 0) {
        const newLoc = new L.LatLng(
          parseFloat(data[0].lat),
          parseFloat(data[0].lon)
        );
        if (!points.start) {
          setPoints((p) => ({ ...p, start: newLoc }));
          setCurrentPos(newLoc);
        } else {
          setPoints((p) => ({ ...p, end: newLoc }));
          fetchRoute(points.start!, newLoc);
        }
        return newLoc;
      }
    } catch (e) {
      console.error("Search error", e);
    }
  };

  // 4. Animation Loop
  useEffect(() => {
    if (!isActive || !route) return;

    const frame = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Update progress
      progressRef.current = Math.min(
        progressRef.current + (delta * speedMs) / route.distance,
        1
      );
      const dDone = progressRef.current * route.distance;

      // Calculate current position along the line
      const pt = turf.along(route.line, dDone / 1000, { units: "kilometers" });
      const [lng, lat] = pt.geometry.coordinates;

      setCurrentPos(new L.LatLng(lat, lng));
      setProgress(progressRef.current);
      setMetrics({
        steps: Math.floor(dDone / METERS_PER_STEP),
        timeLeft: Math.ceil(route.duration * (1 - progressRef.current)),
        distDone: dDone,
      });

      if (progressRef.current < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        setIsActive(false);
        confetti();
      }
    };

    animRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
    };
  }, [isActive, route, speedMs]);

  // 5. Reset Logic
  const reset = () => {
    setPoints({ start: null, end: null });
    setRoute(null);
    setCurrentPos(null);
    setIsActive(false);
    setProgress(0);
    progressRef.current = 0;
    lastTimeRef.current = 0;
    setMetrics({ steps: 0, timeLeft: 0, distDone: 0 });
  };

  const userLocation = useUserLocation();

  // Inside useRouteLogic or your main component
  useEffect(() => {
    if (userLocation && !points.start) {
      setPoints((p) => ({ ...p, start: userLocation }));
      setCurrentPos(userLocation);
    }
  }, [userLocation]);

  return {
    points,
    route,
    currentPos,
    isActive,
    setIsActive,
    progress,
    metrics,
    handleMapClick,
    searchLocation,
    reset,
    isLoadingRoute,
  };
}

function formatPreciseTime(s: number) {
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}:${rs < 10 ? "0" : ""}${rs}`;
}

function MapController({ pos, isActive, onMapClick, points }: any) {
  const map = useMap();

  // Force map to update size on load
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);

  // Handle Map Clicks
  useMapEvents({
    click: (e) => {
      if (!isActive) onMapClick(e);
    },
  });

  // Auto-pan when searching or moving
  useEffect(() => {
    if (!isActive && points.start) {
      map.flyTo(points.start, 15, { animate: true, duration: 0.3 });
    }
  }, [isActive, points, map]);

  return null;
}

// Delhi Coordinates
const DELHI_DEFAULT = { lat: 28.6139, lng: 77.209 };

export function useUserLocation() {
  // Initialize with Delhi so the map has a valid starting point immediately
  const [location, setLocation] = useState<L.LatLng>(
    new L.LatLng(DELHI_DEFAULT.lat, DELHI_DEFAULT.lng)
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported. Defaulting to Delhi.");
      return;
    }

    const success = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      console.log(`User location: ${latitude}, ${longitude}`);
      setLocation(new L.LatLng(latitude, longitude));
    };

    const error = (err: GeolocationPositionError) => {
      // If user denies permission or GPS fails, we stay at Delhi
      console.warn(
        `Geolocation error (${err.code}): ${err.message}. Staying at Delhi.`
      );
    };

    const watcher = navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 5000,
    });

    return () => {
      navigator.geolocation.clearWatch(watcher);
    };
  }, []);

  return location;
}
