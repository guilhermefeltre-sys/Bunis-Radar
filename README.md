# Corretor Privado — Coberturas SP
## Setup completo em 5 passos

---

### O que você recebe

| Arquivo | O que faz |
|---|---|
| `index.html` | Seu site pessoal de busca (abre direto no browser) |
| `agente_busca.js` | Agente Node.js que varre ZAP + Viva Real automaticamente |
| `imoveis.json` | Base de dados gerada pelo agente (alimenta o site) |
| `agente.log` | Log de todas as varreduras |

---

### Passo 1 — Instalar Node.js

Se não tiver, baixe em: https://nodejs.org (versão LTS)

---

### Passo 2 — Instalar dependências

```bash
cd corretor
npm install axios cheerio fs-extra
```

---

### Passo 3 — Rodar o agente uma vez

```bash
node agente_busca.js
```

O agente vai:
1. Buscar coberturas no ZAP Imóveis e Viva Real
2. Filtrar por: Itaim Bibi, Vila Nova Conceição, Jardim Europa
3. Calcular R$/m² e comparar com benchmark de mercado
4. Destacar automaticamente imóveis abaixo do mercado
5. Salvar tudo em `imoveis.json`

---

### Passo 4 — Abrir o site

Abra `index.html` no seu browser. Os dados do `imoveis.json` aparecem automaticamente.

> **Dica:** Para que o site carregue o JSON automaticamente, sirva localmente:
> ```bash
> npx serve .
> # Acesse: http://localhost:3000
> ```

---

### Passo 5 (opcional) — Varredura automática a cada 6h

```bash
node agente_busca.js --watch
```

Deixa rodando em segundo plano (ou num servidor). O site atualiza sozinho.

---

### Análise inteligente com Claude (opcional)

Para ativar análises de IA em cada imóvel, configure sua API key:

```bash
export ANTHROPIC_API_KEY="sua-key-aqui"
node agente_busca.js
```

---

### Hospedar o site online (opcional)

Para acessar de qualquer lugar (celular, tablet):

**Opção gratuita — Netlify:**
1. Acesse https://netlify.com
2. Arraste a pasta `corretor` para o painel
3. Seu site fica em: `https://seu-nome.netlify.app`

**Opção gratuita — GitHub Pages:**
1. Crie repositório privado no GitHub
2. Faça upload dos arquivos
3. Ative GitHub Pages nas configurações

---

### Automatizar varredura na nuvem (opcional)

**GitHub Actions (gratuito):** cria `.github/workflows/busca.yml`:

```yaml
name: Varredura diária
on:
  schedule:
    - cron: '0 7 * * *'   # Todo dia às 7h da manhã
jobs:
  busca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install axios cheerio fs-extra
      - run: node agente_busca.js
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v3
        with:
          name: imoveis
          path: imoveis.json
```

---

### Estrutura de um imóvel no JSON

```json
{
  "id": 123456,
  "addr": "R. João Lourenço, 601 — Lux 600",
  "bairro": "Vila Nova Conceição",
  "tipo": "Cobertura duplex",
  "preco": 4200000,
  "area": 796,
  "quartos": 4,
  "vagas": 8,
  "obs": "Vista 180° Ibirapuera, Bernardes Arquitetura",
  "link": "https://www.zapimoveis.com.br/...",
  "fonte": "ZAP",
  "novo": true,
  "fav": false,
  "data": "2026-03-19",
  "m2": 5276,
  "diff": 80,
  "isOpp": true,
  "score": "A"
}
```

---

### Benchmarks de mercado usados (2025)

| Bairro | R$/m² médio (coberturas) | Faixa |
|---|---|---|
| Itaim Bibi | R$ 22.500 | R$ 18k – R$ 55k |
| Vila Nova Conceição | R$ 26.000 | R$ 22k – R$ 42k |
| Jardim Europa | R$ 28.000 | R$ 21k – R$ 42k |

Fonte: Loft Monitor de Vendas, IPR-SP, dados Portas.com.br (2025)

---

### Suporte

Qualquer ajuste nos filtros ou bairros, edite as primeiras linhas de `agente_busca.js` na seção `CONFIG`.
