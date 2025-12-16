import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Maximize,
  Minimize,
} from "lucide-react";
import confetti from "canvas-confetti";
import minerSprite from "@assets/generated_images/horizontal_sprite_strip_of_walking_miner.png";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const MINER_SIZE = 32; // Size in px
const FPS = 60;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function MinerTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [duration, setDuration] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isHUDVisible, setIsHUDVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Miner State
  const [minerPos, setMinerPos] = useState({ x: 0, y: 0, facingRight: true });
  const [frame, setFrame] = useState(0);

  // Custom Sprite Settings
  const [spriteFrames, setSpriteFrames] = useState(4);
  const [spriteSpeed, setSpriteSpeed] = useState(150);
  const [minerScale, setMinerScale] = useState(1);

  // Particles State ref (for performance)
  const particlesRef = useRef<Particle[]>([]);
  const lastProgressRef = useRef<number>(0);

  // Initialize Canvas
  const drawWall = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Resize canvas if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Calculate progress
    const progress = 1 - timeLeft / duration; // 0 to 1 (0 = start, 1 = done)

    // Check if we advanced significantly to spawn particles
    if (isActive && progress > lastProgressRef.current && progress < 1) {
      // Spawn particles at miner position
      // We'll do this based on position logic below
    }
    lastProgressRef.current = progress;

    // Path Logic
    const rows = Math.ceil(height / MINER_SIZE);
    const totalDistance = rows * width;
    const currentDistance = progress * totalDistance;

    const currentRowIndex = Math.floor(currentDistance / width);
    const rowProgress = currentDistance % width;

    // Y is calculated from bottom
    // Row 0 is bottom
    const y = height - (currentRowIndex + 1) * MINER_SIZE;

    // X depends on row direction
    const isEvenRow = currentRowIndex % 2 === 0; // 0, 2, 4... (L->R)
    let x = isEvenRow ? rowProgress : width - rowProgress;

    // Update Miner Position State for the sprite
    const targetX = Math.max(
      0,
      Math.min(width - MINER_SIZE, x - MINER_SIZE / 2),
    );
    const targetY = Math.max(0, Math.min(height - MINER_SIZE, y));

    setMinerPos({
      x: targetX,
      y: targetY,
      facingRight: isEvenRow,
    });

    // Particle Spawning Logic: If moving, spawn dust behind
    if (isActive && Math.random() > 0.8) {
      particlesRef.current.push({
        x: targetX + (isEvenRow ? 0 : MINER_SIZE), // Dust behind
        y: targetY + MINER_SIZE,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2,
        life: 1.0,
        color: Math.random() > 0.5 ? "#555" : "#777",
      });
    }

    // Draw Rock
    ctx.clearRect(0, 0, width, height);

    // Draw Unmined Blocks
    ctx.fillStyle = "#2a2a35"; // Slightly lighter cave wall

    // 1. Draw all full rows ABOVE current row
    const unminedHeight = height - (currentRowIndex + 1) * MINER_SIZE;
    if (unminedHeight > 0) {
      ctx.fillRect(0, 0, width, unminedHeight);
    }

    // 2. Draw partial current row
    const rowY = height - (currentRowIndex + 1) * MINER_SIZE;
    if (isEvenRow) {
      ctx.fillRect(x, rowY, width - x, MINER_SIZE);

      // Draw "cracking" edge
      ctx.fillStyle = "#444455";
      ctx.fillRect(x, rowY, 4, MINER_SIZE);
      ctx.fillStyle = "#2a2a35"; // Reset
    } else {
      ctx.fillRect(0, rowY, x, MINER_SIZE);

      // Draw "cracking" edge
      ctx.fillStyle = "#444455";
      ctx.fillRect(x - 4, rowY, 4, MINER_SIZE);
      ctx.fillStyle = "#2a2a35"; // Reset
    }

    // Add pixel texture/grid lines to the rock
    ctx.strokeStyle = "#1a1a20";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Vertical grid
    for (let gx = 0; gx <= width; gx += MINER_SIZE) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
    }
    // Horizontal grid
    for (let gy = 0; gy <= height; gy += MINER_SIZE) {
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
    }
    ctx.stroke();

    // Draw Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;

      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, 4, 4); // Big pixels for dust
      ctx.globalAlpha = 1.0;
    }
  }, [timeLeft, duration, isActive]);

  // Animation Loop
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      if (isActive && timeLeft > 0) {
        // Update Time
        const deltaTime = (time - lastTime) / 1000;
        setTimeLeft((prev) => Math.max(0, prev - deltaTime));

        // Update Sprite Frame
        if (Math.floor(time / spriteSpeed) % spriteFrames !== frame) {
          setFrame(Math.floor(time / spriteSpeed) % spriteFrames);
        }
      } else if (timeLeft <= 0 && isActive) {
        setIsActive(false);
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#FFD700", "#FFA500", "#FFFFFF"], // Gold colors
        });
      }

      drawWall();
      lastTime = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isActive, timeLeft, drawWall, frame]);

  // Window Resize Handler
  useEffect(() => {
    window.addEventListener("resize", drawWall);
    return () => window.removeEventListener("resize", drawWall);
  }, [drawWall]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(duration);
    setMinerPos({ x: 0, y: 0, facingRight: true });
    particlesRef.current = [];
    drawWall();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col select-none touch-none">
      {/* Header / HUD */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 p-4 md:p-6 transition-transform duration-300 flex justify-center md:justify-between items-start pointer-events-none ${isHUDVisible ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="bg-card/90 backdrop-blur-md p-4 rounded-xl border-4 border-border pixel-box-shadow pointer-events-auto flex flex-col items-center gap-4 min-w-[300px] shadow-2xl">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl md:text-2xl font-pixel text-primary pixel-text-shadow">
              MINER TIMER
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setIsHUDVisible(false)}
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-6xl font-mono text-foreground tracking-widest bg-black/20 px-4 py-2 rounded border-2 border-white/5 w-full text-center">
            {formatTime(timeLeft)}
          </div>

          <div className="flex gap-3 w-full justify-center">
            <Button
              variant="default"
              size="icon"
              className="h-14 w-14 rounded-xl border-b-4 border-primary-foreground/20 bg-primary hover:bg-primary/90 text-primary-foreground active:border-b-0 active:translate-y-1 transition-all"
              onClick={toggleTimer}
            >
              {isActive ? (
                <Pause className="h-8 w-8 fill-current" />
              ) : (
                <Play className="h-8 w-8 fill-current" />
              )}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              className="h-14 w-14 rounded-xl border-b-4 border-black/20 bg-secondary hover:bg-secondary/90 active:border-b-0 active:translate-y-1 transition-all"
              onClick={resetTimer}
            >
              <RotateCcw className="h-6 w-6" />
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-xl border-b-4 border-black/20 bg-muted hover:bg-muted/90 active:border-b-0 active:translate-y-1 transition-all"
                >
                  <Settings className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="font-pixel border-4 border-border bg-card max-w-sm mx-4">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <Label className="text-lg">
                      Duration: {duration / 60} min
                    </Label>
                    <Slider
                      value={[duration / 60]}
                      min={1}
                      max={60}
                      step={1}
                      onValueChange={(vals) => {
                        const newDuration = vals[0] * 60;
                        setDuration(newDuration);
                        if (!isActive) setTimeLeft(newDuration);
                      }}
                      className="py-4"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <Label className="text-sm font-bold text-muted-foreground">
                      SPRITE SETTINGS
                    </Label>

                    <div className="space-y-2">
                      <Label>Frame Count: {spriteFrames}</Label>
                      <Slider
                        value={[spriteFrames]}
                        min={1}
                        max={16}
                        step={1}
                        onValueChange={(vals) => setSpriteFrames(vals[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Animation Speed: {spriteSpeed}ms</Label>
                      <Slider
                        value={[spriteSpeed]}
                        min={50}
                        max={500}
                        step={10}
                        onValueChange={(vals) => setSpriteSpeed(vals[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Miner Scale: {minerScale}x</Label>
                      <Slider
                        value={[minerScale]}
                        min={0.5}
                        max={3}
                        step={0.1}
                        onValueChange={(vals) => setMinerScale(vals[0])}
                      />
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Show HUD Button (Mobile Only) */}
      {!isHUDVisible && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 right-4 z-50 rounded-full shadow-lg border-2 border-border"
          onClick={() => setIsHUDVisible(true)}
        >
          <Maximize className="h-6 w-6" />
        </Button>
      )}

      {/* Game Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full bg-[#1a1a1e]"
      >
        {/* The Wall Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-10 block" />

        {/* The Miner Sprite */}
        <div
          className="absolute z-20 pointer-events-none transition-transform duration-100 will-change-transform"
          style={{
            width: `${MINER_SIZE * minerScale}px`,
            height: `${MINER_SIZE * minerScale}px`,
            transform: `translate(${minerPos.x - (MINER_SIZE * (minerScale - 1)) / 2}px, ${minerPos.y - MINER_SIZE * (minerScale - 1)}px) scaleX(${minerPos.facingRight ? 1 : -1})`,
            imageRendering: "pixelated",
          }}
        >
          {/* Sprite Image Container */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundImage: `url(${minerSprite})`,
              backgroundSize: `${spriteFrames * 100}% 100%`,
              backgroundPosition: `-${frame * 100}% 0%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
