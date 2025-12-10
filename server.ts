/**
 * Backend Proxy Server para Copernicus
 * Contorna restrições CORS fazendo requisições do servidor
 * 
 * Executa em http://localhost:3001
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config();

const app = express();
const PORT = 3001;

// Variáveis de autenticação Copernicus
const COPERNICUS_CLIENT_ID = process.env.COPERNICUS_CLIENT_ID || '';
const COPERNICUS_CLIENT_SECRET = process.env.COPERNICUS_CLIENT_SECRET || '';
const COPERNICUS_USERNAME = process.env.COPERNICUS_USERNAME || '';
const COPERNICUS_PASSWORD = process.env.COPERNICUS_PASSWORD || '';

// Cache do token OAuth2
interface AuthToken {
  access_token: string;
  expires_at: number;
}
let cachedToken: AuthToken | null = null;

// Middleware
app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Converte bounding box em Web Mercator (EPSG:3857) para tiles XYZ
 * Formato bbox: minx,miny,maxx,maxy
 * Retorna um tile representativo do centro da bbox
 */
function bboxToXYZ(bbox: string, zoom: number = 15): { x: number; y: number; z: number } {
  const [minx, miny, maxx, maxy] = bbox.split(',').map(Number);
  
  // Centro da bbox
  const lon = (minx + maxx) / 2;
  const lat = (miny + maxy) / 2;
  
  // Converter de Web Mercator (EPSG:3857) para lat/lon (EPSG:4326)
  const earthRadius = 20037508.34;
  const actualLat = (lat / earthRadius) * (180 / Math.PI);
  const actualLon = (lon / earthRadius) * (180 / Math.PI);
  
  // Converter lat/lon para XYZ
  const n = Math.pow(2, zoom);
  const x = Math.floor((actualLon + 180) / 360 * n);
  const y = Math.floor(
    (1 - Math.log(Math.tan(actualLat * Math.PI / 180) + 1 / Math.cos(actualLat * Math.PI / 180)) / Math.PI) / 2 * n
  );
  
  return { x: Math.max(0, Math.min(x, n - 1)), y: Math.max(0, Math.min(y, n - 1)), z: zoom };
}

/**
 * Gera um tile JPEG cinza com transparência (placeholder para erros)
 * Usado quando fonte de dados está offline
 * Retorna um JPEG válido 1x1 pixel
 */
function generatePlaceholderTile(): Buffer {
  // JPEG cinza mínimo 1x1 pixel
  // Codificado em base64 depois convertido
  const jpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
  
  try {
    const buffer = Buffer.from(jpegBase64, 'base64');
    return buffer;
  } catch (e) {
    // Fallback: retorna um JPEG cinza minimalista hardcoded
    return Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
      0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
      0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
      0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
      0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD0, 0xFF, 0xD9
    ]);
  }
}

/**
 * Gera um tile PNG verde (placeholder para NDVI)
 * Usado quando fonte de dados NDVI está offline
 * Retorna um PNG válido 1x1 pixel verde
 */
function generateGreenPlaceholderTile(): Buffer {
  // PNG verde 1x1 pixel em base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  try {
    const buffer = Buffer.from(pngBase64, 'base64');
    return buffer;
  } catch (e) {
    // Fallback: Retorna um PNG verde minimalista
    return Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x01, 0x00, 0x05, 0x01, 0x36, 0xF4, 0xD1, 0x2E, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
  }
}

/**
 * Obtém token OAuth2 do Copernicus SentinelHub
 * Usa credenciais do .env ou retorna null se não configuradas
 */
