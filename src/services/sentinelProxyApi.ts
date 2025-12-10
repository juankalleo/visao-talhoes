/**
 * API Wrapper para Sentinel-2 Proxy
 * Chamadas ao backend - usa VITE_API_URL do ambiente
 */

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // Se estiver em Vercel (hostname !== localhost), API está no mesmo domínio
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.origin}`;
  }
  
  // Dev local
  return 'http://localhost:3001';
};

const API_BASE = getApiBase();

export interface STACSearchParams {
  bbox: [number, number, number, number];
  datetime: string;
  collections?: string[];
  limit?: number;
}

export interface WMSParams {
  layers: string;
  bbox: string;
  width?: number;
  height?: number;
  srs?: string;
}

/**
 * Busca dados Sentinel-2 usando STAC API via proxy
 */
export async function searchSentinel2(params: STACSearchParams): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/sentinel2/stac-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`STAC Search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ STAC Search Error:', error);
    throw error;
  }
}

/**
 * Gera URL de imagem WMS via proxy
 * Útil para passar ao MapLibre GL
 */
export function getWMSProxyUrl(params: WMSParams): string {
  const url = new URL(`${API_BASE}/sentinel2/wms`);

  url.searchParams.set('layers', params.layers);
  url.searchParams.set('bbox', params.bbox);
  url.searchParams.set('width', String(params.width || 512));
  url.searchParams.set('height', String(params.height || 512));
  url.searchParams.set('srs', params.srs || 'EPSG:3857');

  return url.toString();
}

/**
 * Obtém token de autenticação (se necessário)
 */
export async function authenticate(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/sentinel2/authenticate`, {
      method: 'GET'
    });

    if (!response.ok) {
      console.warn('Authentication failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('⚠️  Authentication not required or failed:', error);
    return null;
  }
}

/**
 * Verifica se o servidor proxy está rodando
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
