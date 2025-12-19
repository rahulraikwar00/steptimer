import React from "react";
import { Play, Pause, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimerControlsProps {
  timeLeft: number;
  isActive: boolean;
  progress: number;
  steps: number;
  totalDuration: number;
  distanceText: string;
  isMinimized: boolean;
  routeData: any;
  startPos: any;
  endPos: any;
  routePath: any[];
  isLoadingRoute: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onToggleMinimize: () => void;
}

export default function TimerControls({
  timeLeft,
  isActive,
  progress,
  steps,
  totalDuration,
  distanceText,
  isMinimized,
  routeData,
  startPos,
  endPos,
  routePath,
  isLoadingRoute,
  onToggleTimer,
  onResetTimer,
  onToggleMinimize,
}: TimerControlsProps) {
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const days = Math.floor(hours / 24);

    if (hours >= 24) {
      return `${days}d:${(hours % 24).toString()}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-gray-900">Map Timer</div>
        <button
          onClick={onToggleMinimize}
          className="text-gray-500 hover:text-gray-700"
        >
          {isMinimized ? "▼" : "▲"}
        </button>
      </div>

      {/* Minimized View */}
      {isMinimized ? (
        <div
          className="flex justify-between mb-4 px-2 hover:bg-gray-50 rounded"
          onClick={onToggleMinimize}
        >
          <div className="text-xl font-mono font-medium text-gray-900">
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-gray-500">
            {steps.toLocaleString()} steps
          </div>
        </div>
      ) : (
        <>
          {/* Main Timer */}
          <div className="mb-4 text-center">
            <div className="text-3xl font-mono font-medium text-gray-900 mb-1">
              {formatTime(timeLeft)}
            </div>

            {/* Progress */}
            {routeData && (
              <div className="text-sm text-gray-600">
                {(progress * 100).toFixed(0)}% complete
              </div>
            )}
          </div>

          {/* Simple Stats */}
          {routeData && (
            <div className="flex justify-between mb-4 px-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">Distance</div>
                <div className="text-sm font-medium text-gray-900">
                  {distanceText}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">ETA</div>
                <div className="text-sm font-medium text-gray-900">
                  {formatTime(totalDuration)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Steps</div>
                <div className="text-sm font-medium text-gray-900">
                  {steps.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {routeData && (
            <div className="mb-4">
              <div className="h-1 w-full bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-gray-800"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Simple Controls */}
          <div className="flex gap-2">
            <button
              onClick={onToggleTimer}
              disabled={
                !startPos || !endPos || !routePath.length || isLoadingRoute
              }
              className={`flex-1 py-2 rounded text-sm font-medium ${
                isActive ? "bg-gray-900 text-white" : "bg-gray-800 text-white"
              } ${
                !startPos || !endPos || !routePath.length || isLoadingRoute
                  ? "opacity-50"
                  : ""
              }`}
            >
              {isActive ? "Pause" : "Start"}
            </button>

            <button
              onClick={onResetTimer}
              className="px-3 py-2 rounded text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
