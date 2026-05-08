# Registro de Carros com Couchbase

Sistema simples de registro de carros usando Node.js, Express e Couchbase.

## Requisitos

- Node.js 18+
- Couchbase Server em execucao

## Configuracao

1. Copie o arquivo .env.example para .env e ajuste os valores.
2. Crie um bucket no Couchbase (ex: carros).
3. Crie um indice primario para permitir consultas:

```
CREATE PRIMARY INDEX ON `carros`;
```

## Como rodar

```
npm install
npm run start
```

A aplicacao sobe em http://localhost:3000
Se o arquivo .env definir a variavel PORT, a aplicacao usa essa porta (ex: 3001).

## API

- GET /api/cars?limit=10&offset=0
- GET /api/cars/:id
- POST /api/cars
- PUT /api/cars/:id
- DELETE /api/cars/:id

### Exemplo de payload

```
{
  "plate": "ABC-1234",
  "model": "Onix",
  "brand": "Chevrolet",
  "year": 2022,
  "color": "Branco"
}

## Benchmark e graficos (Couchbase)

1. Garanta o Couchbase rodando e o bucket `carros` criado.
2. Ajuste o arquivo `.env` com suas credenciais.
3. Rode o benchmark:

```
node scripts/benchmark.js
```

4. Ajuste o checklist de vulnerabilidade (opcional):

- Arquivo: `data/vulnerability.json`
- Score: 0 = nao, 0.5 = desconhecido, 1 = sim

5. Gere os graficos (PNG):

```
python scripts/plot.py
```

### Atualizar graficos

Sempre que quiser novos resultados:

```
node scripts/benchmark.js
python scripts/plot.py
```

Os PNGs atualizados ficam em `reports/`.

Graficos gerados em `reports/`.
```

## Checklist de vulnerabilidade (Couchbase)

- Use TLS no cluster e rotacione senhas.
- Evite usuario administrador na app; use RBAC com permissoes minimas.
- Parametrize todas as queries N1QL.
- Valide dados no servidor e normalize entradas.
- Proteja variaveis de ambiente (.env fora do repositorio).
- Desabilite portas/servicos nao usados no cluster.
- Audite logs e monitore tentativas de acesso.

## Checklist de desempenho

- Crie indices que suportem as consultas usadas.
- Evite SELECT *; consulte apenas os campos necessarios.
- Use LIMIT/OFFSET para paginar listagens grandes.
- Considere TTL para dados temporarios.
- Monitore latencia e throughput do cluster.
- Agrupe operacoes com bulk quando houver cargas massivas.
