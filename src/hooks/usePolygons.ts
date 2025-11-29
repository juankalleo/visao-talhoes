import { useEffect, useState } from 'react';
import { polygonAreaMeters, polygonCentroid } from '@/lib/utils';

export interface PlotNotification {
  id: string;
  message: string;
  createdAt: string;
}

export interface SavedPlot {
  id: string;
  name?: string;
  coordinates: [number, number][]; // [lon, lat]
  centroid: { lon: number; lat: number };
  area_m2: number;
  createdAt: string;
  color?: string;
  number?: number; // <-- ADDED: optional sequence/number
  notifications?: PlotNotification[]; // <-- ADDED: notifications list
}

const STORAGE_KEY = "semagric:polygons:v1";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function usePolygons() {
  const [polygons, setPolygons] = useState<SavedPlot[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPolygons(JSON.parse(raw) as SavedPlot[]);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(polygons));
    } catch (e) {
      // ignore
    }
  }, [polygons]);

  const addPolygon = (coords: [number, number][], name?: string, color?: string) => {
    const cleaned = coords.slice();
    const area_m2 = polygonAreaMeters(cleaned);
    const centroid = polygonCentroid(cleaned);
    const p: SavedPlot = {
      id: uid(),
      name,
      coordinates: cleaned,
      centroid,
      area_m2,
      createdAt: new Date().toISOString(),
      color: color ?? '#22c55e',
      // number may be assigned later by the server or caller (optional)
      notifications: [
        {
          id: uid(),
          message: 'notificação de demonstração',
          createdAt: new Date().toISOString()
        }
      ]
    };
    setPolygons((prev) => [p, ...prev]);
    return p;
  };

  const removePolygon = (id: string) => {
    setPolygons((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePolygon = (id: string, patch: Partial<SavedPlot>) => {
    setPolygons((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const clearAll = () => setPolygons([]);

  return {
    polygons,
    addPolygon,
    removePolygon,
    updatePolygon,
    clearAll,
  };
}