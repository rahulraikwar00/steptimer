import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  CircleMarker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

import TimerControls from "@/components/TimerControls";
import RouteStatus from "@/components/RouteStatus";
import SettingsPanel from "@/components/SettingsPanel";

// Fix Leaflet marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Types
type LatLng = { lat: number; lng: number };
type RouteData = {
  path: LatLng[];
  line: any;
  distance: number; // in meters
  duration: number; // in seconds
};

function MapEvents({
  onMapClick,
}: {
  onMapClick: (e: L.LeafletMouseEvent) => void;
}) {
  useMapEvents({
    click: onMapClick,
  });
  return null;
}

export default function MapTimer() {
  const [startPos, setStartPos] = useState<LatLng | null>(null);
  const [endPos, setEndPos] = useState<LatLng | null>(null);
  const [currentPos, setCurrentPos] = useState<LatLng | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);

  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 1

  const [isSettingStart, setIsSettingStart] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs for movement logic
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Constants
  const WALKING_SPEED_KMH = 5; // 5 km/h walking speed
  const WALKING_SPEED_MS = React.useMemo(
    () => (WALKING_SPEED_KMH * 1000) / 3600,
    []
  );
  const METERS_PER_STEP = 0.75; // Average step length in meters

  const fetchRoute = async (start: LatLng, end: LatLng) => {
    console.log("🛣️ Fetching route from", start, "to", end);
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      console.log("📍 OSRM URL:", url);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout after 2 seconds")), 2000);
      });

      const response = (await Promise.race([
        fetch(url, {
          headers: { Accept: "application/json" },
          mode: "cors",
        }),
        timeoutPromise,
      ])) as Response;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("📊 OSRM Response:", data);

      if (data.code !== "Ok") {
        throw new Error(data.message || "Route calculation failed");
      }

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceMeters = route.distance;
        const distanceKm = distanceMeters / 1000;

        const estimatedDurationSeconds = Math.ceil(
          (distanceKm / WALKING_SPEED_KMH) * 3600
        );
        const estimatedSteps = Math.floor(distanceMeters / METERS_PER_STEP);

        const coordinates = route.geometry.coordinates;

        console.log(
          `✅ Route found: ${distanceKm.toFixed(2)} km, ` +
            `Estimated: ${Math.floor(estimatedDurationSeconds / 60)} min ${
              estimatedDurationSeconds % 60
            } sec, ` +
            `~${estimatedSteps.toLocaleString()} steps`
        );

        const path = coordinates.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        const line = turf.lineString(coordinates);

        const routeData: RouteData = {
          path,
          line,
          distance: distanceMeters,
          duration: estimatedDurationSeconds,
        };

        setRouteData(routeData);
        setRoutePath(path);
        setTotalDuration(estimatedDurationSeconds);
        setTimeLeft(estimatedDurationSeconds);
        setCurrentPos(start);
        setSteps(0);
        setProgress(0);

        return routeData;
      } else {
        throw new Error("No routes found");
      }
    } catch (error: any) {
      console.error("❌ Route fetch error:", error.message);

      console.log("⚠️ Fallback to straight line routing (timeout or error)");
      const straightLine = [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ];
      const path = [
        { lat: start.lat, lng: start.lng },
        { lat: end.lat, lng: end.lng },
      ];
      const line = turf.lineString(straightLine);

      const distanceMeters = turf.length(line, { units: "meters" });
      const distanceKm = distanceMeters / 1000;
      const estimatedDurationSeconds = Math.ceil(
        (distanceKm / WALKING_SPEED_KMH) * 3600
      );

      const routeData: RouteData = {
        path,
        line,
        distance: distanceMeters,
        duration: estimatedDurationSeconds,
      };

      setRouteData(routeData);
      setRoutePath(path);
      setTotalDuration(estimatedDurationSeconds);
      setTimeLeft(estimatedDurationSeconds);
      setCurrentPos(start);
      setSteps(0);
      setProgress(0);

      if (error.message.includes("Timeout")) {
        setRouteError("Using straight line (OSRM was slow)");
      } else {
        setRouteError("Using straight line estimate");
      }

      return routeData;
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Handle Map Clicks
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (isActive) return;

    console.log("📌 Map clicked at:", e.latlng);

    if (isSettingStart) {
      setStartPos(e.latlng);
      setCurrentPos(e.latlng);
      setEndPos(null);
      setRouteData(null);
      setRoutePath([]);
      setTotalDuration(0);
      setTimeLeft(0);
      setRouteError(null);
      setSteps(0);
      setProgress(0);
      setIsSettingStart(false);
      console.log("✓ Start point set");
    } else {
      const start = startPos;
      if (start) {
        setEndPos(e.latlng);
        console.log("✓ End point set, fetching route...");
        await fetchRoute(start, e.latlng);
      }
    }
  };

  // Smooth movement animation
  useEffect(() => {
    if (!isActive || !routeData || timeLeft <= 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000; // in seconds
      lastUpdateRef.current = now;

      if (deltaTime <= 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const distanceTraveled = WALKING_SPEED_MS * deltaTime;
      const totalDistance = routeData.distance;
      const newProgress = Math.min(
        progress + distanceTraveled / totalDistance,
        1
      );

      const distanceTraveledMeters = newProgress * totalDistance;
      const newSteps = Math.floor(distanceTraveledMeters / METERS_PER_STEP);

      if (routeData.line && newProgress < 1) {
        const targetDistance = totalDistance * newProgress;
        const point = turf.along(routeData.line, targetDistance / 1000, {
          units: "kilometers",
        });
        const [lng, lat] = point.geometry.coordinates;
        setCurrentPos({ lat, lng });
      } else if (newProgress >= 1 && endPos) {
        setCurrentPos(endPos);
      }

      const elapsedTime = newProgress * routeData.duration;
      const newTimeLeft = Math.max(0, routeData.duration - elapsedTime);

      setProgress(newProgress);
      setSteps(newSteps);
      setTimeLeft(Math.round(newTimeLeft));

      if (newProgress >= 1) {
        setIsActive(false);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
        });
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, routeData, endPos, progress]);

  // Timer display update
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const interval = setInterval(() => {}, 1000);
      return () => clearInterval(interval);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      if (endPos) {
        setCurrentPos(endPos);
      }
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isActive, timeLeft, endPos]);

  const toggleTimer = () => {
    if (!startPos || !endPos || !routePath.length || isLoadingRoute) return;

    if (!isActive && timeLeft <= 0) {
      setProgress(0);
      setSteps(0);
      setTimeLeft(totalDuration);
      setCurrentPos(startPos);
    }

    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setTimeLeft(0);
    setTotalDuration(0);
    setStartPos(null);
    setEndPos(null);
    setRouteData(null);
    setRoutePath([]);
    setCurrentPos(null);
    setIsSettingStart(true);
    setRouteError(null);
    setSteps(0);
    setProgress(0);
    console.log("↺ Reset complete");
  };

  const distanceText = routeData
    ? `${(routeData.distance / 1000).toFixed(2)} km`
    : "0 km";

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          scrollWheelZoom
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMapClick={handleMapClick} />

          {startPos && (
            <Marker
              position={startPos}
              icon={
                new L.Icon({
                  iconUrl:
                    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                  shadowUrl:
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41],
                })
              }
            >
              <Popup>Start Point</Popup>
            </Marker>
          )}

          {endPos && (
            <Marker
              position={endPos}
              icon={
                new L.Icon({
                  iconUrl:
                    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
                  shadowUrl:
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41],
                })
              }
            >
              <Popup>Destination</Popup>
            </Marker>
          )}

          {/* Route Path */}
          {routePath.length > 1 && (
            <>
              <Polyline
                positions={routePath}
                color="white"
                weight={6}
                opacity={0.8}
              />
              <Polyline
                positions={routePath}
                color="#3b82f6"
                weight={3}
                opacity={1}
              />
            </>
          )}

          {/* The Walking Dot */}
          {currentPos && (
            <CircleMarker
              center={currentPos}
              radius={8}
              pathOptions={{
                color: "white",
                fillColor: "#3b82f6",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      {/* HUD Overlay with Minimize Toggle */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10  max-w-md">
        <Card
          className={`p-4 bg-background/90 backdrop-blur-md shadow-2xl border-2 border-primary/20 transition-all duration-300 ${
            isMinimized ? "opacity-60 hover:opacity-100 scale-95" : ""
          }`}
        >
          <TimerControls
            timeLeft={timeLeft}
            isActive={isActive}
            progress={progress}
            steps={steps}
            totalDuration={totalDuration}
            distanceText={distanceText}
            isMinimized={isMinimized}
            routeData={routeData}
            startPos={startPos}
            endPos={endPos}
            routePath={routePath}
            isLoadingRoute={isLoadingRoute}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onToggleMinimize={() => setIsMinimized(!isMinimized)}
          />

          {!isActive && !isMinimized && (
            <RouteStatus
              isLoadingRoute={isLoadingRoute}
              routeError={routeError}
              startPos={startPos}
              endPos={endPos}
              routeData={routeData}
              distanceText={distanceText}
              totalDuration={totalDuration}
              METERS_PER_STEP={METERS_PER_STEP}
              isActive={isActive}
            />
          )}

          {!isMinimized && (
            <div className="flex justify-center mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </DialogTrigger>
                <SettingsPanel
                  startPos={startPos}
                  endPos={endPos}
                  distanceText={distanceText}
                  totalDuration={totalDuration}
                  steps={steps}
                  progress={progress}
                  routeData={routeData}
                  METERS_PER_STEP={METERS_PER_STEP}
                  WALKING_SPEED_KMH={WALKING_SPEED_KMH}
                />
              </Dialog>
            </div>
          )}
        </Card>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 hidden md:block">
        <Card className="p-3 bg-white/80 backdrop-blur text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Start</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>End</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
            <span>You</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
