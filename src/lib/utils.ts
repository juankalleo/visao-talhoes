import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utilities for geospatial calculations
 */

/**
 * Calculate polygon area (m²) using Web Mercator projection + planar shoelace.
 * Input coords: array of [lon, lat] (degrees).
 * Suitable for small/medium polygons (agricultural plots).
 */
export function polygonAreaMeters(coords: [number, number][]) {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137; // earth radius in meters (WGS84)
  const deg2rad = Math.PI / 180;

  const project = (lon: number, lat: number) => {
    const x = R * lon * deg2rad;
    // Web Mercator Y
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * deg2rad) / 2));
    return { x, y };
  };

  const pts = coords.map(([lon, lat]) => project(lon, lat));
  // shoelace
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

// optional helper: centroid (simple average lon/lat)
export function polygonCentroid(coords: [number, number][]) {
  const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return { lon, lat };
}
