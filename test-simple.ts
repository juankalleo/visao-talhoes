// Test simples sem dependências externas
import express from 'express';

const app = express();
const PORT = 3002;

// Função simples de teste
async function simpleTest(): Promise<Buffer> {
  console.log('Test function called');
  // Retornar um buffer vazio
  return Buffer.from('test');
}

app.get('/test', async (req, res) => {
  try {
    console.log('GET /test received');
    const result = await simpleTest();
    console.log('Got result:', result.length);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
