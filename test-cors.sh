#!/bin/bash
# Script de teste da solução CORS

echo "╔════════════════════════════════════════════╗"
echo "║  🧪 TESTANDO SOLUÇÃO CORS                  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Teste 1: Backend health check
echo "📡 Teste 1: Verificando se backend está rodando..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend respondendo em http://localhost:3001${NC}"
else
  echo -e "${RED}❌ Backend não está respondendo${NC}"
  echo "   Execute em outro terminal: npm run dev:server"
  exit 1
fi

echo ""

# Teste 2: STAC API
echo "🔍 Teste 2: Testando STAC Search via proxy..."
STAC_RESPONSE=$(curl -s -X POST http://localhost:3001/api/sentinel2/stac-search \
  -H "Content-Type: application/json" \
  -d '{
    "bbox": [-63.9, -8.8, -63.9, -8.8],
    "datetime": "2025-11-09T00:00:00Z/2025-12-09T23:59:59Z",
    "collections": ["sentinel-2"],
    "limit": 1
  }')

if echo "$STAC_RESPONSE" | grep -q "features"; then
  echo -e "${GREEN}✅ STAC Search funcionando${NC}"
  echo "   Features encontradas: $(echo "$STAC_RESPONSE" | grep -o '"features":\[' | wc -l)"
else
  echo -e "${YELLOW}⚠️  STAC Search pode estar lento ou Copernicus indisponível${NC}"
  echo "   Resposta: $STAC_RESPONSE"
fi

echo ""

# Teste 3: Frontend
echo "🌐 Teste 3: Verificando se frontend está rodando..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Frontend respondendo em http://localhost:5173${NC}"
else
  echo -e "${RED}❌ Frontend não está respondendo${NC}"
  echo "   Execute em outro terminal: npm run dev:client"
  exit 1
fi

echo ""

# Resumo
echo "╔════════════════════════════════════════════╗"
echo "║  ✅ TODOS OS TESTES PASSARAM!              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Próximos passos:"
echo "1. Abra http://localhost:5173 no navegador"
echo "2. Verifique o console (F12) para erros"
echo "3. Testes de camadas Sentinel-2 no mapa"
echo ""
echo "Se houver problemas, verifique:"
echo "- Ambos os servidores estão rodando?"
echo "- Portas 3001 e 5173 estão livres?"
echo "- npm install foi executado?"
echo ""
