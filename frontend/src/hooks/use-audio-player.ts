import { useRef, useState, useCallback } from 'react';

function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    const { state } = JSON.parse(stored);
    return state?.accessToken ?? null;
  } catch {
    return null;
  }
}

export function useAudioPlayer(src: string) {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const listenersRef = useRef(false);

  const attachListeners = useCallback(() => {
    if (listenersRef.current) return;
    const audio = audioRef.current;
    listenersRef.current = true;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      setLoading(false);
    });
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setIsPlaying(false));
    audio.addEventListener('error', () => {
      console.error('[AudioPlayer] media error:', audio.error?.code, audio.error?.message);
      setError(true);
      setLoading(false);
    });
  }, []);

  const loadAudio = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setError(false);
    attachListeners();

    const url = src.startsWith('/') ? `/api/v1${src}` : src;
    const token = getAccessToken();

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const audio = audioRef.current;
      audio.src = blobUrl;
      audio.load();
    } catch (e) {
      console.error('[AudioPlayer] fetch error:', e);
      setError(true);
      setLoading(false);
      loadedRef.current = false;
    }
  }, [src, attachListeners]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;

    // Lazy load: fetch audio on first play
    if (!loadedRef.current) {
      await loadAudio();
      // Wait for loadedmetadata before playing
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('error', onErr);
          resolve();
        };
        const onErr = () => {
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('error', onErr);
          reject();
        };
        if (audio.readyState >= 1) {
          resolve();
        } else {
          audio.addEventListener('loadedmetadata', onReady);
          audio.addEventListener('error', onErr);
        }
      });
    }

    if (audio.paused) {
      audio.play().catch((e) => {
        if (e.name !== 'AbortError') setError(true);
      });
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [loadAudio]);

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v: number) => {
    audioRef.current.volume = v;
    setVolumeState(v);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    loading,
    error,
    toggle,
    seek,
    setVolume,
    audioRef,
  };
}
