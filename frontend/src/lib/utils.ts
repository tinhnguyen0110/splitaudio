import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date string from the backend (UTC without Z suffix) into a Date object.
 * Ensures consistent UTC interpretation across all browsers.
 */
export function parseUTC(dateStr: string | number | null | undefined): Date {
  if (dateStr == null) return new Date(NaN);
  if (typeof dateStr === 'number') return new Date(dateStr);
  const str = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  return new Date(str);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(dateStr: string | number | null | undefined): string {
  if (dateStr == null) return '--';
  const now = Date.now();
  const parsed = parseUTC(dateStr).getTime();
  if (isNaN(parsed)) return '--';
  const diff = now - parsed;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return parseUTC(dateStr).toLocaleDateString();
}

/** Format a UTC date string as local date+time string */
export function formatLocalDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  return parseUTC(dateStr).toLocaleString();
}

/** Format a UTC date string as local time only */
export function formatLocalTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  return parseUTC(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Format a UTC date string as local date only */
export function formatLocalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  return parseUTC(dateStr).toLocaleDateString();
}
