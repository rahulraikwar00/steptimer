import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Play, Pause, RotateCcw, MapPin, Navigation, Settings, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import confetti from "canvas-confetti";
import * as turf from "@turf/turf";

// Fix Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Types
type LatLng = { lat: number; lng: number };

function MapEvents({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    click: onMapClick,
  });
  return null;
}

export default function MapTimer() {
  const [startPos, setStartPos] = useState<LatLng | null>(null);
  const [endPos, setEndPos] = useState<LatLng | null>(null);
  const [currentPos, setCurrentPos] = useState<LatLng | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [turfLine, setTurfLine] = useState<any>(null);
  
  const [timeLeft, setTimeLeft] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  const [isSettingStart, setIsSettingStart] = useState(true);

  // Fetch Route from OSRM - using useRef to avoid stale closure issues
  const startPosRef = useRef<LatLng | null>(null);

  const fetchRoute = async (start: LatLng, end: LatLng) => {
    console.log("🛣️ Fetching route from", start, "to", end);
    setIsLoadingRoute(true);
    setRouteError(null);
    
    try {
      // OSRM expects: lng,lat;lng,lat
      const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      console.log("📍 OSRM URL:", url);
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' }
      });
      
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
        const seconds = Math.ceil(route.duration);
        const distance = route.distance / 1000; // Convert to km
        const coordinates = route.geometry.coordinates; // [lon, lat] arrays

        console.log(`✅ Route found: ${distance.toFixed(2)} km, ${Math.floor(seconds / 60)} min ${seconds % 60} sec`);

        // Convert to Leaflet LatLng for drawing
        const path = coordinates.map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }));
        
        // Create Turf LineString for interpolation
        const line = turf.lineString(coordinates);
        
        setRoutePath(path);
        setTurfLine(line);
        setDuration(seconds);
        setTimeLeft(seconds);
        setCurrentPos(start);
      } else {
        throw new Error("No routes found");
      }
    } catch (error: any) {
      console.error("❌ Route fetch error:", error);
      setRouteError(error.message || "Failed to calculate route");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Handle Map Clicks
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (isActive) return;

    console.log("📌 Map clicked at:", e.latlng);

    if (isSettingStart) {
      setStartPos(e.latlng);
      startPosRef.current = e.latlng;
      setCurrentPos(e.latlng);
      setEndPos(null);
      setRoutePath([]);
      setDuration(0);
      setTimeLeft(0);
      setRouteError(null);
      setIsSettingStart(false);
      console.log("✓ Start point set");
    } else {
      // Use ref for immediate access
      const start = startPosRef.current;
      if (start) {
        setEndPos(e.latlng);
        console.log("✓ End point set, fetching route...");
        fetchRoute(start, e.latlng);
      }
    }
  };

  // Timer Logic
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsActive(false);
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 }
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  // Movement Logic (Along the Path)
  useEffect(() => {
    if (isActive && turfLine && duration > 0 && timeLeft >= 0) {
      const elapsedTime = duration - timeLeft;
      const progress = elapsedTime / duration; // 0 to 1
      
      const totalDistance = turf.length(turfLine, { units: 'kilometers' });
      const targetDistance = totalDistance * progress;
      
      const point = turf.along(turfLine, targetDistance, { units: 'kilometers' });
      const [lng, lat] = point.geometry.coordinates;
      
      setCurrentPos({ lat, lng });
    } else if (timeLeft === 0 && endPos) {
      setCurrentPos(endPos);
    }
  }, [timeLeft, isActive, turfLine, duration, endPos]);

  const toggleTimer = () => {
    if (!startPos || !endPos || !routePath.length || isLoadingRoute) return;
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(duration);
    if (startPos) setCurrentPos(startPos);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const distanceText = turfLine 
    ? `${turf.length(turfLine, { units: 'kilometers' }).toFixed(2)} km` 
    : "0 km";

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[51.505, -0.09]} 
          zoom={15} 
          scrollWheelZoom={true} 
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMapClick={handleMapClick} />
          
          {startPos && (
            <Marker position={startPos} icon={new L.Icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })}>
              <Popup>Start Point</Popup>
            </Marker>
          )}

          {endPos && (
            <Marker position={endPos} icon={new L.Icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })}>
              <Popup>Destination</Popup>
            </Marker>
          )}

          {/* Route Path - Draw it! */}
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
              pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }} 
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
              {duration > 0 && (
                 <span className="text-xs text-muted-foreground mt-1">
                   Walking Time: {distanceText}
                 </span>
              )}
            </div>

            {/* Status Message */}
            {!isActive && (
              <div className="text-sm text-center bg-muted/50 p-2 rounded w-full min-h-[3.5rem] flex items-center justify-center">
                {routeError && (
                  <div className="flex items-start gap-2 text-red-500">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{routeError}</span>
                  </div>
                )}
                {isLoadingRoute && (
                   <span className="flex items-center gap-2 text-blue-500">
                     <Loader2 className="w-4 h-4 animate-spin" /> Calculating route...
                   </span>
                )}
                {!isLoadingRoute && !routeError && !startPos && (
                  <span className="text-green-600 font-bold animate-pulse">Tap map to set START</span>
                )}
                {!isLoadingRoute && !routeError && startPos && !endPos && (
                  <span className="text-orange-500 font-bold animate-pulse">Tap map to set DESTINATION</span>
                )}
                {!isLoadingRoute && !routeError && startPos && endPos && routePath.length > 0 && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">✅ Route Ready!</span>
                    <span className="text-xs">{distanceText} · {Math.floor(duration / 60)}m {duration % 60}s</span>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3 w-full justify-center">
               <Button 
                size="lg"
                className={`w-16 h-16 rounded-full shadow-lg transition-all ${!startPos || !endPos || !routePath.length || isLoadingRoute ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                disabled={!startPos || !endPos || !routePath.length || isLoadingRoute}
                onClick={toggleTimer}
              >
                {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
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
                  <Button variant="outline" size="icon" className="w-12 h-12 rounded-full">
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
                      <p>Start: {startPos ? `${startPos.lat.toFixed(4)}, ${startPos.lng.toFixed(4)}` : 'Not set'}</p>
                      <p>End: {endPos ? `${endPos.lat.toFixed(4)}, ${endPos.lng.toFixed(4)}` : 'Not set'}</p>
                      <p>Distance: {distanceText}</p>
                      <p>Duration: {formatTime(duration)}</p>
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
