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
    <div className="justify-center items-center flex flex-col gap-2 w-full ">
      {/* Header with minimize button */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-primary">
            MAP TIMER
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggleMinimize}
        >
          {isMinimized ? (
            <Maximize2 className="w-4 h-4" />
          ) : (
            <Minimize2 className="w-4 h-4" />
          )}
        </Button>
      </div>
      {/* Minimized View */}
      {isMinimized ? (
        <div
          className="flex flex-col items-center w-full cursor-pointer"
          onClick={onToggleMinimize}
        >
          <div className="text-3xl font-mono font-bold tracking-widest text-foreground tabular-nums ">
            {formatTime(timeLeft)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Steps: {steps.toLocaleString()}
            {totalDuration > 0 && ` · ${(progress * 100).toFixed(0)}%`}
          </div>
        </div>
      ) : (
        <>
          {/* Timer Display */}
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

          {/* Controls */}
          <div className="flex items-center gap-3 w-full justify-center">
            <Button
              size="lg"
              className={`w-full h-12 rounded-full shadow-lg transition-all ${
                !startPos || !endPos || !routePath.length || isLoadingRoute
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-105"
              }`}
              disabled={
                !startPos || !endPos || !routePath.length || isLoadingRoute
              }
              onClick={onToggleTimer}
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
              className="hover:scale-105 hover:bg-orange-400 hover:text-black w-12 h-12 rounded-full"
              onClick={onResetTimer}
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
