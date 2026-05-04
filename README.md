# PlanejoEproc

Ferramenta web de **planejamento de fluxos do Eproc** (sistema de tramitação processual eletrônica usado por TJMG e similares). Permite desenhar localizadores como nós, conectá-los com transições (ATP, Preferência, Manual) e gerar um checklist do que precisa ser configurado no Eproc real.

> **Estágio:** beta. `SCHEMA_VERSION = 1`. Sem retrocompatibilidade ainda — migrações virão quando v2 sair.

---

## Distribuição (uso final)

A aplicação roda **100% offline** após download. Nenhuma referência a CDN em runtime. Pode abrir num computador sem Node e sem internet.

Há dois alvos de build, escolha conforme a necessidade:

### Alvo A · Pasta `dist/` (recomendado para distribuição interna)

Estrutura clássica: HTML + pasta `assets/` com JS, CSS e WOFF2 separados. Cache do browser funciona normalmente.

```bash
npm install
npm run build
```

Saída: `dist/index.html` + `dist/assets/`. Para distribuir, **zipe a pasta `dist/`** inteira; o usuário descompacta e abre `index.html` (duplo clique) — funciona via `file://`.

Tamanho típico: ~570 KB JS + ~25 KB CSS + ~225 KB de fontes (WOFF2 + WOFF).

### Alvo B · HTML único (singlefile)

Tudo embutido num único arquivo. Serve quando o usuário recebe o app por e-mail, anexo ou sistema que só aceita um arquivo.

```bash
npm run build:singlefile
```

Saída: `dist-singlefile/index.html` (~870 KB). JS, CSS e os 4 pesos da Inter (WOFF2) ficam todos inlined — fonte como `data:font/woff2;base64,...` no CSS embutido. Não há nenhuma referência externa.

Trade-off: arquivo maior por ser standalone e cache do browser não pode dividir os pedaços.

---

## Desenvolvimento

```bash
npm install         # instalar dependências
npm run dev         # vite dev server (geralmente em http://localhost:5173)
npm test            # vitest run (37 testes)
npm run test:watch  # vitest em modo watch
npm run typecheck   # tsc -b --noEmit
```

Rotas operacionais comuns:

| Comando                       | O que faz                                               |
| ----------------------------- | ------------------------------------------------------- |
| `npm run dev`                 | Servidor de desenvolvimento com HMR.                    |
| `npm run build`               | Build de produção em `dist/`.                           |
| `npm run build:singlefile`    | Build standalone em `dist-singlefile/index.html`.       |
| `npm run preview`             | Serve o `dist/` para inspeção local.                    |
| `npm test`                    | Roda toda a suíte (Vitest, jsdom).                      |
| `npm run typecheck`           | Type check sem emitir nada.                             |

---

## Stack

- **Vite 5** + **React 18** + **TypeScript** com `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`.
- **Tailwind v3** com tokens em PT-BR mapeando variáveis CSS (ver `src/index.css` `:root` + `tailwind.config.ts`).
- **ReactFlow 11** para o canvas.
- **Zustand 4** + `subscribeWithSelector` para a store do canvas.
- **Zod** nas bordas (parsing de localStorage e import de JSON).
- **Vitest 2** + **jsdom** para testes de lógica pura.
- **@fontsource/inter** (subset latin) embutido no bundle.
- **vite-plugin-singlefile** para o alvo standalone.

---

## Arquitetura

```
src/
  domain/          ← tipos puros (SCHEMA_VERSION, Plano, AtpRule, …). Sem React/RF/Zod.
  infra/           ← adapter para mundo externo (storage com Zod e debounce, backup automático).
  features/
    canvas/        ← store, ReactFlow, NodePanel, EdgePanel, modal de detalhamento.
    checklist/     ← derive (função pura) e ChecklistModal.
  data/            ← 6 catálogos do Eproc embutidos (Caminho A — ver CLAUDE.md).
  components/      ← genéricos (Header, Sidebar, PanelHeader, Icon).
  utils/           ← cn, uid.
  App.tsx          ← orquestração.
  main.tsx         ← bootstrap (importa @fontsource e index.css).
  index.css        ← tokens visuais + @layer components.
listas_json/       ← os 48 JSONs originais do Eproc (referência completa,
                     não embutidos no build — só os 6 de src/data/).
PlanejoEproc__BETA_2.html.html
                   ← protótipo monolítico — fonte da verdade do domínio
                     e dos comportamentos esperados.
CLAUDE.md          ← guia para Claude (e humanos): arquitetura, padrões, glossário.
decisoes.md        ← decisões deliberadas de simplificação consciente.
```

**Direção das dependências (não inverter):** `domain` → `infra` → `features` → `App`. `domain` não importa nada do projeto. `components/` não importa de `features/`.

---

## Persistência e migrações

- O plano corrente fica em `localStorage` na chave `planejoeproc:plano`.
- Se o JSON estiver malformado ou não passar no `PlanoSchema` (Zod), o conteúdo é **movido** para `planejoeproc:plano:corrompido:YYYY-MM-DD` e o app abre vazio. Não há perda silenciosa.
- Toda gravação passa por um saver com debounce de 300 ms; mudanças muito próximas coalescem em uma única escrita.
- O atalho `Delete` remove a seleção (nó ou aresta) — exceto quando o foco está em `INPUT`/`TEXTAREA`/`contenteditable`.
- `beforeunload` faz flush do save pendente.
- Quando o `SCHEMA_VERSION` virar 2, a migração será escrita em `src/infra/storage/` com **teste de regressão** (importa arquivo da v1, confere que não perde dado).

---

## Critérios de "pronto" da migração

1. Todos os fluxos do `PlanejoEproc__BETA_2.html.html` funcionam idênticos no projeto Vite.
2. JSON exportado reabre sem perda (round-trip testado).
3. `npm run build` gera ZIP funcional offline em máquina sem Node nem internet.
4. `npm test` passa limpo.
5. `grep -rE "googleapis|gstatic|unpkg|jsdelivr" dist/` retorna zero matches.
6. `npm run build:singlefile` produz `dist-singlefile/index.html` standalone com fontes inlined.

---

## Documentação relacionada

- **`CLAUDE.md`** — guia de stack, arquitetura, glossário de domínio, padrões de código e regras de ouro. Lido por Claude e útil para qualquer dev novo no projeto.
- **`decisoes.md`** — registro de decisões deliberadas de simplificação (D-1: assunto livre; D-2: filtros como subset; D-3: condições textarea; D-4: `acaoTipo` + `acao`).
- **`listas_json/`** — referência completa dos 48 JSONs do Eproc.

---

## Créditos

Criado por **Júlio Henrique de Sá Gomes** (TJMG · `julio.sa@tjmg.jus.br`).
