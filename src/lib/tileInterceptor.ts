/**
 * TileURL Interceptor para MapLibre GL
 * Converte URLs diretas do Copernicus para passar pelo proxy do backend
 */

/**
 * Gera uma URL de proxy para tiles WMS do Copernicus
 * @param layers - Nome da camada WMS (ex: 'SENTINEL2_L2A.TCI_10m')
 * @param width - Largura do tile (normalmente 512 para WMS)
 * @param height - Altura do tile (normalmente 512 para WMS)
 * @param colormap - Colormap opcional para índices (ex: 'viridis')
 * @returns URL proxied apontando para nosso backend
 */
export function getProxyWmsUrl(
  layers: string,
  width: number = 512,
  height: number = 512,
  colormap?: string
): string {
  // Construir URL do proxy com variáveis de template que MapLibre vai substituir
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  let proxyUrl = `${apiUrl}/sentinel2/wms?`;
  proxyUrl += `layers=${encodeURIComponent(layers)}&`;
  proxyUrl += `format=image/png&`;
  proxyUrl += `srs=EPSG:3857&`;
  proxyUrl += `width=${width}&`;
  proxyUrl += `height=${height}`;
  
  if (colormap) {
    proxyUrl += `&colormap=${encodeURIComponent(colormap)}`;
  }

  // Adicionar o token de bbox que MapLibre vai substituir com coordenadas reais
  proxyUrl += '&bbox={bbox-epsg-3857}';

  return proxyUrl;
}

/**
 * Converte uma URL direta do Copernicus WMS para uma URL de proxy
 * @param directUrl - URL original do Copernicus WMS
 * @returns URL proxied apontando para nosso backend
 */
export function interceptMapLibreTileUrl(directUrl: string): string {
  // Formato esperado:
  // https://sh.dataspace.copernicus.eu/api/v1/wms?request=GetMap&service=WMS&version=1.3.0&layers=SENTINEL2_L2A.TCI_10m&format=image/png&srs=EPSG:3857&width=512&height=512&bbox={bbox-epsg-3857}
  
  try {
    // Extrair parâmetros da URL original
    const url = new URL(directUrl);
    const layers = url.searchParams.get('layers') || '';
    const width = parseInt(url.searchParams.get('width') || '512');
    const height = parseInt(url.searchParams.get('height') || '512');
    const colormap = url.searchParams.get('colormap') || undefined;

    const proxiedUrl = getProxyWmsUrl(layers, width, height, colormap);
    console.log(`🔄 Interceptando WMS: ${layers}`);
    console.log(`   Original: ${directUrl.substring(0, 80)}...`);
    console.log(`   Proxy: ${proxiedUrl}`);
    
    return proxiedUrl;
  } catch (error) {
    console.error('❌ Erro ao parsear URL:', directUrl, error);
    return directUrl;
  }
}

/**
 * Transforma todas as URLs de tile em um array para usar o proxy
 * @param tiles - Array de templates de URL de tiles
 * @returns Array de URLs transformadas usando o proxy
 */
export function transformMapLibreTiles(tiles: string[]): string[] {
  return tiles.map(tile => {
    // Verificar se é uma URL direta do Copernicus
    if (tile.includes('sh.dataspace.copernicus.eu')) {
      return interceptMapLibreTileUrl(tile);
    }
    // Caso contrário retornar sem mudanças
    return tile;
  });
}
