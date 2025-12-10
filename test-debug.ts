// Teste detalhado
import http from 'http';

async function main() {
  console.log('[TEST] Starting server request...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/sentinel2/ndvi-visual/15/16398/10919.png',
    method: 'GET',
    timeout: 15000
  };

  const req = http.request(options, (res) => {
    console.log(`[TEST] Got response: ${res.statusCode}`);
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => {
      console.log(`[TEST] Chunk: ${chunk.length} bytes`);
      chunks.push(chunk);
    });
    res.on('error', (err) => {
      console.error(`[TEST] Response error: ${err.message}`);
    });
    res.on('end', () => {
      const total = chunks.reduce((a, b) => a + b.length, 0);
      console.log(`[TEST] Complete: ${total} bytes`);
    });
  });

  req.on('socket', (socket) => {
    console.log(`[TEST] Socket created`);
    socket.on('error', (err) => {
      console.error(`[TEST] Socket error: ${err.message}`);
    });
  });

  req.on('error', (err) => {
    console.error(`[TEST] Request error: ${err.message}`);
    console.error(`[TEST] Error type: ${err.constructor.name}`);
    console.error(`[TEST] Error code: ${(err as any).code}`);
  });

  req.on('timeout', () => {
    console.error('[TEST] Timeout!');
    req.destroy();
  });

  req.on('abort', () => {
    console.log('[TEST] Aborted');
  });

  req.on('finish', () => {
    console.log('[TEST] Request finished');
  });

  console.log('[TEST] Sending request...');
  req.end();
  console.log('[TEST] Request sent');
}

setTimeout(() => {
  main().catch(err => {
    console.error('[TEST] Uncaught error:', err);
    process.exit(1);
  });
}, 10000);
