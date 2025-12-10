# 🌍 Visão Talhão - Setup e Deploy

## ⚡ Quick Start Local

### 1. Clonar e instalar dependências
```bash
git clone https://github.com/juankalleo/visaoro-talhao.git
cd visaoro-talhao
npm install
```

### 2. Configurar variáveis de ambiente
```bash
# Copiar arquivo exemplo
cp .env.example .env.local

# Editar .env.local e adicionar suas credenciais Copernicus
# COPERNICUS_CLIENT_ID=seu-id
# COPERNICUS_CLIENT_SECRET=seu-secret
```

### 3. Rodar em desenvolvimento
```bash
npm run dev
```

Acessar em **http://localhost:8080**

- Frontend: http://localhost:8080 (Vite React)
- Backend: http://localhost:3001 (Express)

## 📦 Deploy na Vercel

### Pré-requisitos
1. ✅ Repositório GitHub
2. ✅ Conta Vercel conectada ao GitHub
3. ✅ Credenciais Copernicus

### Steps de Deploy

1. **Adicionar variáveis no Vercel Dashboard**
   ```
   VITE_API_URL=https://seu-projeto.vercel.app/api
   VITE_STAC_API_URL=https://stac.dataspace.copernicus.eu/api/v1
   VITE_COPERNICUS_BASE_URL=https://catalogue.dataspace.copernicus.eu
   ```

2. **Fazer push para main**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

3. **Vercel irá fazer deploy automaticamente**
   - Build: `npm run build` (Vite)
   - Serve: Frontend em `/`, API em `/api/*`

## 🗺️ Funcionalidades

- ✅ Mapa interativo (MapLibre GL)
- ✅ NDVI (Índice de Vegetação)
- ✅ NDMI (Índice de Umidade)
- ✅ NDBI (Índice Construído)
- ✅ Fallback visual quando API indisponível
- ✅ Cache inteligente (5min Sentinel, 24h Google)

## 🔧 Estrutura do Projeto

```
/
├── src/                 # Frontend React
│   ├── components/      # Componentes UI
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities
│   └── pages/          # Páginas
├── api/                # Serverless functions (Vercel)
│   └── sentinel2.ts    # API do Copernicus
├── server.ts           # Express (local)
├── vite.config.ts      # Config Vite
├── vercel.json         # Config Vercel
└── package.json
```

## 📝 Variáveis de Ambiente

| Variável | Local | Vercel | Descrição |
|----------|-------|--------|-----------|
| `COPERNICUS_CLIENT_ID` | ✅ | ✅ | ID OAuth2 Copernicus |
| `COPERNICUS_CLIENT_SECRET` | ✅ | ✅ | Secret OAuth2 Copernicus |
| `VITE_API_URL` | `localhost:3001` | `vercel.app/api` | Base URL API |
| `VITE_STAC_API_URL` | Copernicus STAC | Copernicus STAC | STAC API |

## 🚀 Troubleshooting

### Erro: "Impossível conectar ao servidor"
- Verificar se `npm run dev` está rodando
- Verificar se porta 3001 está disponível

### Erro: 503 Copernicus
- Copernicus pode estar em manutenção
- Fallback visual será usado automaticamente
- Verificar logs: `vercel logs --follow`

### Erro: Tiles não carregam
- Verificar variáveis de ambiente
- Verificar internet connection
- Limpar cache browser (Ctrl+Shift+Del)

## 📚 Documentação

- [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) - Guia completo de deployment
- [Copernicus DataSpace](https://dataspace.copernicus.eu/)
- [MapLibre GL](https://maplibre.org/)

## 👨‍💻 Autor

Criado com ❤️ para monitoramento de talhões agrícolas