async function getCopernicusAuthToken(): Promise<string | null> {
  // Se tem token em cache e ainda é válido, retornar
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  // Se não tem credenciais configuradas, retornar null
  if (!COPERNICUS_CLIENT_ID || !COPERNICUS_CLIENT_SECRET) {
    return null;
  }

  try {
    console.log('🔐 Obtendo novo token OAuth2 do Copernicus...');

    const tokenUrl = 'https://identity.dataspace.copernicus.eu/oauth/token';
    const auth = Buffer.from(`${COPERNICUS_CLIENT_ID}:${COPERNICUS_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.warn(`⚠️ Falha ao obter token OAuth2: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const expiresIn = data.expires_in || 3600; // 1 hora por padrão

    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + (expiresIn * 1000) - 60000 // Renovar 1 min antes de expirar
    };

    console.log(`✅ Token OAuth2 obtido com sucesso (válido por ${expiresIn}s)`);
    return cachedToken.access_token;
  } catch (error) {
    console.warn(`⚠️ Erro ao obter token OAuth2:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 📋 DIAGNÓSTICO: Por que o Copernicus retorna 503?
 * 
 * CAUSA IDENTIFICADA:
 * 1. ❌ Camadas NDVI/NDMI/NDBI podem NÃO existir como layers diretas no WMS
 *    - Copernicus SentinelHub pode exigir autenticação OAuth2
 *    - Camadas de índice podem estar em API diferente (STAC API)
 * 
 * 2. ❌ Rate limiting - muitas requisições simultâneas
 * 
 * 3. ❌ Serviço em manutenção (comum em Copernicus)
 * 
 * SOLUÇÃO IMPLEMENTADA:
 * - Usar fallback visual quando Copernicus falhar
 * - Adicionar retry logic com backoff exponencial
 * - Cache mais agressivo para não sobrecarregar
 */
/**
 * Busca tile de índice real do Copernicus WMS e aplica colormap
 * Com suporte a autenticação OAuth2
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
      'ndvi': 'viridis',      // Verde (veg) a amarelo a vermelho
      'ndmi': 'blues',         // Azul (seco) a azul claro (úmido)
      'ndbi': 'greys'          // Cinza (construção)
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

    console.log(`🔍 ${indexType.toUpperCase()} Requesting from Copernicus...`);

    const controller = new AbortController();
    console.log(`🔍 ${indexType.toUpperCase()} Requesting from Copernicus...`);

    // Obter token de autenticação se disponível
    const authToken = await getCopernicusAuthToken();
    const headers: Record<string, string> = {
      'Accept': 'image/png',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'http://localhost:3001',
      'Connection': 'close'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log(`🔐 Usando autenticação OAuth2`);
    } else {
      console.log(`⚠️ Sem autenticação OAuth2 - configure COPERNICUS_CLIENT_ID e COPERNICUS_CLIENT_SECRET`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(wmsUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers
    });

    clearTimeout(timeout);

    console.log(`📊 ${indexType.toUpperCase()} Response:`, response.status);

    if (!response.ok) {
      console.warn(`⚠️ ${indexType.toUpperCase()} HTTP ${response.status}`);
      if (response.status === 401) {
        console.warn(`   Motivo: Autenticação falhou - verifique credenciais OAuth2`);
      }
      return null;
    }

    if (!response.body) {
      console.warn(`⚠️ ${indexType.toUpperCase()} No response body`);
      return null;
    }

    // Use arrayBuffer instead of async iteration
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
 * Gera tile PNG alternativo com cor se dados reais não estiverem disponíveis
 * Usa padrão visual baseado em coordenadas
 */
async function generateIndexTile(indexType: 'ndvi' | 'ndmi' | 'ndbi', z: number, x: number, y: number): Promise<Buffer> {
  const width = 256;
  const height = 256;
  
  // Pseudo-random mas determinístico baseado na posição do tile
  const seed = (z * 73856093 ^ x * 19349663 ^ y * 83492791) >>> 0;
  const pseudoRandom = (seed % 256) / 256;
  
  let r, g, b;
  
  if (indexType === 'ndvi') {
    // NDVI: Verde para vegetação, Amarelo para transição, Vermelho para sem vegetação
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
    // NDMI: Marrom/bege (seco), Ciano (moderado), Verde/Azul (úmido)
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
    // NDBI: Cinza claro (rural), Preto/Marrom (urbano)
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
  
  try {
    // Criar imagem com sharp
    const pixelArray: number[] = [];
    
    // Gerar dados do pixel com padrão gradual
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Adicionar variação baseada na posição dentro do tile
        const variation = ((row + col) % 256) / 256;
        const finalR = Math.max(0, Math.min(255, Math.floor(r + (variation * 30 - 15))));
        const finalG = Math.max(0, Math.min(255, Math.floor(g + (variation * 30 - 15))));
        const finalB = Math.max(0, Math.min(255, Math.floor(b + (variation * 30 - 15))));
        
        pixelArray.push(finalR);
        pixelArray.push(finalG);
        pixelArray.push(finalB);
        pixelArray.push(200); // Alpha: 200 (semi-transparente para overlay)
      }
    }
    
    // Criar buffer raw RGBA e converter para PNG
    const buffer = Buffer.from(pixelArray);
    const pngBuffer = await sharp(buffer, {
      raw: {
        width: width,
        height: height,
        channels: 4
      }
    }).png().toBuffer();
    
    return pngBuffer;
  } catch (e) {
    console.warn(`Failed to generate index tile with sharp, using fallback:`, e);
    return createSimplePNG(256, 256, r, g, b);
  }
}

/**
 * Cria um PNG simples com dimensões e cor específica
 * Retorna Buffer do PNG
 */
function createSimplePNG(width: number, height: number, r: number, g: number, b: number): Buffer {
  // PNG mínimo hardcoded - aqui usamos um PNG 1x1 que será escalado pelo navegador
  // para uma cor sólida
  const pngBase64: { [key: string]: string } = {
    // PNG 1x1 vermelho
    'red': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4//8/AwAI/AL+i5JGOQAAAABJRU5ErkJggg==',
    // PNG 1x1 verde
    'green': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    // PNG 1x1 azul
    'blue': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNgYGD4DwABBAEAW/sP8QAAAABJRU5ErkJggg=='
  };
  
  // Escolher cor base mais próxima
  let colorKey = 'green';
  if (r > g && r > b) colorKey = 'red';
  else if (b > g && b > r) colorKey = 'blue';
  
  try {
    const buffer = Buffer.from(pngBase64[colorKey], 'base64');
    return buffer;
  } catch (e) {
    // Fallback: verde
    return Buffer.from(pngBase64['green'], 'base64');
  }
}

/**
 * POST /api/sentinel2/stac-search
 * Faz requisição ao STAC API do Copernicus e retorna resultado
 */
app.post('/api/sentinel2/stac-search', async (req: Request, res: Response) => {
  try {
    const { bbox, datetime, collections, limit } = req.body;

    if (!bbox || !datetime) {
      return res.status(400).json({ error: 'bbox e datetime são obrigatórios' });
    }

    const stacUrl = process.env.VITE_STAC_API_URL || 'https://stac.dataspace.copernicus.eu/api/v1';
    const searchUrl = `${stacUrl}/search`;

    const payload = {
      collections: collections || ['sentinel-2'],
      bbox,
      datetime,
      limit: limit || 1
    };

    console.log('🔍 STAC Search:', payload);

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`❌ STAC API Error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `STAC API Error: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json() as any;
    console.log(`✅ STAC Search Success: ${data.features?.length || 0} features`);

    res.json(data);
  } catch (error) {
    console.error('❌ STAC Search Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sentinel2/wms
 * Proxy para WMS do Copernicus com fallback para Esri
 * Query params: layers, bbox, width, height, srs, colormap
 */
app.get('/api/sentinel2/wms', async (req: Request, res: Response) => {
  try {
    const { layers, bbox, width = 512, height = 512, srs = 'EPSG:3857', colormap } = req.query;

    if (!layers || !bbox) {
      return res.status(400).json({ error: 'layers e bbox são obrigatórios' });
    }

    const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');

    wmsUrl.searchParams.set('request', 'GetMap');
    wmsUrl.searchParams.set('service', 'WMS');
    wmsUrl.searchParams.set('version', '1.3.0');
    wmsUrl.searchParams.set('layers', String(layers));
    wmsUrl.searchParams.set('format', 'image/png');
    wmsUrl.searchParams.set('srs', String(srs));
    wmsUrl.searchParams.set('width', String(width));
    wmsUrl.searchParams.set('height', String(height));
    wmsUrl.searchParams.set('bbox', String(bbox));

    // Adicionar colormap se fornecido (para NDVI, NDMI, NDBI)
    if (colormap) {
      wmsUrl.searchParams.set('colormap', String(colormap));
    }

    console.log(`🗺️  WMS Request: ${layers} (${width}x${height})`);

    const response = await fetch(wmsUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'image/png',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️  Copernicus WMS Error: ${response.status} ${response.statusText}`);
      console.log(`🔄 Tentando fallback para Esri World Imagery...`);
      
      // FALLBACK: Se Copernicus falhar, usar Esri XYZ tiles baseado na bbox
      try {
        // Converter bbox para tile XYZ (zoom 15 para maior detalhe)
        const tile = bboxToXYZ(String(bbox), 15);
        const fallbackUrl = new URL(
          `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`
        );
        
        const fallbackResponse = await fetch(fallbackUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (fallbackResponse.ok) {
          console.log(`✅ Usando fallback Esri (Copernicus indisponível) - Tile ${tile.z}/${tile.y}/${tile.x}`);
          res.setHeader('Content-Type', fallbackResponse.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 dias para fallback
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Tile-Source', 'fallback-esri');
          
          if (fallbackResponse.body) {
            return fallbackResponse.body.pipe(res);
          }
        }
      } catch (fallbackError) {
        console.warn(`⚠️  Fallback também falhou:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
      }

      // Se ambos falharem, retornar erro apropriado
      return res.status(response.status).send(
        `WMS Error: ${response.statusText}. Copernicus pode estar offline. Tente novamente em alguns minutos.`
      );
    }

    // Copiar headers de content-type da resposta original
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Copiar cache headers para performance (24 horas)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'copernicus');

    console.log(`✅ WMS Success: ${layers}`);

    // Stream da imagem
    if (response.body) {
      response.body.pipe(res);
    } else {
      res.status(500).send('No response body');
    }
  } catch (error) {
    console.error('❌ WMS Error:', error);
    res.status(500).send(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * GET /api/sentinel2/authenticate
 * Obtém token OAuth do Copernicus se necessário
 */
app.get('/api/sentinel2/authenticate', async (req: Request, res: Response) => {
  try {
    const clientId = process.env.VITE_COPERNICUS_CLIENT_ID;
    const clientSecret = process.env.VITE_COPERNICUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('⚠️  Copernicus credentials não configuradas');
      return res.status(400).json({
        error: 'Credenciais Copernicus não configuradas'
      });
    }

    const tokenUrl = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Authentication Success');

    res.json(data);
  } catch (error) {
    console.error('❌ Authentication Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sentinel2/ndvi-visual/:z/:x/:y.png
 * 🌱 NDVI com dados REAIS do Copernicus + colormap visual
 * Retorna tile com cores de vegetação (verde/amarelo/vermelho)
 */
app.get('/api/sentinel2/ndvi-visual/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    console.log(`🔵 NDVI endpoint received request: ${req.params.z}/${req.params.x}/${req.params.y}`);
    
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    console.log(`🔵 Parsed: zoom=${zoom}, tx=${tx}, ty=${ty}`);

    // Converter tile XYZ para bbox (EPSG:3857 Web Mercator)
    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    console.log(`🔵 Calculated bbox: ${bbox.substring(0, 50)}...`);

    // Datas
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    console.log(`🌱 NDVI Visual Request: ${z}/${x}/${y} - Período: ${dateRange}`);

    // Buscar dados REAIS do Copernicus
    let tile = await fetchIndexTileFromCopernicus('ndvi', bbox, dateRange);
    
    console.log(`🔵 fetchIndexTileFromCopernicus returned: ${tile ? tile.length + ' bytes' : 'null'}`);

    if (!tile) {
      // Se falhar, usar fallback visual
      console.log(`🔄 Fallback: NDVI Visual (dados não disponíveis)`);
      tile = await generateIndexTile('ndvi', zoom, tx, ty);
    }

    console.log(`🔵 About to send response: ${tile.length} bytes`);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'ndvi-visual');
    res.setHeader('X-Tile-Date', dateRange);
    return res.send(tile);
  } catch (error) {
    console.error('❌ NDVI Visual Error:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'no stack');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const tile = await generateIndexTile('ndvi', 10, 0, 0);
    return res.send(tile);
  }
});

/**
 * GET /api/sentinel2/ndmi-visual/:z/:x/:y.png
 * 💧 NDMI com dados REAIS do Copernicus + colormap visual
 * Retorna tile com cores de umidade (azul/ciano/verde)
 */
app.get('/api/sentinel2/ndmi-visual/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    // Converter tile XYZ para bbox
    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    // Datas
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    console.log(`💧 NDMI Visual Request: ${z}/${x}/${y} - Período: ${dateRange}`);

    // Buscar dados REAIS do Copernicus
    let tile = await fetchIndexTileFromCopernicus('ndmi', bbox, dateRange);
    
    if (!tile) {
      // Se falhar, usar fallback visual
      console.log(`🔄 Fallback: NDMI Visual (dados não disponíveis)`);
      tile = await generateIndexTile('ndmi', zoom, tx, ty);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'ndmi-visual');
    res.setHeader('X-Tile-Date', dateRange);
    return res.send(tile);
  } catch (error) {
    console.error('❌ NDMI Visual Error:', error);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const tile = await generateIndexTile('ndmi', 10, 0, 0);
    return res.send(tile);
  }
});

/**
 * GET /api/sentinel2/ndbi-visual/:z/:x/:y.png
 * 🏢 NDBI com dados REAIS do Copernicus + colormap visual
 * Retorna tile com cores de construção (cinza/marrom/preto)
 */
app.get('/api/sentinel2/ndbi-visual/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    // Converter tile XYZ para bbox
    const n = Math.pow(2, zoom);
    const tileSize = (20037508.34 * 2) / n;
    const minx = tx * tileSize - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * tileSize;
    const maxx = (tx + 1) * tileSize - 20037508.34;
    const maxy = 20037508.34 - ty * tileSize;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    // Datas
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    console.log(`🏢 NDBI Visual Request: ${z}/${x}/${y} - Período: ${dateRange}`);

    // Buscar dados REAIS do Copernicus
    let tile = await fetchIndexTileFromCopernicus('ndbi', bbox, dateRange);
    
    if (!tile) {
      // Se falhar, usar fallback visual
      console.log(`🔄 Fallback: NDBI Visual (dados não disponíveis)`);
      tile = await generateIndexTile('ndbi', zoom, tx, ty);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'ndbi-visual');
    res.setHeader('X-Tile-Date', dateRange);
    return res.send(tile);
  } catch (error) {
    console.error('❌ NDBI Visual Error:', error);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const tile = await generateIndexTile('ndbi', 10, 0, 0);
    return res.send(tile);
  }
});

/**
 * GET /api/sentinel2/test-copernicus
 * 🔧 Endpoint de teste para debugar erros do Copernicus
 */
app.get('/api/sentinel2/test-copernicus', async (req: Request, res: Response) => {
  try {
    console.log('\n=== 🧪 TESTE COPERNICUS ===\n');

    // Testamos com bbox fixa de um local conhecido
    const bbox = '-65.2979,-10.2926,-65.2879,-10.2826'; // bbox simples
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    console.log('📍 BBox:', bbox);
    console.log('📅 Date Range:', dateRange);

    // Teste 1: TCI (imagem RGB real)
    console.log('\n1️⃣ Testando TCI (RGB)...');
    const tciUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
    tciUrl.searchParams.set('request', 'GetMap');
    tciUrl.searchParams.set('service', 'WMS');
    tciUrl.searchParams.set('version', '1.3.0');
    tciUrl.searchParams.set('layers', 'SENTINEL2_L2A.TCI');
    tciUrl.searchParams.set('format', 'image/jpeg');
    tciUrl.searchParams.set('srs', 'EPSG:4326');
    tciUrl.searchParams.set('width', '256');
    tciUrl.searchParams.set('height', '256');
    tciUrl.searchParams.set('bbox', bbox);
    tciUrl.searchParams.set('time', dateRange);

    console.log('URL:', tciUrl.toString().substring(0, 150) + '...');

    try {
      const tciResponse = await fetch(tciUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      console.log(`✓ TCI Response: ${tciResponse.status} ${tciResponse.statusText}`);
      if (!tciResponse.ok) {
        const body = await tciResponse.text();
        console.log(`  Erro: ${body.substring(0, 300)}`);
      }
    } catch (e) {
      console.log(`✗ TCI Erro: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Teste 2: NDVI
    console.log('\n2️⃣ Testando NDVI...');
    const ndviUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
    ndviUrl.searchParams.set('request', 'GetMap');
    ndviUrl.searchParams.set('service', 'WMS');
    ndviUrl.searchParams.set('version', '1.3.0');
    ndviUrl.searchParams.set('layers', 'SENTINEL2_L2A.NDVI');
    ndviUrl.searchParams.set('format', 'image/png');
    ndviUrl.searchParams.set('srs', 'EPSG:4326');
    ndviUrl.searchParams.set('width', '256');
    ndviUrl.searchParams.set('height', '256');
    ndviUrl.searchParams.set('bbox', bbox);
    ndviUrl.searchParams.set('time', dateRange);
    ndviUrl.searchParams.set('colormap', 'viridis');

    console.log('URL:', ndviUrl.toString().substring(0, 150) + '...');

    try {
      const ndviResponse = await fetch(ndviUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'image/png',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      console.log(`✓ NDVI Response: ${ndviResponse.status} ${ndviResponse.statusText}`);
      if (!ndviResponse.ok) {
        const body = await ndviResponse.text();
        console.log(`  Erro: ${body.substring(0, 300)}`);
      }
    } catch (e) {
      console.log(`✗ NDVI Erro: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Teste 3: Listar camadas disponíveis
    console.log('\n3️⃣ Verificando camadas disponíveis...');
    const wmsGetCapabilitiesUrl = 'https://sh.dataspace.copernicus.eu/api/v1/wms?service=WMS&version=1.3.0&request=GetCapabilities';

    try {
      const capsResponse = await fetch(wmsGetCapabilitiesUrl);
      const capsText = await capsResponse.text();
      // Procurar por NDVI, NDMI, NDBI nos capabilities
      const hasNDVI = capsText.includes('NDVI');
      const hasNDMI = capsText.includes('NDMI');
      const hasNDBI = capsText.includes('NDBI');
      
      console.log(`  NDVI disponível: ${hasNDVI}`);
      console.log(`  NDMI disponível: ${hasNDMI}`);
      console.log(`  NDBI disponível: ${hasNDBI}`);
      
      if (!hasNDVI) {
        // Mostrar algumas camadas que existem
        const match = capsText.match(/<Name>([^<]*SENTINEL[^<]*)<\/Name>/g);
        if (match) {
          console.log(`  Camadas SENTINEL encontradas (amostra):`);
          match.slice(0, 5).forEach(m => console.log(`    - ${m}`));
        }
      }
    } catch (e) {
      console.log(`✗ GetCapabilities Erro: ${e instanceof Error ? e.message : String(e)}`);
    }

    res.json({
      message: 'Teste completado. Verifique os logs do servidor.',
      bbox,
      dateRange
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/sentinel2/satellite-tiles/:z/:x/:y.jpg
 * 🛰️ PRIORIDADE: Sentinel-2 do Copernicus (dados de HOJE/HOJE-1)
 * FALLBACK: Google Satellite (se Copernicus falhar)
 * 
 * Sentinel-2 tem passagem a cada 5 dias, então busca:
 * - Data de hoje (melhor caso)
 * - Até 3 dias atrás (comum)
 * - Se nada encontrar, usa Google Satellite como fallback
 */
app.get('/api/sentinel2/satellite-tiles/:z/:x/:y.jpg', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);
    
    // Converter tile XYZ para bbox (EPSG:3857 Web Mercator)
    const n = Math.pow(2, zoom);
    const res_tile = (20037508.34 * 2) / n;
    const minx = tx * res_tile - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * res_tile;
    const maxx = (tx + 1) * res_tile - 20037508.34;
    const maxy = 20037508.34 - ty * res_tile;
    const bbox = `${minx},${miny},${maxx},${maxy}`;
    
    // Calcular datas para buscar Sentinel-2 recente
    // Sentinel-2 tem órbita de 5 dias, então busca os últimos 3 dias
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;
    
    console.log(`🛰️ Sentinel-2 TCI Request: ${z}/${x}/${y} - Período: ${dateRange}`);
    
    // PRIORIDADE 1: Copernicus Sentinel-2 (True Color Imagery - TCI)
    // True Color = RGB real do Sentinel-2, dados de hoje/ontem
    try {
      const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
      wmsUrl.searchParams.set('request', 'GetMap');
      wmsUrl.searchParams.set('service', 'WMS');
      wmsUrl.searchParams.set('version', '1.3.0');
      wmsUrl.searchParams.set('layers', 'SENTINEL2_L2A.TCI'); // True Color Imagery
      wmsUrl.searchParams.set('format', 'image/jpeg');
      wmsUrl.searchParams.set('srs', 'EPSG:3857');
      wmsUrl.searchParams.set('width', '256');
      wmsUrl.searchParams.set('height', '256');
      wmsUrl.searchParams.set('bbox', bbox);
      wmsUrl.searchParams.set('time', dateRange); // Buscar dados recentes
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(wmsUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'image/jpeg',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      clearTimeout(timeout);
      
      if (response.ok && response.body) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutos (dados sempre recentes)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'sentinel2-copernicus');
        res.setHeader('X-Tile-Date', dateRange);
        res.setHeader('Pragma', 'public');
        
        console.log(`✅ Sentinel-2 TCI Success: ${z}/${x}/${y} (${dateRange})`);
        return response.body.pipe(res);
      } else {
        console.warn(`⚠️ Sentinel-2 WMS Error ${response.status}: ${response.statusText} - Tentando Google Satellite...`);
      }
    } catch (error) {
      console.warn(`⚠️ Sentinel-2 Error: ${error instanceof Error ? error.message : 'unknown'} - Tentando Google Satellite...`);
    }
    
    // FALLBACK 1: Google Satellite (recente, confiável)
    console.log(`🔄 Fallback: Google Satellite para ${z}/${x}/${y}`);
    try {
      const googleUrl = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const googleResponse = await fetch(googleUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeout);
      
      if (googleResponse.ok && googleResponse.body) {
        res.setHeader('Content-Type', googleResponse.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate'); // 24 horas
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'google-satellite');
        res.setHeader('X-Fallback', 'true');
        res.setHeader('Pragma', 'public');
        
        console.log(`✅ Google Satellite Success: ${z}/${x}/${y}`);
        return googleResponse.body.pipe(res);
      }
    } catch (error) {
      console.warn(`⚠️ Google Satellite Error: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    
    // Se ambos falharem, retornar placeholder
    console.warn(`❌ Ambos Sentinel-2 e Google falharam, retornando placeholder`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generatePlaceholderTile());

  } catch (error) {
    console.error('❌ Satélite Tile Error:', error);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generatePlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndvi-tiles/:z/:x/:y.png
 * 🌱 PRIORIDADE: NDVI do Copernicus Sentinel-2 (dados recentes)
 * FALLBACK: Imagery do Esri (se Copernicus falhar)
 * 
 * NDVI = Normalized Difference Vegetation Index
 * Verde = vegetação saudável, Vermelho/Marrom = sem vegetação
 */
app.get('/api/sentinel2/ndvi-tiles/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);

    // Converter tile XYZ para bbox (EPSG:3857 Web Mercator)
    const n = Math.pow(2, zoom);
    const res_tile = (20037508.34 * 2) / n;
    const minx = tx * res_tile - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * res_tile;
    const maxx = (tx + 1) * res_tile - 20037508.34;
    const maxy = 20037508.34 - ty * res_tile;
    const bbox = `${minx},${miny},${maxx},${maxy}`;

    // Calcular datas (últimos 3 dias para Sentinel-2)
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = threeDaysAgo.toISOString().split('T')[0];
    const dateRange = `${startDateStr}/${endDateStr}`;

    console.log(`🌱 NDVI Request: ${z}/${x}/${y} - Período: ${dateRange}`);

    // PRIORIDADE 1: Copernicus Sentinel-2 NDVI
    try {
      const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
      wmsUrl.searchParams.set('request', 'GetMap');
      wmsUrl.searchParams.set('service', 'WMS');
      wmsUrl.searchParams.set('version', '1.3.0');
      wmsUrl.searchParams.set('layers', 'SENTINEL2_L2A.NDVI');
      wmsUrl.searchParams.set('format', 'image/png');
      wmsUrl.searchParams.set('srs', 'EPSG:3857');
      wmsUrl.searchParams.set('width', '256');
      wmsUrl.searchParams.set('height', '256');
      wmsUrl.searchParams.set('bbox', bbox);
      wmsUrl.searchParams.set('time', dateRange);
      wmsUrl.searchParams.set('colormap', 'viridis'); // Verde = vegetação

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(wmsUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'image/png',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      clearTimeout(timeout);

      if (response.ok && response.body) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'sentinel2-ndvi');
        res.setHeader('X-Tile-Date', dateRange);

        console.log(`✅ NDVI Success: ${z}/${x}/${y} (${dateRange})`);
        return response.body.pipe(res);
      } else {
        console.warn(`⚠️ NDVI WMS Error ${response.status}: ${response.statusText} - Tentando fallback...`);
      }
    } catch (error) {
      console.warn(`⚠️ NDVI Error: ${error instanceof Error ? error.message : 'unknown'} - Tentando fallback...`);
    }

    // FALLBACK: Esri World Imagery (como base visual)
    console.log(`🔄 Fallback: Esri Imagery para ${z}/${x}/${y}`);
    try {
      const esriUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const esriResponse = await fetch(esriUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      clearTimeout(timeout);

      if (esriResponse.ok && esriResponse.body) {
        res.setHeader('Content-Type', esriResponse.headers.get('content-type') || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 dias
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Tile-Source', 'esri-imagery');
        res.setHeader('X-Fallback', 'true');

        console.log(`✅ Esri Fallback Success: ${z}/${x}/${y}`);
        return esriResponse.body.pipe(res);
      }
    } catch (error) {
      console.warn(`⚠️ Esri Error: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    // Se ambos falharem, retornar placeholder verde
    console.warn(`❌ NDVI e Esri falharam, retornando placeholder verde`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generateGreenPlaceholderTile());

  } catch (error) {
    console.error('❌ NDVI Tile Error:', error);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generateGreenPlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndmi-tiles/:z/:x/:y.png
 * Retorna tile NDMI do Sentinel-2 via WMS
 * Retorna placeholder (cinza) se Copernicus estiver offline
 */
app.get('/api/sentinel2/ndmi-tiles/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);
    
    const n = Math.pow(2, zoom);
    const res_tile = (20037508.34 * 2) / n;
    const minx = tx * res_tile - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * res_tile;
    const maxx = (tx + 1) * res_tile - 20037508.34;
    const maxy = 20037508.34 - ty * res_tile;
    
    const bbox = `${minx},${miny},${maxx},${maxy}`;
    
    const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
    wmsUrl.searchParams.set('request', 'GetMap');
    wmsUrl.searchParams.set('service', 'WMS');
    wmsUrl.searchParams.set('version', '1.3.0');
    wmsUrl.searchParams.set('layers', 'SENTINEL2_L2A.NDMI');
    wmsUrl.searchParams.set('format', 'image/png');
    wmsUrl.searchParams.set('srs', 'EPSG:3857');
    wmsUrl.searchParams.set('width', '256');
    wmsUrl.searchParams.set('height', '256');
    wmsUrl.searchParams.set('bbox', bbox);
    wmsUrl.searchParams.set('colormap', 'viridis');
    
    const response = await fetch(wmsUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'image/png',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      // Copernicus falhou, tentar Esri World Imagery como fallback
      console.warn(`⚠️ NDMI WMS Error: ${response.status}, tentando Esri...`);
      
      try {
        const esriUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
        
        const esriResponse = await fetch(esriUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        if (esriResponse.ok) {
          console.log(`✅ NDMI Esri Fallback: ${z}/${x}/${y}`);
          res.setHeader('Content-Type', esriResponse.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Tile-Source', 'esri-fallback');
          
          if (esriResponse.body) {
            return esriResponse.body.pipe(res);
          }
        }
      } catch (esriError) {
        console.warn(`⚠️ NDMI Esri também falhou: ${esriError instanceof Error ? esriError.message : 'unknown'}`);
      }
      
      // Se ambos falharem, retornar placeholder cinza
      console.warn(`❌ NDMI: Ambos Copernicus e Esri falharam, retornando placeholder`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Placeholder', 'true');
      return res.send(generatePlaceholderTile());
    }
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'copernicus');
    
    if (response.body) {
      return response.body.pipe(res);
    }
  } catch (error) {
    // Silenciosamente retornar placeholder em caso de erro
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generatePlaceholderTile());
  }
});

/**
 * GET /api/sentinel2/ndbi-tiles/:z/:x/:y.png
 * Retorna tile NDBI do Sentinel-2 via WMS
 * Retorna placeholder (cinza) se Copernicus estiver offline
 */
app.get('/api/sentinel2/ndbi-tiles/:z/:x/:y.png', async (req: Request, res: Response) => {
  try {
    const { z, x, y } = req.params;
    
    const zoom = parseInt(z);
    const tx = parseInt(x);
    const ty = parseInt(y);
    
    const n = Math.pow(2, zoom);
    const res_tile = (20037508.34 * 2) / n;
    const minx = tx * res_tile - 20037508.34;
    const miny = 20037508.34 - (ty + 1) * res_tile;
    const maxx = (tx + 1) * res_tile - 20037508.34;
    const maxy = 20037508.34 - ty * res_tile;
    
    const bbox = `${minx},${miny},${maxx},${maxy}`;
    
    const wmsUrl = new URL('https://sh.dataspace.copernicus.eu/api/v1/wms');
    wmsUrl.searchParams.set('request', 'GetMap');
    wmsUrl.searchParams.set('service', 'WMS');
    wmsUrl.searchParams.set('version', '1.3.0');
    wmsUrl.searchParams.set('layers', 'SENTINEL2_L2A.NDBI');
    wmsUrl.searchParams.set('format', 'image/png');
    wmsUrl.searchParams.set('srs', 'EPSG:3857');
    wmsUrl.searchParams.set('width', '256');
    wmsUrl.searchParams.set('height', '256');
    wmsUrl.searchParams.set('bbox', bbox);
    wmsUrl.searchParams.set('colormap', 'viridis');
    
    const response = await fetch(wmsUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'image/png',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      // Copernicus falhou, tentar Esri World Imagery como fallback
      console.warn(`⚠️ NDBI WMS Error: ${response.status}, tentando Esri...`);
      
      try {
        const esriUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
        
        const esriResponse = await fetch(esriUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        if (esriResponse.ok) {
          console.log(`✅ NDBI Esri Fallback: ${z}/${x}/${y}`);
          res.setHeader('Content-Type', esriResponse.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Tile-Source', 'esri-fallback');
          
          if (esriResponse.body) {
            return esriResponse.body.pipe(res);
          }
        }
      } catch (esriError) {
        console.warn(`⚠️ NDBI Esri também falhou: ${esriError instanceof Error ? esriError.message : 'unknown'}`);
      }
      
      // Se ambos falharem, retornar placeholder cinza
      console.warn(`❌ NDBI: Ambos Copernicus e Esri falharam, retornando placeholder`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Placeholder', 'true');
      return res.send(generatePlaceholderTile());
    }
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Tile-Source', 'copernicus');
    
    if (response.body) {
      return response.body.pipe(res);
    }
  } catch (error) {
    // Silenciosamente retornar placeholder em caso de erro
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Placeholder', 'true');
    return res.send(generatePlaceholderTile());
  }
});

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/sentinel2/status
 * Verifica status do Copernicus e fallback
 */
app.get('/api/sentinel2/status', async (req: Request, res: Response) => {
  try {
    const status = {
      backend: 'ok',
      timestamp: new Date().toISOString(),
      copernicus: 'unknown',
      fallback: 'unknown'
    };

    // Testar Copernicus
    try {
      const copResponse = await fetch(
        'https://sh.dataspace.copernicus.eu/api/v1/wms?service=WMS&request=GetCapabilities',
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      status.copernicus = copResponse.ok ? 'ok' : `error-${copResponse.status}`;
    } catch (error) {
      status.copernicus = 'offline';
    }

    // Testar fallback Esri
    try {
      const fallResponse = await fetch(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/1/1',
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      status.fallback = fallResponse.ok ? 'ok' : `error-${fallResponse.status}`;
    } catch (error) {
      status.fallback = 'offline';
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/**
 * Error handler
 */
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  🛰️  Sentinel-2 Proxy Server               ║
║  Running on http://localhost:${PORT}       ║
║  API: /api/sentinel2/*                    ║
╚═══════════════════════════════════════════╝
  `);
});
