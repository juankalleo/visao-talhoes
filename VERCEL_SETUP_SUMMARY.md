# 📋 Resumo de Configuração para Vercel

## ✅ O que foi configurado

### 1. **Arquivo de Deployment (`vercel.json`)**
- Configurado para servir SPA React no root `/`
- API serverless em `/api/*`
- Variáveis de ambiente mapeadas

### 2. **API Serverless (`api/sentinel2.ts`)**
- Endpoint GET `/api/sentinel2/ndvi-visual/:z/:x/:y.png`
- Endpoint GET `/api/sentinel2/ndmi-visual/:z/:x/:y.png`
- Endpoint GET `/api/sentinel2/ndbi-visual/:z/:x/:y.png`
- Autenticação OAuth2 com Copernicus
- Fallback visual automático

### 3. **Build Setup**
- Frontend: `npm run build` → Vite build para `/dist`
- Backend: Funções serverless Vercel
- Package.json atualizado com `@vercel/node`

### 4. **Documentação**
- `SETUP.md` - Quick start local + deploy
- `VERCEL_DEPLOY.md` - Guia completo de deployment
- `.env.example` - Todas as variáveis necessárias

## 🚀 Para fazer Deploy na Vercel

### 1. No Dashboard Vercel:
Adicione estas variáveis de ambiente:

```env
VITE_API_URL=https://seu-projeto.vercel.app/api
VITE_STAC_API_URL=https://stac.dataspace.copernicus.eu/api/v1
VITE_COPERNICUS_BASE_URL=https://catalogue.dataspace.copernicus.eu
COPERNICUS_CLIENT_ID=seu-client-id
COPERNICUS_CLIENT_SECRET=seu-client-secret
```

### 2. Conectar repositório GitHub à Vercel:
- https://vercel.com/import
- Selecione `visao-talhoes` no GitHub
- Vercel irá fazer deploy automático

### 3. Verificar Deploy:
- Acessar https://seu-projeto.vercel.app
- Ver logs: `vercel logs --follow`

## 📁 Estrutura de Arquivos

```
/
├── api/
│   └── sentinel2.ts          ← API Serverless (Vercel)
├── src/
│   ├── components/           ← UI Components
│   ├── pages/               ← Páginas
│   └── main.tsx             ← Entry point React
├── dist/                     ← Build output (Vite)
├── vercel.json              ← Config Vercel ✅
├── vite.config.ts           ← Config Vite
├── server.ts                ← Express (local)
├── package.json             ← Deps + scripts
├── .env.local               ← Variáveis locais
├── .env.example             ← Template vars ✅
├── SETUP.md                 ← Quick start ✅
└── VERCEL_DEPLOY.md         ← Deploy guide ✅
```

## 🔐 Variáveis de Ambiente

**LOCAL** (`.env.local`):
```env
COPERNICUS_CLIENT_ID=your-id
COPERNICUS_CLIENT_SECRET=your-secret
VITE_API_URL=http://localhost:3001
```

**VERCEL** (Dashboard):
```env
COPERNICUS_CLIENT_ID=your-id
COPERNICUS_CLIENT_SECRET=your-secret
VITE_API_URL=https://seu-projeto.vercel.app/api
VITE_STAC_API_URL=https://stac.dataspace.copernicus.eu/api/v1
VITE_COPERNICUS_BASE_URL=https://catalogue.dataspace.copernicus.eu
```

## 📊 Fluxo de Requisição

### Local (npm run dev):
```
Browser:8080 → Express:3001 (API) → Copernicus WMS
```

### Vercel (Production):
```
Browser → Vercel.app → Serverless Function → Copernicus WMS
```

## ⚠️ Notas Importantes

1. **Copernicus 503**: É normal ocasionalmente. Fallback visual ativa automaticamente
2. **Cold Start**: Primeira requisição pode levar 5-10s (Vercel aquece a função)
3. **Rate Limit**: Copernicus tem limite. Cache de 5min evita muitos requests
4. **Credenciais**: Nunca faça commit do `.env.local`!

## ✨ Próximas Melhorias

- [ ] Implementar Redis cache para tiles
- [ ] Adicionar Sentry para error tracking
- [ ] Configurar domínio personalizado
- [ ] Setup de CI/CD avançado
- [ ] Monitoramento de performance

---

**Status**: ✅ Pronto para deploy na Vercel
**Última atualização**: December 10, 2025
