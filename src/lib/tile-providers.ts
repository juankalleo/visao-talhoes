/**
 * Múltiplos provedores de Sentinel-2 com fallback automático
 */

export interface TileProvider {
  name: string;
  url: string;
  description: string;
  priority: number;
}

// Provedores de Sentinel-2 ordenados por prioridade
export const SENTINEL_PROVIDERS: TileProvider[] = [
  {
    name: 'sentinel-hub-xyz',
    url: 'https://tiles.sentinel-hub.com/v1/abc/eop/tci/1/false/{z}/{x}/{y}.jpg?time=2025-11-01/2025-12-10&maxcc=20',
    description: 'Sentinel Hub XYZ Tiles (mais rápido)',
    priority: 1
  },
  {
    name: 'copernicus-wms',
    url: 'https://sh.dataspace.copernicus.eu/api/v1/wms',
    description: 'Copernicus WMS (mais controle)',
    priority: 2
  },
  {
    name: 'usgs-earth-explorer',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile',
    description: 'USGS Topo (fallback)',
    priority: 3
  }
];

// Provedores de índices espectrais
export const INDEX_PROVIDERS = {
  ndvi: {
    primary: 'copernicus-wms',
    layer: 'SENTINEL2_L2A.NDVI',
    colormap: 'viridis'
  },
  ndmi: {
    primary: 'copernicus-wms',
    layer: 'SENTINEL2_L2A.NDMI',
    colormap: 'viridis'
  },
  ndbi: {
    primary: 'copernicus-wms',
    layer: 'SENTINEL2_L2A.NDBI',
    colormap: 'viridis'
  }
};

// Configuração de timeout e retry
export const REQUEST_CONFIG = {
  timeout: 10000, // 10 segundos
  retries: 2,
  cache_ttl: 604800 // 7 dias
};
