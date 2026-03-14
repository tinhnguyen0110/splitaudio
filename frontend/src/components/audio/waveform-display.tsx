import { useCallback, useEffect, useRef, useState } from 'react';

interface WaveformDisplayProps {
  src: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

const BAR_COUNT = 200;
const BAR_GAP = 1;

export function WaveformDisplay({ src, currentTime, duration, isPlaying, onSeek }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<number[]>([]);
  const animFrameRef = useRef<number>(0);
  const [failed, setFailed] = useState(false);

  // Decode audio and extract waveform data
  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    (async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        if (cancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / BAR_COUNT);
        const bars: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = start; j < start + blockSize; j++) {
            sum += Math.abs(channelData[j]);
          }
          bars.push(sum / blockSize);
        }

        // Normalize to 0-1
        const max = Math.max(...bars, 0.01);
        barsRef.current = bars.map((b) => b / max);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bars = barsRef.current;
    if (bars.length === 0) return;

    const barWidth = (width - (bars.length - 1) * BAR_GAP) / bars.length;
    const progress = duration > 0 ? currentTime / duration : 0;
    const playedBars = Math.floor(progress * bars.length);

    const mutedColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--muted-foreground').trim() || '#94a3b8';
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim() || '#6366f1';

    for (let i = 0; i < bars.length; i++) {
      const barHeight = Math.max(2, bars[i] * height * 0.9);
      const x = i * (barWidth + BAR_GAP);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = i < playedBars ? `hsl(${primaryColor})` : `hsl(${mutedColor})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Playhead
    if (duration > 0) {
      const px = progress * width;
      ctx.fillStyle = `hsl(${primaryColor})`;
      ctx.fillRect(px - 1, 0, 2, height);
    }
  }, [currentTime, duration]);

  // Draw on data change + animation loop when playing
  useEffect(() => {
    draw();

    if (isPlaying) {
      const tick = () => {
        draw();
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animFrameRef.current);
    }
  }, [draw, isPlaying]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, ratio * duration)));
  };

  if (failed) {
    // Fallback progress bar
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    return (
      <div
        className="relative h-12 w-full cursor-pointer rounded bg-muted"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(duration, ratio * duration)));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded bg-primary/60 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-24 w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-pointer"
        onClick={handleClick}
      />
    </div>
  );
}
