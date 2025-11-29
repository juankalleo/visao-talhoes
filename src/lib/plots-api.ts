export interface CreatePlotPayload {
  id: string;
  name?: string;
  coordinates: [number, number][];
  centroid: { lon: number; lat: number };
  area_m2: number;
  createdAt: string;
  color?: string;
  number?: number;
  notifications?: { id: string; message: string; createdAt: string }[]; // <-- added
}

/**
 * Tenta criar o talhão no sistema (POST /api/plots).
 * Se não houver endpoint disponível, a chamada vai falhar e é tratada pelo chamador.
 */
export async function createPlotOnServer(payload: CreatePlotPayload) {
  const base = (import.meta.env.VITE_API_BASE as string) || '';
  const url = `${base}/api/plots`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create plot: ${text}`);
  }
  return res.json();
}