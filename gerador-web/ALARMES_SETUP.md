# Sistema de Alarmes Automáticos - Setup

## Visão Geral

O gerador-web possui um sistema automático de detecção de alarmes que monitora dados de telemetria em tempo real e cria alertas quando condições anormais são detectadas.

## Arquitetura

### 1. **Detector de Alarmes** (`src/lib/alarme-detector.ts`)
- Verifica dados de telemetria contra regras pré-configuradas
- Cria alarmes automaticamente quando condições são atendidas
- Resolve alarmes quando as condições voltam à normalidade

### 2. **API de Detecção** (`src/app/api/gerador/alarmes/detect/route.ts`)
- Endpoint POST que dispara a detecção de alarmes
- Requer autenticação via `X-API-Key`
- Pode ser chamado periodicamente por um cron job ou scheduler

### 3. **Tipos de Alarmes Monitorados**

#### 🔴 CRÍTICOS
- **TEMPERATURA_ALTA**: > 85°C
- **TEMPERATURA_SENSOR_ERRO**: Sensor fora de operação
- **COMBUSTIVEL_CRITICO**: < 5%
- **TENSAO_GERADOR_FORA_ESPECIFICACAO**: Fora de 220V ±10%

#### 🟡 AVISOS
- **COMBUSTIVEL_BAIXO**: < 20%
- **BATERIA_BAIXA**: < 24V
- **FREQUENCIA_FORA_ESPECIFICACAO**: Fora de 59-61 Hz
- **TENSAO_REDE_FORA_ESPECIFICACAO**: Fora de 220V ±10%
- **CORRENTE_ALTA**: > 90A

#### 🔵 INFORMATIVOS
- **FALHA_REDE**: Rede da concessionária ausente

## Setup

### Pré-requisitos
1. Aplicar migração Prisma:
   ```bash
   npx prisma migrate deploy
   ```

2. Definir variável de ambiente `GERADOR_API_KEY` no `.env`:
   ```env
   GERADOR_API_KEY=sua_chave_secreta_aqui
   ```

### Integração com Gerador-Monitor

No projeto `gerador-monitor`, adicione um job cron que chama a API a cada 5 minutos:

```python
# Em gerador_monitor/tasks/alarmes.py

import requests
import os
from datetime import datetime

def detectar_alarmes():
    """Chama API de detecção de alarmes a cada 5 minutos"""
    try:
        api_key = os.getenv('GERADOR_WEB_API_KEY')
        url = 'http://localhost:3001/api/gerador/alarmes/detect'
        
        headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            print(f"[{datetime.now()}] Alarmes detectados com sucesso")
        else:
            print(f"[{datetime.now()}] Erro ao detectar alarmes: {response.status_code}")
            
    except Exception as e:
        print(f"[{datetime.now()}] Erro na detecção de alarmes: {e}")


# No seu scheduler/APScheduler:
scheduler.add_job(
    detectar_alarmes,
    'interval',
    minutes=5,
    id='detectar_alarmes'
)
```

### Alternativa: Cron Job

```bash
# /etc/cron.d/gerador-alarmes

*/5 * * * * curl -X POST http://localhost:3001/api/gerador/alarmes/detect \
  -H "X-API-Key: sua_chave_secreta_aqui" \
  -H "Content-Type: application/json" >> /var/log/gerador-alarmes.log 2>&1
```

## API

### Detectar Alarmes

**Endpoint:** `POST /api/gerador/alarmes/detect`

**Headers:**
```
X-API-Key: sua_chave_secreta_aqui
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alarmes detectados e processados"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

### Health Check

**Endpoint:** `GET /api/gerador/alarmes/detect`

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "API de detecção de alarmes ativa"
}
```

## Funções Disponíveis

### `detectarAlarmes()`
Verifica dados de telemetria e cria alarmes se as condições forem atendidas.

```typescript
import { detectarAlarmes } from '@/lib/alarme-detector';

await detectarAlarmes();
```

### `resolverAlarmesAutomaticamente()`
Resolve alarmes abertos quando as condições voltam à normalidade.

```typescript
import { resolverAlarmesAutomaticamente } from '@/lib/alarme-detector';

await resolverAlarmesAutomaticamente();
```

### `getAlarmes(filtro?)`
Busca alarmes com filtros opcionais.

```typescript
import { getAlarmes } from '@/lib/gerador-utils';

// Todos os alarmes abertos
const alarmes = await getAlarmes();

// Apenas críticos não resolvidos
const criticos = await getAlarmes({
  nivel: 'CRITICO',
  resolvido: false
});

// Últimos 10
const recentes = await getAlarmes({ limite: 10 });
```

### `criarAlarme(dados)`
Cria um alarme manualmente (geralmente feito automaticamente).

```typescript
import { criarAlarme } from '@/lib/gerador-utils';

await criarAlarme({
  tipo: 'TEMPERATURA_ALTA',
  nivel: 'CRITICO',
  titulo: 'Temperatura Elevada',
  descricao: 'Temperatura acima de 85°C',
  valor: 87,
  unidade: '°C'
});
```

### `resolverAlarme(id, notas?)`
Resolve um alarme manualmente.

```typescript
import { resolverAlarme } from '@/lib/gerador-utils';

await resolverAlarme('alarme_id_aqui', 'Temperatura normalizada');
```

## Dashboard

Os alarmes aparecem em três lugares:

1. **Dashboard Principal** (`/dashboard`)
   - Card "Alarmes" com contagem de críticos

2. **Painel do Gerador** (`/dashboard/gerador`)
   - Seção "Alarmes Recentes" com os 5 últimos

3. **Página de Alarmes** (`/dashboard/gerador/alarmes`)
   - Lista completa organizada por nível
   - Detalhes expandíveis
   - Histórico de resolvidos

## Customização

Para adicionar novos tipos de alarmes, edite `src/lib/alarme-detector.ts` e adicione à array `ALARMES_CONFIG`:

```typescript
{
  tipo: 'MEU_NOVO_ALARME',
  titulo: 'Título do Alarme',
  descricao: 'Descrição detalhada',
  nivel: 'AVISO',  // ou CRITICO, INFO
  condicao: (leitura) => {
    // Retorna true se a condição for atendida
    return leitura.algum_valor > 100;
  },
  valor: (leitura) => leitura.algum_valor,
  unidade: 'unidade'
}
```

## Troubleshooting

### Alarmes não são criados
1. Verificar se a migração foi aplicada: `npx prisma migrate status`
2. Verificar se a API está respondendo: `curl http://localhost:3001/api/gerador/alarmes/detect`
3. Verificar logs do gerador-web

### Alarmes aparecem mas não resolvem
Verificar se `resolverAlarmesAutomaticamente()` está sendo chamada:
```typescript
// Ambas precisam ser chamadas juntas:
await detectarAlarmes();
await resolverAlarmesAutomaticamente();
```

### API retorna 401 Unauthorized
Verificar se:
1. Variável `GERADOR_API_KEY` está definida
2. Header `X-API-Key` é enviado com valor correto
3. Valores coincidem

## Performance

- **Frequência recomendada**: A cada 5 minutos
- **Timeout recomendado**: 10 segundos
- **Prevenção de duplicatas**: Alarmes duplicados não são criados em menos de 5 minutos
- **Auto-resolução**: Verifica automaticamente se alarmes devem ser resolvidos
