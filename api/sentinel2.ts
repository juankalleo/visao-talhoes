/**
 * Vercel Serverless Function para redirecionar requisições da API Sentinel-2
 * Executa o servidor Express como uma função serverless
 */
// @ts-ignore - VercelRequest/Response só existem em Vercel
import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

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
 * Converte XYZ tile para Quadkey (para Bing Maps)
 */
function quadKey(x: number, y: number, z: number): string {
  let quadKey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadKey += digit.toString();
  }
  return quadKey;
}

/**
 * Converte ReadableStream para Buffer
 */
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
}

/**
 * Gera um tile JPEG cinza (placeholder para erros)
 */
function generatePlaceholderTile(): Buffer {
  const jpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
  try {
    return Buffer.from(jpegBase64, 'base64');
  } catch (e) {
    return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
  }
}

/**
 * Gera um tile PNG verde (placeholder para NDVI)
 */
function generateGreenPlaceholderTile(): Buffer {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  try {
    return Buffer.from(pngBase64, 'base64');
  } catch (e) {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  }
}

/**
 * Gera um tile PNG azul (placeholder para NDMI)
 */
function generateBluePlaceholderTile(): Buffer {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12NgYPhQAEEAKUUIQQtfM6kAAAAASUVORK5CYII=';
  try {
    return Buffer.from(pngBase64, 'base64');
  } catch (e) {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  }
}

/**
 * Gera um tile PNG cinza (placeholder para NDBI)
 */
function generateGrayPlaceholderTile(): Buffer {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P8//8/AwYYAABGAAGsN7LrAAAAAElFTkSuQmCC';
  try {
    return Buffer.from(pngBase64, 'base64');
  } catch (e) {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  }
}

/**
 * GET /api/sentinel2/satellite-tiles/:z/:x/:y.jpg
 * Satellite True Color: Google → Bing → Placeholder
 */
app.get('/api/sentinel2/satellite-tiles/:z/:x/:y.jpg', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    console.log(`🛰️ TCI Request: ${z}/${x}/${y}`);

    // Fallback 1: Google Satellite
    try {
      const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const googleResponse = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (googleResponse.ok && googleResponse.body) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'google-satellite');
        console.log(`✅ Google Satellite: ${z}/${x}/${y}`);
        const buffer = await streamToBuffer(googleResponse.body);
        return res.send(buffer);
      }
    } catch (error) {
      console.warn(`⚠️ Google error`);
    }

    // Fallback 2: Bing Satellite
    try {
      const bingUrl = `https://ecn.t0.tiles.virtualearth.net/tiles/a${quadKey(tx, ty, zoom)}.jpeg?g=11911`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const bingResponse = await fetch(bingUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (bingResponse.ok && bingResponse.body) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'bing-satellite');
        console.log(`✅ Bing Satellite: ${z}/${x}/${y}`);
        const buffer = await streamToBuffer(bingResponse.body);
        return res.send(buffer);
      }
    } catch (error) {
      console.warn(`⚠️ Bing error`);
    }

    // Fallback 3: Placeholder
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    console.log(`❌ Usando placeholder`);
    return res.send(generatePlaceholderTile());
  } catch (error) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generatePlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndvi-tiles/:z/:x/:y.png
 * NDVI (Vegetation): Google Satellite fallback → Green placeholder
 */
app.get('/api/sentinel2/ndvi-tiles/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    console.log(`🌱 NDVI Request: ${z}/${x}/${y}`);

    // Fallback: Google Satellite
    try {
      const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const googleResponse = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (googleResponse.ok && googleResponse.body) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'google-satellite');
        console.log(`✅ Google NDVI: ${z}/${x}/${y}`);
        const buffer = await streamToBuffer(googleResponse.body);
        return res.send(buffer);
      }
    } catch (error) {
      console.warn(`⚠️ Google error`);
    }

    // Placeholder verde
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    console.log(`❌ Usando placeholder verde`);
    return res.send(generateGreenPlaceholderTile());
  } catch (error) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generateGreenPlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndmi-tiles/:z/:x/:y.png
 * NDMI (Moisture): Google Satellite fallback → Blue placeholder
 */
app.get('/api/sentinel2/ndmi-tiles/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    console.log(`💧 NDMI Request: ${z}/${x}/${y}`);

    // Fallback: Google Satellite
    try {
      const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const googleResponse = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (googleResponse.ok && googleResponse.body) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'google-satellite');
        console.log(`✅ Google NDMI: ${z}/${x}/${y}`);
        const buffer = await streamToBuffer(googleResponse.body);
        return res.send(buffer);
      }
    } catch (error) {
      console.warn(`⚠️ Google error`);
    }

    // Placeholder azul
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    console.log(`❌ Usando placeholder azul`);
    return res.send(generateBluePlaceholderTile());
  } catch (error) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generateBluePlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndbi-tiles/:z/:x/:y.png
 * NDBI (Built-up): Google Satellite fallback → Gray placeholder
 */
app.get('/api/sentinel2/ndbi-tiles/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    console.log(`🏙️ NDBI Request: ${z}/${x}/${y}`);

    // Fallback: Google Satellite
    try {
      const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const googleResponse = await fetch(googleUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (googleResponse.ok && googleResponse.body) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'google-satellite');
        console.log(`✅ Google NDBI: ${z}/${x}/${y}`);
        const buffer = await streamToBuffer(googleResponse.body);
        return res.send(buffer);
      }
    } catch (error) {
      console.warn(`⚠️ Google error`);
    }

    // Placeholder cinza
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    console.log(`❌ Usando placeholder cinza`);
    return res.send(generateGrayPlaceholderTile());
  } catch (error) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generateGrayPlaceholderTile());
  }
});

/**
 * Handler para Vercel
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
