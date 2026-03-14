import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { formatDuration } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  label?: string;
}

export default function AudioPlayer({ src, label }: AudioPlayerProps) {
  const { isPlaying, currentTime, duration, volume, loading, error, toggle, seek, setVolume } =
    useAudioPlayer(src);

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-sm font-medium capitalize">{label}</p>
      )}
      <div className="flex items-center gap-2 rounded-lg border p-2 bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggle}
          disabled={loading || error}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : error ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary cursor-pointer"
        />

        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[70px] text-center">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
        >
          {volume > 0 ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-16 h-1.5 accent-primary cursor-pointer"
        />
      </div>
    </div>
  );
}
