import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Settings,
  RotateCcw,
  Play,
  Pause,
  MapPin,
  Zap,
  Navigation,
  Gauge,
  Settings2,
  Activity,
  Info,
  Ruler,
} from "lucide-react";

// UI Components (Shadcn UI patterns)
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

const METERS_PER_STEP = 0.75;

// #####################################################
// # 1. CUSTOM HOOK: useRouteLogic
// #####################################################

function useRouteLogic(speedKmh: number) {
  const [points, setPoints] = useState<{
    start: L.LatLng | null;
    end: L.LatLng | null;
  }>({ start: null, end: null });
  const [route, setRoute] = useState<any>(null);
  const [currentPos, setCurrentPos] = useState<L.LatLng | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    steps: 0,
    timeLeft: 0,
    distDone: 0,
  });

  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const progressRef = useRef(0);
  const speedMs = useMemo(() => (speedKmh * 1000) / 3600, [speedKmh]);

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (!points.start) {
      setPoints({ ...points, start: e.latlng });
      setCurrentPos(e.latlng);
    } else if (!points.end) {
      setPoints({ ...points, end: e.latlng });
      fetchRoute(points.start, e.latlng);
    }
  };

  const fetchRoute = async (start: L.LatLng, end: L.LatLng) => {
    setIsLoadingRoute(true);
    setRouteError(null);
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code !== "Ok") throw new Error("Route not found");
      const r = data.routes[0];
      setRoute({
        path: r.geometry.coordinates.map((c: any) => ({
          lat: c[1],
          lng: c[0],
        })),
        line: turf.lineString(r.geometry.coordinates),
        distance: r.distance,
        duration: r.distance / speedMs,
      });
    } catch (err: any) {
      setRouteError(err.message);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (!isActive || !route) return;
    const frame = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      const move = delta * speedMs;
      progressRef.current = Math.min(
        progressRef.current + move / route.distance,
        1
      );
      const p = progressRef.current;
      const dDone = p * route.distance;
      const pt = turf.along(route.line, dDone / 1000, { units: "kilometers" });
      const [lng, lat] = pt.geometry.coordinates;
      setCurrentPos(new L.LatLng(lat, lng));
      setProgress(p);
      setMetrics({
        steps: Math.floor(dDone / METERS_PER_STEP),
        timeLeft: Math.ceil(route.duration * (1 - p)),
        distDone: dDone,
      });
      if (p < 1) animRef.current = requestAnimationFrame(frame);
      else {
        setIsActive(false);
        confetti({ particleCount: 100, colors: ["#fbbf24", "#ffffff"] });
      }
    };
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current!);
  }, [isActive, route, speedMs]);

  const reset = () => {
    setIsActive(false);
    setPoints({ start: null, end: null });
    setRoute(null);
    setCurrentPos(null);
    progressRef.current = 0;
    setProgress(0);
    setMetrics({ steps: 0, timeLeft: 0, distDone: 0 });
    lastTimeRef.current = 0;
  };

  return {
    points,
    route,
    currentPos,
    isActive,
    setIsActive,
    progress,
    metrics,
    handleMapClick,
    reset,
    isLoadingRoute,
    routeError,
  };
}

// #####################################################
// # 2. COMPONENT: MapController (Headless)
// #####################################################

function MapController({ pos, isActive, onMapClick, isLocked }: any) {
  const map = useMap();
  useEffect(() => {
    if (pos && isActive) map.panTo(pos, { animate: true, duration: 0.5 });
  }, [pos, isActive, map]);
  useMapEvents({ click: (e) => !isLocked && onMapClick(e) });
  return null;
}

// #####################################################
// # 3. COMPONENT: StatsHUD
// #####################################################

