// Script para testar GetCapabilities do Copernicus WMS
import fetch from 'node-fetch';

async function testCapabilities() {
  const baseUrl = 'https://sh.dataspace.copernicus.eu/api/v1/wms';
  
  const url = new URL(baseUrl);
  url.searchParams.set('service', 'WMS');
  url.searchParams.set('version', '1.3.0');
  url.searchParams.set('request', 'GetCapabilities');

  console.log('[TEST] Consultando GetCapabilities...\n');
  console.log('URL:', url.toString().substring(0, 100) + '...\n');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    console.log(`[TEST] Status: ${response.status}\n`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[TEST] Error response:\n${text.substring(0, 500)}\n`);
      return;
    }

    const text = await response.text();
    
    // Procurar por camadas SENTINEL2
    const lines = text.split('\n');
    console.log('[TEST] Procurando camadas SENTINEL2...\n');
    
    let foundLayers = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('SENTINEL2') || line.includes('Sentinel-2') || 
          line.includes('sentinel-2') || line.includes('NDVI') || 
          line.includes('NDMI') || line.includes('NDBI')) {
        
        // Imprimir contexto (3 linhas antes e depois)
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        
        console.log(`--- Encontrado na linha ${i} ---`);
        for (let j = start; j < end; j++) {
          console.log(lines[j].substring(0, 120));
        }
        console.log('');
        foundLayers = true;
      }
    }

    if (!foundLayers) {
      console.log('[TEST] Nenhuma camada SENTINEL2 encontrada');
      console.log('[TEST] Primeiras 2000 caracteres da resposta:\n');
      console.log(text.substring(0, 2000));
    }

  } catch (error) {
    console.error('[TEST] Error:', error instanceof Error ? error.message : String(error));
  }
}

// Testa também uma requisição GetMap para ver erro específico
async function testGetMapError() {
  console.log('\n\n=== Testando GetMap para ver erro específico ===\n');
  
  const url = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
  url.searchParams.set('service', 'WMS');
  url.searchParams.set('version', '1.3.0');
  url.searchParams.set('request', 'GetMap');
  url.searchParams.set('layers', 'SENTINEL2_L2A.NDVI');
  url.searchParams.set('format', 'image/png');
  url.searchParams.set('srs', 'EPSG:3857');
  url.searchParams.set('width', '256');
  url.searchParams.set('height', '256');
  url.searchParams.set('bbox', '-7279251,-1174072,-7200979,-1095800');
  url.searchParams.set('time', '2025-12-07/2025-12-10');
  url.searchParams.set('colormap', 'viridis');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    console.log(`[TEST] GetMap Response: ${response.status}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[TEST] Error body (first 1000 chars):');
      console.log(text.substring(0, 1000));
    }
  } catch (error) {
    console.error('[TEST] GetMap Error:', error instanceof Error ? error.message : String(error));
  }
}

setTimeout(async () => {
  await testCapabilities();
  await testGetMapError();
  process.exit(0);
}, 1000);
