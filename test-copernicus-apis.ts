// Teste de diferentes endpoints do Copernicus
import fetch from 'node-fetch';

async function testTCI() {
  console.log('[TEST] Testando TCI (True Color Imagery) do Copernicus...\n');
  
  const url = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
  url.searchParams.set('service', 'WMS');
  url.searchParams.set('version', '1.3.0');
  url.searchParams.set('request', 'GetMap');
  url.searchParams.set('layers', 'SENTINEL2_L2A.TCI');
  url.searchParams.set('format', 'image/png');
  url.searchParams.set('srs', 'EPSG:3857');
  url.searchParams.set('width', '256');
  url.searchParams.set('height', '256');
  url.searchParams.set('bbox', '-7279251,-1174072,-7200979,-1095800');
  url.searchParams.set('time', '2025-12-07/2025-12-10');

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`[TEST] TCI Status: ${response.status}\n`);
    if (response.ok) {
      const buffer = await response.buffer();
      console.log(`[TEST] TCI Success: ${buffer.length} bytes\n`);
    } else {
      const text = await response.text();
      console.log(`[TEST] TCI Error: ${text.substring(0, 300)}\n`);
    }
  } catch (error) {
    console.error('[TEST] TCI Error:', error instanceof Error ? error.message : String(error));
  }
}

async function testProcessingAPI() {
  console.log('[TEST] Testando Processing API do Copernicus...\n');
  
  // Testar endpoint de processing (pode ser diferente)
  const url = 'https://sh.dataspace.copernicus.eu/api/v1/process';
  
  const payload = {
    input: {
      bounds: {
        bbox: [-7279251, -1174072, -7200979, -1095800],
        properties: { crs: 'EPSG:3857' }
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: {
              from: '2025-12-07T00:00:00Z',
              to: '2025-12-10T23:59:59Z'
            }
          },
          processing: {
            upsampling: 'NEAREST'
          }
        }
      ]
    },
    output: {
      width: 256,
      height: 256,
      responses: [
        {
          identifier: 'default',
          format: {
            type: 'image/png'
          }
        }
      ]
    },
    evalscript: `
      //VERSION=3
      function setup() {
        return {
          input: [{
            bands: ["B04", "B03", "B02", "dataMask"],
            units: "DN"
          }],
          output: {
            bands: 4,
            sampleType: "UINT8"
          }
        };
      }
      
      function evaluatePixel(sample) {
        return [sample.B04, sample.B03, sample.B02, sample.dataMask * 255];
      }
    `
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });
    console.log(`[TEST] Processing API Status: ${response.status}\n`);
    const text = await response.text();
    console.log(`[TEST] Processing API Response (first 500 chars):\n${text.substring(0, 500)}\n`);
  } catch (error) {
    console.error('[TEST] Processing API Error:', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  await testTCI();
  await testProcessingAPI();
  process.exit(0);
}

setTimeout(() => main(), 1000);
