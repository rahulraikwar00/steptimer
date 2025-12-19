import React from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SettingsPanelProps {
  startPos: any;
  endPos: any;
  distanceText: string;
  totalDuration: number;
  steps: number;
  progress: number;
  routeData: any;
  METERS_PER_STEP: number;
  WALKING_SPEED_KMH: number;
}

export default function SettingsPanel({
  startPos,
  endPos,
  distanceText,
  totalDuration,
  steps,
  progress,
  routeData,
  METERS_PER_STEP,
  WALKING_SPEED_KMH,
}: SettingsPanelProps) {
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const days = Math.floor(hours % 24);

    console.log({ totalSeconds, hours, minutes, seconds, days });

    if (hours >= 24) {
      return `${Math.floor(hours / 24)}d ${days}h ${minutes}m ${seconds}s`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="text-yellow-300">
          Route Settings & Info
        </DialogTitle>
      </DialogHeader>
      <div className="py-4 space-y-6">
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold mb-1">Route Info:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Distance:</p>
                <p className="font-medium">{distanceText}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration:</p>
                <p className="font-medium">{formatTime(totalDuration)}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-semibold mb-1">Coordinates:</p>
            <div className="space-y-1">
              <div>
                <p className="text-muted-foreground text-xs">Start:</p>
                <p className="font-medium">
                  {startPos
                    ? `${startPos.lat.toFixed(6)}, ${startPos.lng.toFixed(6)}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">End:</p>
                <p className="font-medium">
                  {endPos
                    ? `${endPos.lat.toFixed(6)}, ${endPos.lng.toFixed(6)}`
                    : "Not set"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-semibold mb-1">Progress:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Current Steps:</p>
                <p className="font-medium">{steps.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Progress:</p>
                <p className="font-medium">{(progress * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {routeData && (
            <div>
              <p className="font-semibold mb-1">Estimated Totals:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Total Steps:</p>
                  <p className="font-medium">
                    {Math.floor(
                      routeData.distance / METERS_PER_STEP
                    ).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Distance:</p>
                  <p className="font-medium">
                    {(routeData.distance / 1000).toFixed(2)} km
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold mb-1">Configuration:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Walking Speed:</p>
                <p className="font-medium">{WALKING_SPEED_KMH} km/h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Step Length:</p>
                <p className="font-medium">{METERS_PER_STEP} meters</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
