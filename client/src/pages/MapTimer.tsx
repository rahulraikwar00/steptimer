import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css"; // Re-uses
import "leaflet-defaulticon-compatibility";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import {
  Settings,
  RotateCcw,
  Play,
  Pause,
  MapPin,
  Search,
  X,
  Navigation2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const METERS_PER_STEP = 0.75;
const WALKING_SPEED_KMH = 5.0;

// #####################################################
// # 1. CUSTOM HOOK: useRouteLogic
// #####################################################

function useRouteLogic(speedKmh: number) {
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
  const speedMs = useMemo(() => (speedKmh * 1000) / 3600, [speedKmh]);

  useEffect(() => {
    if (route && !isActive) {
      const duration = route.distance / speedMs;
      setMetrics((prev) => ({
        ...prev,
        timeLeft: Math.ceil(duration * (1 - progressRef.current)),
      }));
    }
  }, [speedKmh, route, isActive, speedMs]);

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

  const fetchRoute = async (start: L.LatLng, end: L.LatLng) => {
    setIsLoadingRoute(true);
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code !== "Ok") throw new Error("Route not found");
      const r = data.routes[0];

      const newRoute = {
        path: r.geometry.coordinates.map((c: any) => ({
          lat: c[1],
          lng: c[0],
        })),
        line: turf.lineString(r.geometry.coordinates),
        distance: r.distance,
        duration: r.distance / speedMs,
      };

      setRoute(newRoute);
      setMetrics({
        steps: Math.floor(r.distance / METERS_PER_STEP),
        timeLeft: Math.ceil(r.distance / speedMs),
        distDone: 0,
      });
    } catch (err) {
      console.error(err);
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
        confetti();
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
    setPoints,
    fetchRoute,
  };
}

// #####################################################
// # 2. HELPER COMPONENTS
// #####################################################

