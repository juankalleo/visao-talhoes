// Espera 10 segundos e faz uma requisição
import http from 'http';
import { promisify } from 'util';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('[TESTER] Aguardando 10 segundos para o servidor iniciar...');
  await sleep(10000);
  
  console.log('[TESTER] Fazendo requisição...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/sentinel2/ndvi-visual/15/16398/10919.png',
    method: 'GET',
    timeout: 20000
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`[TESTER] Response: ${res.statusCode}`);
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
      });
      res.on('end', () => {
        console.log(`[TESTER] Done: ${size} bytes`);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.error(`[TESTER] Error: ${err.message}`);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('[TESTER] Timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
