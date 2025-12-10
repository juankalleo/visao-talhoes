/**
 * Vercel Serverless Function para redirecionar requisições da API
 * Executa o servidor Express como uma função serverless
 */
import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import sharp from 'sharp';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Criar instância Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Função para obter token OAuth2 do Copernicus
 */
async function getOAuth2Token(): Promise<string | null> {
  try {
    const clientId = process.env.COPERNICUS_CLIENT_ID;
    const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('⚠️ Copernicus credentials not configured');
      return null;
    }

    const response = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      console.error(`OAuth2 Error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    return data.access_token;
  } catch (error) {
    console.error('OAuth2 Token Error:', error);
    return null;
  }
}

/**
 * Função para buscar tiles do Copernicus com autenticação
 */
async function fetchIndexTileFromCopernicus(
  indexType: 'ndvi' | 'ndmi' | 'ndbi',
  bbox: string,
  dateRange: string
): Promise<Buffer | null> {
  try {
    const layerMap = {
      'ndvi': 'SENTINEL2_L2A.NDVI',
      'ndmi': 'SENTINEL2_L2A.NDMI',
      'ndbi': 'SENTINEL2_L2A.NDBI'
    };

    const colormapMap = {
      'ndvi': 'viridis',
      'ndmi': 'blues',
      'ndbi': 'greys'
    };

    const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
    wmsUrl.searchParams.set('request', 'GetMap');
    wmsUrl.searchParams.set('service', 'WMS');
    wmsUrl.searchParams.set('version', '1.3.0');
    wmsUrl.searchParams.set('layers', layerMap[indexType]);
    wmsUrl.searchParams.set('format', 'image/png');
    wmsUrl.searchParams.set('srs', 'EPSG:3857');
    wmsUrl.searchParams.set('width', '256');
    wmsUrl.searchParams.set('height', '256');
    wmsUrl.searchParams.set('bbox', bbox);
    wmsUrl.searchParams.set('time', dateRange);
    wmsUrl.searchParams.set('colormap', colormapMap[indexType]);

    // Tentar obter token para autenticação
    let token: string | null = null;
    try {
      token = await getOAuth2Token();
    } catch (err) {
      console.warn('Could not get OAuth token, trying without auth');
    }

    const headers: any = {
      'Accept': 'image/png',
      'User-Agent': 'Mozilla/5.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(wmsUrl.toString(), {
      method: 'GET',
      headers
    });

    console.log(`📊 ${indexType.toUpperCase()} Response: ${response.status}`);

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ ${indexType.toUpperCase()} Success: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.warn(`⚠️ ${indexType.toUpperCase()} Error: ${msg}`);
    return null;
  }
}

/**
 * Gera tile PNG para fallback visual
 */
async function generateIndexTile(
  indexType: 'ndvi' | 'ndmi' | 'ndbi',
  z: number,
  x: number,
  y: number
): Promise<Buffer> {
  const width = 256;
  const height = 256;

  const seed = (z * 73856093 ^ x * 19349663 ^ y * 83492791) >>> 0;
  const pseudoRandom = (seed % 256) / 256;

  let r, g, b;

  if (indexType === 'ndvi') {
    if (pseudoRandom < 0.3) {
      r = Math.floor(200 + pseudoRandom * 55);
      g = Math.floor(100 + pseudoRandom * 30);
      b = Math.floor(50 + pseudoRandom * 20);
    } else if (pseudoRandom < 0.6) {
      r = Math.floor(200 + pseudoRandom * 55);
      g = Math.floor(180 + pseudoRandom * 75);
      b = Math.floor(50 + pseudoRandom * 20);
    } else {
      r = Math.floor(50 + pseudoRandom * 50);
      g = Math.floor(150 + pseudoRandom * 100);
      b = Math.floor(50 + pseudoRandom * 50);
    }
  } else if (indexType === 'ndmi') {
    if (pseudoRandom < 0.33) {
      r = Math.floor(160 + pseudoRandom * 60);
      g = Math.floor(120 + pseudoRandom * 40);
      b = Math.floor(80 + pseudoRandom * 40);
    } else if (pseudoRandom < 0.66) {
      r = Math.floor(100 + pseudoRandom * 80);
      g = Math.floor(150 + pseudoRandom * 100);
      b = Math.floor(180 + pseudoRandom * 75);
    } else {
      r = Math.floor(50 + pseudoRandom * 80);
      g = Math.floor(150 + pseudoRandom * 100);
      b = Math.floor(180 + pseudoRandom * 75);
    }
  } else {
    if (pseudoRandom < 0.5) {
      r = Math.floor(150 + pseudoRandom * 60);
      g = Math.floor(150 + pseudoRandom * 60);
      b = Math.floor(150 + pseudoRandom * 60);
    } else {
      r = Math.floor(50 + pseudoRandom * 100);
      g = Math.floor(50 + pseudoRandom * 100);
      b = Math.floor(50 + pseudoRandom * 100);
    }
  }

  const pixelArray: number[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const variation = ((row + col) % 256) / 256;
      const finalR = Math.max(0, Math.min(255, Math.floor(r + (variation * 30 - 15))));
      const finalG = Math.max(0, Math.min(255, Math.floor(g + (variation * 30 - 15))));
      const finalB = Math.max(0, Math.min(255, Math.floor(b + (variation * 30 - 15))));

      pixelArray.push(finalR);
      pixelArray.push(finalG);
      pixelArray.push(finalB);
      pixelArray.push(200);
    }
  }

  const buffer = Buffer.from(pixelArray);
  const pngBuffer = await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  return pngBuffer;
}

/**
 * GET /api/sentinel2/ndvi-visual/:z/:x/:y.png
 */
app.get('/ndvi-visual/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    let tile = await fetchIndexTileFromCopernicus('ndvi', bbox, dateRange);

    if (!tile) {
      tile = await generateIndexTile('ndvi', zoom, tx, ty);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(tile);
  } catch (error) {
    console.error('NDVI Error:', error);
    res.status(500).send('Error generating tile');
  }
});

/**
 * GET /api/sentinel2/ndmi-visual/:z/:x/:y.png
 */
app.get('/ndmi-visual/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    let tile = await fetchIndexTileFromCopernicus('ndmi', bbox, dateRange);

    if (!tile) {
      tile = await generateIndexTile('ndmi', zoom, tx, ty);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(tile);
  } catch (error) {
    console.error('NDMI Error:', error);
    res.status(500).send('Error generating tile');
  }
});

/**
 * GET /api/sentinel2/ndbi-visual/:z/:x/:y.png
 */
app.get('/ndbi-visual/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    let tile = await fetchIndexTileFromCopernicus('ndbi', bbox, dateRange);

    if (!tile) {
      tile = await generateIndexTile('ndbi', zoom, tx, ty);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(tile);
  } catch (error) {
    console.error('NDBI Error:', error);
    res.status(500).send('Error generating tile');
  }
});

/**
 * Handler para a Vercel
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
