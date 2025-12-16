import React, { useState, useEffect, useRef } from "react";
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
import {
  Play,
  Pause,
  RotateCcw,
  MapPin,
  Navigation,
  Settings,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

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

  // Refs for movement logic
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Constants
  const WALKING_SPEED_KMH = 5; // 5 km/h walking speed
  const WALKING_SPEED_MS = (WALKING_SPEED_KMH * 1000) / 3600; // ~1.39 m/s
  const METERS_PER_STEP = 0.75; // Average step length in meters

  // Fetch Route from OSRM
  // const fetchRoute = async (start: LatLng, end: LatLng) => {
  //   console.log("🛣️ Fetching route from", start, "to", end);
  //   setIsLoadingRoute(true);
  //   setRouteError(null);

  //   try {
  //     // OSRM expects: lng,lat;lng,lat
  //     const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  //     console.log("📍 OSRM URL:", url);

  //     const response = await fetch(url, {
  //       headers: { Accept: "application/json" },
  //       mode: "cors",
  //     });

  //     if (!response.ok) {
  //       throw new Error(`HTTP ${response.status}`);
  //     }

  //     const data = await response.json();
  //     console.log("📊 OSRM Response:", data);

  //     if (data.code !== "Ok") {
  //       throw new Error(data.message || "Route calculation failed");
  //     }

  //     if (data.routes && data.routes.length > 0) {
  //       const route = data.routes[0];
  //       const distanceMeters = route.distance;
  //       const distanceKm = distanceMeters / 1000;

  //       // Calculate duration based on walking speed instead of OSRM's estimate
  //       // OSRM's walking duration is often too optimistic for real walking
  //       const estimatedDurationSeconds = Math.ceil(
  //         (distanceKm / WALKING_SPEED_KMH) * 3600,
  //       );
  //       const estimatedSteps = Math.floor(distanceMeters / METERS_PER_STEP);

  //       const coordinates = route.geometry.coordinates;

  //       console.log(
  //         `✅ Route found: ${distanceKm.toFixed(2)} km, ` +
  //           `Estimated: ${Math.floor(estimatedDurationSeconds / 60)} min ${estimatedDurationSeconds % 60} sec, ` +
  //           `~${estimatedSteps.toLocaleString()} steps`,
  //       );

  //       // Convert to Leaflet LatLng for drawing
  //       const path = coordinates.map((coord: number[]) => ({
  //         lat: coord[1],
  //         lng: coord[0],
  //       }));

  //       // Create Turf LineString for interpolation
  //       const line = turf.lineString(coordinates);

  //       const routeData: RouteData = {
  //         path,
  //         line,
  //         distance: distanceMeters,
  //         duration: estimatedDurationSeconds,
  //       };

  //       setRouteData(routeData);
  //       setRoutePath(path);
  //       setTotalDuration(estimatedDurationSeconds);
  //       setTimeLeft(estimatedDurationSeconds);
  //       setCurrentPos(start);
  //       setSteps(0);
  //       setProgress(0);

  //       return routeData;
  //     } else {
  //       throw new Error("No routes found");
  //     }
  //   } catch (error: any) {
  //     console.error("❌ Route fetch error:", error);

  //     // Fallback: Straight line calculation
  //     console.log("⚠️ Fallback to straight line routing");
  //     const straightLine = [
  //       [start.lng, start.lat],
  //       [end.lng, end.lat],
  //     ];
  //     const path = [
  //       { lat: start.lat, lng: start.lng },
  //       { lat: end.lat, lng: end.lng },
  //     ];
  //     const line = turf.lineString(straightLine);

  //     const distanceMeters = turf.length(line, { units: "meters" });
  //     const distanceKm = distanceMeters / 1000;
  //     const estimatedDurationSeconds = Math.ceil(
  //       (distanceKm / WALKING_SPEED_KMH) * 3600,
  //     );

  //     const routeData: RouteData = {
  //       path,
  //       line,
  //       distance: distanceMeters,
  //       duration: estimatedDurationSeconds,
  //     };

  //     setRouteData(routeData);
  //     setRoutePath(path);
  //     setTotalDuration(estimatedDurationSeconds);
  //     setTimeLeft(estimatedDurationSeconds);
  //     setCurrentPos(start);
  //     setSteps(0);
  //     setProgress(0);

  //     setRouteError("Using straight line estimate (API limit reached)");

  //     return routeData;
  //   } finally {
  //     setIsLoadingRoute(false);
  //   }
  // };

  const fetchRoute = async (start: LatLng, end: LatLng) => {
    console.log("🛣️ Fetching route from", start, "to", end);
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      // OSRM expects: lng,lat;lng,lat
      const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      console.log("📍 OSRM URL:", url);

      // Create a timeout promise that rejects after 2 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout after 2 seconds")), 2000);
      });

      // Race between fetch and timeout
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

        // Calculate duration based on walking speed
        const estimatedDurationSeconds = Math.ceil(
          (distanceKm / WALKING_SPEED_KMH) * 3600,
        );
        const estimatedSteps = Math.floor(distanceMeters / METERS_PER_STEP);

        const coordinates = route.geometry.coordinates;

        console.log(
          `✅ Route found: ${distanceKm.toFixed(2)} km, ` +
            `Estimated: ${Math.floor(estimatedDurationSeconds / 60)} min ${estimatedDurationSeconds % 60} sec, ` +
            `~${estimatedSteps.toLocaleString()} steps`,
        );

        // Convert to Leaflet LatLng for drawing
        const path = coordinates.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        // Create Turf LineString for interpolation
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

      // Fallback to straight line after 2 seconds timeout
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
        (distanceKm / WALKING_SPEED_KMH) * 3600,
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

      // Different message for timeout vs other errors
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
      const deltaTime = (now - lastUpdateRef.current) / 1000; // Convert to seconds
      lastUpdateRef.current = now;

      if (deltaTime <= 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate distance traveled based on walking speed
      const distanceTraveled = WALKING_SPEED_MS * deltaTime; // in meters

      // Update progress
      const totalDistance = routeData.distance;
      const newProgress = Math.min(
        progress + distanceTraveled / totalDistance,
        1,
      );

      // Update steps
      const distanceTraveledMeters = newProgress * totalDistance;
      const newSteps = Math.floor(distanceTraveledMeters / METERS_PER_STEP);

      // Update position along route
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

      // Update time left
      const elapsedTime = newProgress * routeData.duration;
      const newTimeLeft = Math.max(0, routeData.duration - elapsedTime);

      setProgress(newProgress);
      setSteps(newSteps);
      setTimeLeft(Math.round(newTimeLeft));

      // Trigger completion
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

  // Timer display update (separate from animation)
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const interval = setInterval(() => {
        // This just updates the display, actual movement is handled by animation
      }, 1000);
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
      // Reset to start if timer finished
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

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const distanceText = routeData
    ? `${(routeData.distance / 1000).toFixed(2)} km`
    : "0 km";

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[20.5937, 78.9629]} // India
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

      {/* HUD Overlay */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-md">
        <Card className="p-4 bg-background/90 backdrop-blur-md shadow-2xl border-2 border-primary/20">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              MAP TIMER
            </h1>

            <div className="flex flex-col items-center">
              <div className="text-5xl font-mono font-bold tracking-widest text-foreground tabular-nums">
                {formatTime(timeLeft)}
              </div>
              {totalDuration > 0 && (
                <div className="flex flex-col items-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    {distanceText} · {formatTime(totalDuration)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Steps: {steps.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Progress: {(progress * 100).toFixed(1)}%
                  </span>
                  {routeData && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress * 100}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Message */}
            {!isActive && (
              <div className="text-sm text-center bg-muted/50 p-2 rounded w-full min-h-[3.5rem] flex items-center justify-center">
                {routeError && (
                  <div className="flex items-start gap-2 text-amber-500">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{routeError}</span>
                  </div>
                )}
                {isLoadingRoute && (
                  <span className="flex items-center gap-2 text-blue-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Calculating
                    route...
                  </span>
                )}
                {!isLoadingRoute && !routeError && !startPos && (
                  <span className="text-green-600 font-bold animate-pulse">
                    Tap map to set START
                  </span>
                )}
                {!isLoadingRoute && !routeError && startPos && !endPos && (
                  <span className="text-orange-500 font-bold animate-pulse">
                    Tap map to set DESTINATION
                  </span>
                )}
                {!isLoadingRoute &&
                  !routeError &&
                  startPos &&
                  endPos &&
                  routeData && (
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        ✅ Route Ready!
                      </span>
                      <span className="text-xs">
                        {distanceText} · {formatTime(totalDuration)} · ~
                        {Math.floor(
                          routeData.distance / METERS_PER_STEP,
                        ).toLocaleString()}{" "}
                        steps
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3 w-full justify-center">
              <Button
                size="lg"
                className={`w-16 h-16 rounded-full shadow-lg transition-all ${!startPos || !endPos || !routePath.length || isLoadingRoute ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}`}
                disabled={
                  !startPos || !endPos || !routePath.length || isLoadingRoute
                }
                onClick={toggleTimer}
              >
                {isActive ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={resetTimer}
              >
                <RotateCcw className="w-5 h-5" />
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-full"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-6">
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">Route Info:</p>
                      <p>
                        Start:{" "}
                        {startPos
                          ? `${startPos.lat.toFixed(4)}, ${startPos.lng.toFixed(4)}`
                          : "Not set"}
                      </p>
                      <p>
                        End:{" "}
                        {endPos
                          ? `${endPos.lat.toFixed(4)}, ${endPos.lng.toFixed(4)}`
                          : "Not set"}
                      </p>
                      <p>Distance: {distanceText}</p>
                      <p>Duration: {formatTime(totalDuration)}</p>
                      <p>Current Steps: {steps.toLocaleString()}</p>
                      <p>
                        Total Steps:{" "}
                        {routeData
                          ? Math.floor(
                              routeData.distance / METERS_PER_STEP,
                            ).toLocaleString()
                          : "0"}
                      </p>
                      <p>Progress: {(progress * 100).toFixed(1)}%</p>
                      <p>Walking Speed: {WALKING_SPEED_KMH} km/h</p>
                      <p>Step Length: {METERS_PER_STEP}m</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
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
