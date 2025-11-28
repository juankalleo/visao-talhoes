import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula área de polígono em metros quadrados.
 * Recebe coordenadas como array de [lon, lat] (graus).
 * Usa projeção WebMercator (EPSG:3857) + fórmula do polígono (shoelace).
 */
export function polygonAreaMeters(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;

  const R = 6378137; // raio da Terra em metros (WGS84)
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const project = (lon: number, lat: number) => {
    const x = deg2rad(lon) * R;
    const y = R * Math.log(Math.tan(Math.PI / 4 + deg2rad(lat) / 2));
    return [x, y];
  };

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[(i + 1) % coords.length];
    const [x1, y1] = project(lon1, lat1);
    const [x2, y2] = project(lon2, lat2);
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area) / 2;
}
