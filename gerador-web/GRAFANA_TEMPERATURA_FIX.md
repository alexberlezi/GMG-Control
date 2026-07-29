# Corrigir Temperatura no Grafana

## Problema

Os dados de temperatura estão mostrando valores inválidos:
- **32765°C** (INT16 overflow)
- **32767°C** (INT16 max)
- **65535°C** (UINT16 overflow)
- **Valores < 34°C** (fora da especificação do sensor)

Esses valores causam:
- ❌ Gráficos com picos enormes
- ❌ Escalas distorcidas
- ❌ Visualização inutilizável
- ❌ Alarmes falsos

## Solução

### 1. Filtrar na Query SQL do Grafana

Todas as queries do Grafana que usam temperatura devem incluir:

```sql
WHERE temperatura_c NOT IN (32765, 32767, 65535)
  AND temperatura_c >= 34
```

### 2. Exemplos de Queries Corrigidas

#### Dashboard - Gráfico de Temperatura

**ANTES (ERRADO):**
```sql
SELECT 
  time_bucket('1 hour', time) as time,
  AVG(temperatura_c) as temperatura
FROM leituras
WHERE time > now() - interval '7 days'
GROUP BY time_bucket('1 hour', time)
ORDER BY time;
```

**DEPOIS (CORRETO):**
```sql
SELECT 
  time_bucket('1 hour', time) as time,
  AVG(temperatura_c) as temperatura
FROM leituras
WHERE time > now() - interval '7 days'
  AND temperatura_c NOT IN (32765, 32767, 65535)
  AND temperatura_c >= 34
GROUP BY time_bucket('1 hour', time)
ORDER BY time;
```

#### Dashboard - Temperatura Atual

**ANTES:**
```sql
SELECT temperatura_c
FROM leituras
ORDER BY time DESC
LIMIT 1;
```

**DEPOIS:**
```sql
SELECT 
  CASE 
    WHEN temperatura_c IN (32765, 32767, 65535) OR temperatura_c < 34 
    THEN NULL
    ELSE temperatura_c
  END as temperatura
FROM leituras
ORDER BY time DESC
LIMIT 1;
```

#### Dashboard - Min/Max de Temperatura

**ANTES:**
```sql
SELECT 
  MIN(temperatura_c) as min_temp,
  MAX(temperatura_c) as max_temp
FROM leituras
WHERE time > now() - interval '24 hours';
```

**DEPOIS:**
```sql
SELECT 
  MIN(CASE WHEN temperatura_c NOT IN (32765, 32767, 65535) 
           AND temperatura_c >= 34 
           THEN temperatura_c END) as min_temp,
  MAX(CASE WHEN temperatura_c NOT IN (32765, 32767, 65535) 
           AND temperatura_c >= 34 
           THEN temperatura_c END) as max_temp
FROM leituras
WHERE time > now() - interval '24 hours';
```

#### Dashboard - Alertas de Temperatura

**ANTES:**
```sql
SELECT time, temperatura_c
FROM leituras
WHERE temperatura_c > 85
ORDER BY time DESC;
```

**DEPOIS:**
```sql
SELECT time, temperatura_c
FROM leituras
WHERE temperatura_c > 85
  AND temperatura_c NOT IN (32765, 32767, 65535)
  AND temperatura_c >= 34
ORDER BY time DESC
LIMIT 100;
```

### 3. Passo a Passo no Grafana

#### 3.1 Acessar Dashboard de Temperatura

1. Abrir Grafana: `http://seu-servidor:3000`
2. Ir para o dashboard de temperatura do gerador

#### 3.2 Editar Painel

1. Clicar no título do painel → **Edit**
2. Ir para a seção **Query** (SQL)
3. Adicionar o filtro na cláusula WHERE:

```sql
WHERE ... 
  AND temperatura_c NOT IN (32765, 32767, 65535)
  AND temperatura_c >= 34
```

#### 3.3 Testar Query

1. Clicar em **Refresh** ou **Test**
2. Verificar se o pico desapareceu
3. Verifica os valores mínimo e máximo

#### 3.4 Salvar Painel

1. Clicar em **Apply** (ou **Run Query**)
2. Clicar em **Save** no canto superior direito
3. Adicionar mensagem: "Filtrar valores inválidos de temperatura"
4. Confirmar

### 4. Alertas para Temperatura

Se você tem alertas para temperatura no Grafana:

#### Antes (ERRADO):
```
Alert if temperature > 85
```

#### Depois (CORRETO):
```
Alert if temperature > 85 
  AND temperature NOT IN (32765, 32767, 65535)
  AND temperature >= 34
```

### 5. Variáveis Grafana (Recomendado)

Para facilitar, crie uma variável:

1. Dashboard Settings → Variables
2. Click **New**
3. Nome: `temp_filter`
4. Tipo: **Constant**
5. Valor: `temperatura_c NOT IN (32765, 32767, 65535) AND temperatura_c >= 34`
6. Usar em queries: `WHERE time > now() - interval '7 days' AND $temp_filter`

### 6. Painel de Validação de Dados

Criar um painel para monitorar dados inválidos:

```sql
SELECT 
  COUNT(*) as total_leituras,
  COUNT(CASE WHEN temperatura_c IN (32765, 32767, 65535) 
             OR temperatura_c < 34 
        THEN 1 END) as temp_invalida
FROM leituras
WHERE time > now() - interval '24 hours';
```

Isso mostra:
- Total de leituras nas últimas 24h
- Quantas têm temperatura inválida
- Porcentagem de dados ruins

### 7. Checklist Pós-Aplicação

- [ ] Gráfico de temperatura sem picos enormes
- [ ] Escala do eixo Y entre 30-90°C (normal)
- [ ] Valores mínimos e máximos realistas
- [ ] Alertas não disparam para valores inválidos
- [ ] Query executa rápido (< 1s)
- [ ] Descrição atualizada no painel
- [ ] Todos os painéis de temperatura corrigidos
- [ ] Dashboard salvo

### 8. Validar no Backend

Verificar que o backend também está filtrando:

```bash
# Fazer requisição para API
curl http://localhost:3001/api/gerador/dados/temperatura

# Verificar na resposta
# Se temperatura_invalida = true, é um valor descartado
# Se temperatura = null, é um valor descartado
```

### 9. Integração com Sistema de Alarmes

O sistema de alarmes já filtra automaticamente:

```typescript
// src/lib/alarme-detector.ts
condicao: (l) => l.temperatura !== null && l.temperatura > 85
```

Isso garante que alarmes falsos não são criados para valores inválidos.

---

## Resumo

| Antes | Depois |
|-------|--------|
| Gráficos com picos de 32765°C | Gráficos limpos 30-90°C |
| Escalas distorcidas | Escalas apropriadas |
| Alarmes falsos | Alarmes precisos |
| Dados inutilizáveis | Dados confiáveis |

**Aplicar em todas as queries que usem temperatura!**
