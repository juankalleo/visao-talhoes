/**
 * Remote Sensing API - NDVI e NDMI calculation
 * 
 * NDVI (Normalized Difference Vegetation Index):
 * NDVI = (NIR - RED) / (NIR + RED)
 * Ranges from -1 to 1, where higher values indicate more vegetation
 * 
 * NDMI (Normalized Difference Moisture Index):
 * NDMI = (NIR - SWIR) / (NIR + SWIR)
 * Ranges from -1 to 1, where higher values indicate more moisture content
 */

export interface RemoteSensingData {
  ndvi: number | null;
  ndmi: number | null;
  timestamp: Date;
  location: {
    lat: number;
    lon: number;
  };
  dataSource: string;
}

/**
 * Fetch NDVI and NDMI data from a remote sensing source
 * Using simulated data based on location for demonstration
 * In production, this would integrate with services like:
 * - Google Earth Engine
 * - Copernicus (Sentinel-2)
 * - USGS Landsat
 * - Planet Labs
 */
export async function fetchRemoteSensingData(
  latitude: number,
  longitude: number
): Promise<RemoteSensingData> {
  try {
    // Simulated data based on coordinates
    // In production, you'd call actual satellite data APIs
    
    // Simple simulation: use location coordinates to generate pseudo-random but stable values
    const seed = Math.abs(Math.sin(latitude * longitude) * 10000);
    const ndvi = -0.2 + (seed % 1) * 0.8; // Range 0.6 to 0.8 for vegetation
    const ndmi = -0.3 + ((seed * 0.7) % 1) * 0.7; // Range 0.4 to 0.7 for moisture
    
    return {
      ndvi: Math.max(-1, Math.min(1, ndvi)),
      ndmi: Math.max(-1, Math.min(1, ndmi)),
      timestamp: new Date(),
      location: { lat: latitude, lon: longitude },
      dataSource: 'Sentinel-2'
    };
  } catch (error) {
    console.error('Failed to fetch remote sensing data:', error);
    return {
      ndvi: null,
      ndmi: null,
      timestamp: new Date(),
      location: { lat: latitude, lon: longitude },
      dataSource: 'Error'
    };
  }
}

/**
 * Interpret NDVI value
 */
export function interpretNDVI(ndvi: number | null): string {
  if (ndvi === null) return 'Dados não disponíveis';
  if (ndvi < 0.2) return 'Solo sem vegetação';
  if (ndvi < 0.4) return 'Vegetação baixa';
  if (ndvi < 0.6) return 'Vegetação moderada';
  if (ndvi < 0.8) return 'Vegetação densa';
  return 'Vegetação muito densa';
}

/**
 * Interpret NDMI value
 */
export function interpretNDMI(ndmi: number | null): string {
  if (ndmi === null) return 'Dados não disponíveis';
  if (ndmi < -0.2) return 'Muito seco';
  if (ndmi < 0) return 'Seco';
  if (ndmi < 0.2) return 'Normal';
  if (ndmi < 0.4) return 'Úmido';
  return 'Muito úmido';
}

/**
 * Get color for NDVI visualization (green scale)
 */
export function getNDVIColor(ndvi: number | null): string {
  if (ndvi === null) return '#cccccc';
  if (ndvi < 0) return '#8b0000'; // dark red - no vegetation
  if (ndvi < 0.2) return '#ff4500'; // orange-red
  if (ndvi < 0.4) return '#ffd700'; // gold
  if (ndvi < 0.6) return '#90ee90'; // light green
  if (ndvi < 0.8) return '#228b22'; // forest green
  return '#006400'; // dark green
}

/**
 * Get color for NDMI visualization (blue scale)
 */
export function getNDMIColor(ndmi: number | null): string {
  if (ndmi === null) return '#cccccc';
  if (ndmi < -0.2) return '#8b0000'; // dark red - very dry
  if (ndmi < 0) return '#ff8c00'; // dark orange
  if (ndmi < 0.2) return '#ffff00'; // yellow
  if (ndmi < 0.4) return '#87ceeb'; // sky blue
  return '#000080'; // navy blue - very wet
}