function MapController({ pos, isActive, onMapClick, isLocked }: any) {
  const map = useMap();
  useEffect(() => {
    const handleFlyTo = (e: any) =>
      map.flyTo(e.detail, 14, { animate: true, duration: 1.5 });
    window.addEventListener("map-fly-to", handleFlyTo);
    return () => window.removeEventListener("map-fly-to", handleFlyTo);
  }, [map]);

  useEffect(() => {
    if (pos && isActive) map.panTo(pos, { animate: true, duration: 0.5 });
  }, [pos, isActive, map]);

  useMapEvents({ click: (e) => !isLocked && onMapClick(e) });
  return null;
}
function SettingsDropdown({ isOpen, speed, setSpeed, route, metrics }: any) {
  if (!isOpen) return null;
  return (
    /* Key Changes: 
       - Changed 'top-[calc(100%+12px)]' to 'bottom-[calc(100%+12px)]'
       - Changed 'slide-in-from-top-4' to 'slide-in-from-bottom-4'
       - Changed 'origin-top' to 'origin-bottom'
    */
    <div className="absolute bottom-[calc(100%+12px)] left-0 w-full bg-white/90 backdrop-blur-2xl rounded-4xl shadow-2xl border border-white/50 p-6 animate-in fade-in slide-in-from-bottom-4 duration-300 origin-bottom z-3000">
      <div className="space-y-6">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          Mission Parameters
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
              Total Dist
            </p>
            <p className="text-lg font-bold text-slate-900 leading-none">
              {route ? `${(route.distance / 1000).toFixed(2)} km` : "0.00 km"}
            </p>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
              Est. Steps
            </p>
            <p className="text-lg font-bold text-slate-900 leading-none">
              {metrics.steps.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm font-bold text-slate-700">
            <label>Walking Speed</label>
            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs">
              {speed} km/h
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
}

// #####################################################
// # 3. MAIN COMPONENT
// #####################################################

export default function MapTimer() {
  const [speedKmh, setSpeedKmh] = useState(WALKING_SPEED_KMH);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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
    fetchRoute,
    setPoints,
  } = useRouteLogic(speedKmh);

  const formatPreciseTime = (totalSeconds: number) => {
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m ${s}s`;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const coords = new L.LatLng(
          parseFloat(data[0].lat),
          parseFloat(data[0].lon)
        );
        window.dispatchEvent(new CustomEvent("map-fly-to", { detail: coords }));
        if (!points.start) setPoints({ ...points, start: coords });
        else if (!points.end) {
          setPoints({ ...points, end: coords });
          fetchRoute(points.start, coords);
        }
        setSearchQuery("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-100 flex flex-col">
      <div className="relative w-full h-screen bg-slate-100 overflow-hidden">
        {/* Search Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-2000 w-[90%] max-w-sm">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <input
              type="text"
              placeholder={
                !points.start
                  ? "Search Start Location..."
                  : "Search Destination..."
              }
              className="w-full h-14 pl-12 pr-12 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl focus:outline-none text-slate-800 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        {/* Map Layer */}
        <MapContainer
          center={[20, 78]}
          zoom={5}
          className="w-full h-full z-0"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapController
            onMapClick={handleMapClick}
            pos={currentPos}
            isActive={isActive}
            isLocked={isActive || isLoadingRoute}
          />
          {route && (
            <Polyline
              positions={route.path}
              color="#007AFF"
              weight={6}
              opacity={0.6}
            />
          )}
          {currentPos && (
            <CircleMarker
              center={currentPos}
              radius={8}
              pathOptions={{
                fillColor: "#007AFF",
                color: "#fff",
                fillOpacity: 1,
                weight: 3,
              }}
            />
          )}
          {points.start && <Marker position={points.start} />}
          {points.end && <Marker position={points.end} />}
        </MapContainer>

        {/* HUD UI */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-1000 w-[90%] max-w-sm flex flex-col gap-3">
          <Card className="p-6 bg-white/80 backdrop-blur-2xl border-none shadow-2xl rounded-4xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Time Remaining
                </p>
                <h2 className="text-4xl font-bold text-slate-900 leading-none">
                  {formatPreciseTime(metrics.timeLeft)}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Navigation2 className="w-5 h-5 text-blue-600 fill-current" />
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200/50 p-0.5">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-700"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-800">
              <span>{metrics.steps.toLocaleString()} Steps</span>
              <span>{(metrics.distDone / 1000).toFixed(2)} km</span>
            </div>
          </Card>

          <div className="relative flex gap-2 bg-white/70 backdrop-blur-xl p-2 rounded-4xl shadow-xl border border-white/40">
            <Button
              className={`flex-1 h-14 mx-1 rounded-2xl font-bold ${
                isActive ? "bg-red-50 text-red-600" : "bg-blue-600 text-white"
              }`}
              onClick={() => setIsActive(!isActive)}
              disabled={!route || isLoadingRoute}
            >
              {isActive ? (
                <Pause className="mr-2" />
              ) : (
                <Play className="mr-2" />
              )}
              {isActive ? "Pause" : "Start"}
            </Button>
            <Button
              variant="outline"
              className={`h-14 w-14 rounded-3xl transition-all duration-300 border-white/50 shadow-sm ${
                isSettingsOpen
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-200"
                  : "bg-white/70 backdrop-blur-md text-slate-700 hover:bg-white hover:text-blue-600"
              }`}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <Settings
                className={`w-6 h-6 transition-transform duration-500 ${
                  isSettingsOpen ? "rotate-90" : "rotate-0"
                }`}
              />
            </Button>

            <Button
              variant="outline"
              className="h-14 w-14 rounded-3xl bg-white/70 backdrop-blur-md border-white/50 text-slate-700 shadow-sm hover:bg-white hover:text-red-500 hover:border-red-100 transition-all active:scale-90"
              onClick={reset}
            >
              <RotateCcw className="w-6 h-6" />
            </Button>
            <SettingsDropdown
              isOpen={isSettingsOpen}
              speed={speedKmh}
              setSpeed={setSpeedKmh}
              route={route}
              metrics={metrics}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
