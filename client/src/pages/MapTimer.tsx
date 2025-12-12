import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Play, Pause, RotateCcw, MapPin, Navigation, Settings, Loader2 } from "lucide-react";
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

// Helper to decode OSRM polyline (if needed) or just use GeoJSON from OSRM
// OSRM returns GeoJSON coordinates as [lon, lat]

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
  const [turfLine, setTurfLine] = useState<any>(null); // GeoJSON LineString
  
  const [timeLeft, setTimeLeft] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  
  // HUD State
  const [isSettingStart, setIsSettingStart] = useState(true);

  // Handle Map Clicks
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (isActive) return;

    if (isSettingStart) {
      setStartPos(e.latlng);
      setCurrentPos(e.latlng);
      setEndPos(null); // Reset end if start changes
      setRoutePath([]);
      setDuration(0);
      setTimeLeft(0);
      setIsSettingStart(false);
    } else {
      setEndPos(e.latlng);
      if (startPos) {
        await fetchRoute(startPos, e.latlng);
      }
    }
  };

  // Fetch Route from OSRM
  const fetchRoute = async (start: LatLng, end: LatLng) => {
    setIsLoadingRoute(true);
    try {
      // OSRM uses lon,lat
      const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const seconds = Math.ceil(route.duration);
        const coordinates = route.geometry.coordinates; // [lon, lat] arrays

        // Convert to Leaflet LatLng for drawing
        const path = coordinates.map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }));
        
        // Create Turf LineString for interpolation
        const line = turf.lineString(coordinates);
        
        setRoutePath(path);
        setTurfLine(line);
        setDuration(seconds);
        setTimeLeft(seconds);
      }
    } catch (error) {
      console.error("Failed to fetch route", error);
    } finally {
      setIsLoadingRoute(false);
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
      const progress = elapsedTime / duration; // 0 to 1 (time based)
      
      // Calculate total distance of the route
      const totalDistance = turf.length(turfLine, { units: 'kilometers' });
      
      // Calculate target distance along the path based on time progress
      const targetDistance = totalDistance * progress;
      
      // Get the point at this distance
      const point = turf.along(turfLine, targetDistance, { units: 'kilometers' });
      const [lng, lat] = point.geometry.coordinates;
      
      setCurrentPos({ lat, lng });
    } else if (timeLeft === 0 && endPos) {
      setCurrentPos(endPos);
    }
  }, [timeLeft, isActive, turfLine, duration, endPos]);

  const toggleTimer = () => {
    if (!startPos || !endPos || !routePath.length) return;
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

  // Distance Text (Real Route Distance)
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

          {/* Route Path */}
          {routePath.length > 0 && (
            <>
              {/* Background thick line for visibility */}
              <Polyline 
                positions={routePath} 
                color="white" 
                weight={6} 
                opacity={0.8} 
              />
              {/* Foreground dashed line */}
              <Polyline 
                positions={routePath} 
                color="#3b82f6" 
                dashArray="10, 10" 
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
                   Estimated Walking Time
                 </span>
              )}
            </div>

            {/* Instructions / Status */}
            {!isActive && (
              <div className="text-sm text-muted-foreground text-center bg-muted/50 p-2 rounded w-full min-h-[3rem] flex items-center justify-center">
                {isLoadingRoute ? (
                   <span className="flex items-center gap-2 text-blue-500">
                     <Loader2 className="w-4 h-4 animate-spin" /> Calculating route...
                   </span>
                ) : !startPos ? (
                  <span className="text-green-600 font-bold animate-pulse">Tap map to set START point</span>
                ) : !endPos ? (
                  <span className="text-red-500 font-bold animate-pulse">Tap map to set DESTINATION</span>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Route Ready!</span>
                    <span>Distance: {distanceText}</span>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3 w-full justify-center">
               <Button 
                size="lg"
                className={`w-16 h-16 rounded-full shadow-lg transition-all ${!startPos || !endPos || isLoadingRoute ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                disabled={!startPos || !endPos || isLoadingRoute}
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
                    <DialogTitle>Map Settings</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-6">
                    <div className="space-y-2">
                       <Label>Map Controls</Label>
                       <div className="flex gap-2">
                         <Button 
                           variant={isSettingStart ? "default" : "outline"}
                           size="sm"
                           onClick={() => setIsSettingStart(true)}
                           className="flex-1"
                         >
                           <MapPin className="w-4 h-4 mr-2 text-green-500" />
                           Set Start
                         </Button>
                         <Button 
                           variant={!isSettingStart ? "default" : "outline"}
                           size="sm"
                           onClick={() => setIsSettingStart(false)}
                           className="flex-1"
                         >
                           <MapPin className="w-4 h-4 mr-2 text-red-500" />
                           Set End
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground mt-2">
                         Note: Duration is automatically calculated based on realistic walking speed for the selected route.
                       </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </Card>
      </div>

      {/* Legend / Info (Bottom) */}
      <div className="absolute bottom-6 left-6 z-10 hidden md:block">
         <Card className="p-3 bg-white/80 backdrop-blur text-xs space-y-1">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-green-500"></div>
             <span>Start Point</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-red-500"></div>
             <span>Destination</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
             <span>You (Timer)</span>
           </div>
         </Card>
      </div>
    </div>
  );
}