function StatsHUD({ metrics, progress }: { metrics: any; progress: number }) {
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  return (
    <Card className="p-6 bg-white/95 backdrop-blur-xl border-none shadow-2xl rounded-4xl">
      <div className="flex justify-between items-end mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-800/40 mb-1">
            Remaining
          </p>
          <h2 className="text-4xl font-black tabular-nums text-orange-950 tracking-tighter">
            {formatTime(metrics.timeLeft)}
          </h2>
        </div>
        <span className="px-3 py-1 bg-yellow-400/20 text-yellow-700 text-[10px] font-black rounded-full border border-yellow-200">
          {(progress * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 w-full bg-orange-100 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </Card>
  );
}

// #####################################################
// # 4. COMPONENT: TimerControls
// #####################################################

function TimerControls({ isActive, onToggle, onReset, disabled }: any) {
  return (
    <div className="flex flex-1 gap-3">
      <Button
        className="flex-1 h-14 bg-yellow-400 hover:bg-yellow-500 text-orange-950 font-black rounded-2xl shadow-lg shadow-yellow-100"
        onClick={onToggle}
        disabled={disabled}
      >
        {isActive ? (
          <Pause className="mr-2 fill-current" />
        ) : (
          <Play className="mr-2 fill-current" />
        )}
        {isActive ? "PAUSE" : "START"}
      </Button>
      <Button
        variant="outline"
        className="h-14 w-14 rounded-2xl border-orange-100 bg-white"
        onClick={onReset}
      >
        <RotateCcw className="text-orange-800" />
      </Button>
    </div>
  );
}

// #####################################################
// # 5. COMPONENT: SettingsPanel
// #####################################################

function SettingsPanel({
  startPos,
  endPos,
  distanceText,
  totalDuration,
  steps,
  progress,
  routeData,
  WALKING_SPEED_KMH,
}: any) {
  return (
    <DialogContent className="sm:max-w-[425px] bg-white border-none rounded-4xl shadow-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-2xl font-black text-orange-950">
          <Settings2 className="text-yellow-500" />
          Mission Details
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-orange-50 rounded-2xl">
            <p className="text-[10px] font-bold text-orange-800/40 uppercase">
              Steps
            </p>
            <p className="text-xl text-orange-950 bg-orange-50 font-black">
              {steps.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-yellow-400 rounded-2xl">
            <p className="text-[10px] font-bold text-yellow-950 uppercase">
              Progress
            </p>
            <p className="text-xl  text-orange-950 font-black">
              {(progress * 100).toFixed(1)}%
            </p>
          </div>
        </div>
        <Separator className="bg-orange-100" />
        <div className="space-y-2">
          <p className="text-[10px] font-black text-orange-800/40 uppercase tracking-widest">
            Navigation
          </p>
          <div className="text-sm font-bold text-orange-950 bg-orange-50 p-3 rounded-xl flex justify-between">
            <span>Distance</span>
            <span>{distanceText}</span>
          </div>
          <div className="text-sm font-bold text-orange-950 bg-orange-50 p-3 rounded-xl flex justify-between">
            <span>Pace</span>
            <span>{WALKING_SPEED_KMH} km/h</span>
          </div>
        </div>
      </div>

      {/* set waking speed settings */}
      <div className="p-4 border-t border-orange-100">
        <label className="block text-[10px] font-black text-orange-800/40 uppercase tracking-widest mb-2">
          Walking Speed (km/h)
        </label>
        <input
          type="number"
          min={1}
          max={20}
          step={0.1}
          value={WALKING_SPEED_KMH}
          readOnly
          className="w-full p-3 rounded-xl border border-orange-100 bg-orange-50 text-orange-950 font-bold"
        />
      </div>
    </DialogContent>
  );
}

// #####################################################
// # 6. MAIN APPLICATION: MapTimer
// #####################################################

const WALKING_SPEED_KMH = 5000.0;

export default function MapTimer() {
  const [speedKmh, setSpeedKmh] = useState(WALKING_SPEED_KMH);
  const {
    points,
    route,
    currentPos,
    isActive,
    setIsActive,
    progress,
    metrics,
    handleMapClick,
    reset,
    isLoadingRoute,
    routeError,
  } = useRouteLogic(speedKmh);

  return (
    <div className="relative w-full h-screen bg-orange-50 overflow-hidden">
      <MapContainer
        center={[20, 78]}
        zoom={8}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <MapController
          onMapClick={handleMapClick}
          pos={currentPos}
          isActive={isActive}
          isLocked={!!route || isLoadingRoute}
        />
        {route && (
          <Polyline
            positions={route.path}
            color="#f59e0b"
            weight={5}
            opacity={0.3}
          />
        )}
        {currentPos && (
          <CircleMarker
            center={currentPos}
            radius={10}
            pathOptions={{
              fillColor: "#fbbf24",
              color: "#92400e",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
        {points.start && <Marker position={points.start} />}
        {points.end && <Marker position={points.end} />}
      </MapContainer>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-5000 w-[92%] max-w-md pointer-events-auto flex flex-col gap-4">
        <StatsHUD metrics={metrics} progress={progress} />
        <div className="flex gap-3 bg-white/90 backdrop-blur-xl p-4 rounded-4xl shadow-xl border border-orange-100/50">
          <TimerControls
            isActive={isActive}
            onToggle={() => setIsActive(!isActive)}
            onReset={reset}
            disabled={!route || isLoadingRoute}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-14 w-14 rounded-2xl bg-white border-orange-100"
              >
                <Settings className="text-orange-800" />
              </Button>
            </DialogTrigger>
            <SettingsPanel
              startPos={points.start}
              endPos={points.end}
              distanceText={
                route ? `${(route.distance / 1000).toFixed(2)} km` : "0.00 km"
              }
              totalDuration={route?.duration || 0}
              steps={metrics.steps}
              progress={progress}
              routeData={route}
              METERS_PER_STEP={METERS_PER_STEP}
              WALKING_SPEED_KMH={speedKmh}
            />
          </Dialog>
        </div>
      </div>

      {!points.start && !isLoadingRoute && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-5000 bg-orange-950 text-white px-8 py-4 rounded-3xl font-black shadow-2xl animate-bounce flex items-center gap-2">
          <MapPin className="w-5 h-5 text-yellow-400" /> TAP TO START
        </div>
      )}
    </div>
  );
}
