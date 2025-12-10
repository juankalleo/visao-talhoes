# Configuração de Autenticação Copernicus

## Status Atual

Os endpoints NDVI, NDMI e NDBI estão funcionando com **fallback visual**:
- ✅ Endpoints retornam tiles válidos (PNG 256x256)
- ✅ Cores baseadas em índices simulados
- ❌ Dados reais do Copernicus retornando 503 (manutenção ou requer autenticação)

## Problema: 503 Service Unavailable

O Copernicus SentinelHub WMS está retornando erro 503 para as camadas especializadas (NDVI, NDMI, NDBI). Possíveis causas:

1. **Autenticação necessária** - Camadas de índice podem exigir OAuth2 token
2. **Serviço em manutenção** - Copernicus realiza manutenção frequente
3. **Rate limiting** - Muitas requisições simultâneas

## Solução: Adicionar Credenciais OAuth2

### Passo 1: Registrar-se no Copernicus Dataspace

1. Visite https://dataspace.copernicus.eu/
2. Crie uma conta (gratuita)
3. Acesse https://identity.dataspace.copernicus.eu/
4. Navegue para "OAuth clients" 
5. Crie um novo cliente OAuth2

### Passo 2: Configurar Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` e adicione suas credenciais:

```env
COPERNICUS_CLIENT_ID=seu_client_id_aqui
COPERNICUS_CLIENT_SECRET=seu_client_secret_aqui
```

### Passo 3: Reiniciar o Servidor

```bash
npm run dev
```

O servidor automaticamente:
1. Detectará as credenciais
2. Obterá um token OAuth2 do Copernicus
3. Usará o token em requisições ao WMS
4. Renovará o token automaticamente quando expirar

## Verificação

Ao fazer uma requisição para `/api/sentinel2/ndvi-visual/15/16398/10919.png`, verifique os logs:

**Com autenticação:**
```
🔐 Usando autenticação OAuth2
🔐 Obtendo novo token OAuth2 do Copernicus...
✅ Token OAuth2 obtido com sucesso (válido por 3600s)
📊 NDVI Response: 200
✅ NDVI Copernicus Data Success (15234 bytes)
```

**Sem autenticação (fallback):**
```
⚠️ Sem autenticação OAuth2 - configure COPERNICUS_CLIENT_ID e COPERNICUS_CLIENT_SECRET
📊 NDVI Response: 503
⚠️ NDVI HTTP 503
🔄 Fallback: NDVI Visual (dados não disponíveis)
✅ Enviando tile visual gerado (3372 bytes)
```

## Camadas Disponíveis

Quando autenticado, as seguintes camadas WMS estão disponíveis:

| Índice | Layer | Descrição |
|--------|-------|-----------|
| NDVI | `SENTINEL2_L2A.NDVI` | Índice de Vegetação Normalizado |
| NDMI | `SENTINEL2_L2A.NDMI` | Índice de Umidade Normalizado |
| NDBI | `SENTINEL2_L2A.NDBI` | Índice de Construção Normalizado |
| TCI | `SENTINEL2_L2A.TCI` | True Color Imagery (RGB) |

## Recursos Adicionais

- [Copernicus Dataspace Documentation](https://documentation.dataspace.copernicus.eu/)
- [Sentinel Hub WMS Documentation](https://docs.sentinel-hub.com/api/latest/reference/wms/v1/)
- [OAuth2 Setup Guide](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OAuth.html)

## Troubleshooting

### "403 Forbidden"
- Credenciais inválidas
- Token expirado (será renovado automaticamente)
- Usuário sem permissão para acessar WMS

### "401 Unauthorized"
- Token OAuth2 não foi enviado
- Verifique se `COPERNICUS_CLIENT_ID` e `COPERNICUS_CLIENT_SECRET` estão corretos

### "503 Service Unavailable"
- Serviço em manutenção (verificar status em https://dataspace.copernicus.eu/)
- Fallback visual funcionará mesmo assim
