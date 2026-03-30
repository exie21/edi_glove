export function formatMeters(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)} m`;
}

export function formatSpeed(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(2)} m/s`;
}

export function formatDegrees(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)} deg`;
}

export function formatLatLon(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string {
  if (latitude == null || longitude == null) {
    return 'n/a';
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function formatAge(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return 'n/a';
  }
  if (value < 1.0) {
    return `${Math.round(value * 1000)} ms`;
  }
  return `${value.toFixed(2)} s`;
}

export function formatMode(mode: string | null | undefined): string {
  if (!mode) {
    return 'Unknown';
  }
  return mode.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

