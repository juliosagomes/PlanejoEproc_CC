# PlanejoEproc — guia para Claude Code

> Este arquivo é a referência permanente do projeto. Sempre que você (Claude) for invocado nesta pasta, leia-o antes de propor qualquer mudança.

## O que é

Aplicação web React + TypeScript chamada **PlanejoEproc**, derivada do protótipo monolítico `PlanejoEproc__BETA_2.html.html` na raiz. O protótipo é a **fonte da verdade do domínio, dos fluxos de UI e do comportamento esperado**, mas o produto final é um projeto Vite estruturado, com testes, validação de schemas, e arquitetura por camadas.

Estágio: **beta**, sem usuários reais. `SCHEMA_VERSION = 1`. **Sem requisito de retrocompatibilidade** ainda. Migrações virão quando v2 sair.

## Para quem

Servidores e magistrados do Poder Judiciário (TJMG e similares) que usam o Eproc. A ferramenta serve para **planejar fluxos de trabalho dentro do Eproc** — desenhar localizadores, transições, regras de automação — antes de configurá-los no sistema real.

## Restrições do ambiente do usuário final (não-negociáveis)

- App **funciona 100% offline** após download.
- **Sem CDN em runtime.** Nada de `unpkg.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com` no produto final. Tudo embutido no build.
- **Sem instalação.** Abrir o `index.html` por duplo clique numa máquina sem Node, sem internet e sem privilégio de admin tem que funcionar.
- **Distribuição (principal):** pasta `PlanejoEproc/` com `index.html`, `assets/` e `planos/` (gerada por `npm run pack`). O usuário compacta manualmente para enviar ou copia por rede compartilhada.
- **Distribuição (alvo opcional):** HTML único standalone via `npm run build:singlefile` para casos em que distribuir uma pasta inteira atrapalha.

## Stack obrigatória

| Função | Escolha |
|---|---|
| Build & dev | Vite |
| Linguagem | TypeScript com `strict: true` |
| UI | React 18 |
| Estilo | Tailwind CSS **v3** (não v4) |
| Canvas/grafo | ReactFlow 11 |
| Estado canvas | Zustand |
| Validação | Zod (apenas nas bordas) |
| Persistência | localStorage atrás de `infra/storage/` (trocável por IndexedDB depois) |
| Testes | Vitest + jsdom (lógica pura prioridade; UI opcional) |
| Distribuição | `vite build` (HTML + assets em pasta) + `npm run pack`. Singlefile via `vite-plugin-singlefile` é alvo opcional. |
| Pacotes | npm |

**Não troque sem justificar por escrito antes de implementar.**

## Arquitetura

```
src/
  domain/          ← tipos puros e regras. NÃO importa React, ReactFlow, Zod.
  infra/           ← adapter para mundo externo (storage, parsing, futuro fetch).
  features/        ← organização por feature (canvas, checklist, etc.).
  data/            ← JSONs do Eproc embutidos no build (subset).
  components/      ← componentes genéricos (Header, Sidebar, PanelHeader).
  App.tsx
  main.tsx
  index.css
```

**Direção das setas:**
- `domain` não importa nada do projeto.
- `infra` importa `domain`.
- `features` importam `domain` e `infra`.
- `App` orquestra `features`.

Quebra dessa direção é antipadrão. Se sentir vontade de fazer `domain` importar React, **pare** — o desenho está errado.

**Por feature:** cada pasta tem seus próprios componentes, store local (se houver), tipos locais e testes. **Não** crie pasta `components/` global gigante (exceto para os 3-4 componentes verdadeiramente genéricos).

## Padrões de código

- **TypeScript estrito:** `strict: true`, `noUncheckedIndexedAccess`, sem `any` solto. Quando precisar afrouxar, comente o porquê.
- **Imports com alias `@`:** `@/domain` em vez de `'../../domain'`. Configurado em `tsconfig.app.json` + `vite.config.ts` + `vitest.config.ts`.
- **Idioma:** UI 100% em PT-BR. Nomes de código em inglês. Comentários em PT-BR para regras de domínio; em inglês para detalhes técnicos puros.
- **Sem comentários óbvios.** Comente o **porquê**, não o **o quê**.
- **Imports organizados:** externos → internos `@/` → relativos.
- **Componentes em arquivos próprios.** Um exportado por arquivo, salvo casos triviais.
- **Funções pequenas.** > 50 linhas geralmente cabem dois propósitos.
- **Acessibilidade:** WCAG AA. Foco visível, navegação por teclado (Delete remove seleção), `aria-*` em controles não óbvios.

## Glossário do domínio (canônico — não inventar sinônimos)

- **Localizador** — fila/agrupador de processos. É o **nó do grafo**.
- **ATP** — *Automatização de Tramitação Processual*. Aresta animada azul.
- **Preferência** — regra/template do servidor. Aresta verde sólida.
- **Manual** — transição sem automação. Aresta cinza tracejada.
- **Modelo** — minuta/template de texto.
- **Texto padrão** — trecho reutilizável de redação.
- **Regra de ATP** — gatilho + condição + ação.
- **Gatilho** — evento que dispara automação. Espelha `selTipoControle` (9 tipos).
- **Unidade** — vara, cartório, gabinete.
- **Flags do localizador (hardcoded):** `T` Trabalhado, `E` Espera, `G` Gatilho, `F` Fixo de fluxo.
- **Modelagem** — preencher os campos da regra.
- **Simulação** (≠ modelagem) — executar mentalmente o fluxo. **FORA do roadmap.**

## Decisões de modelagem (Nível 2 de fidelidade)

A **estrutura** dos tipos espelha o Eproc real; os **valores** são livres por enquanto (texto/string), e ficarão tipados quando o catálogo entrar.

- **Aresta** tem `rule` discriminado por `kind` (`'atp' | 'pref' | 'manual'`); ATP tem `trigger` discriminado por `tipo` (9 valores espelhando `selTipoControle`).
- **Schema versionado:** `SCHEMA_VERSION = 1`. Toda chave de localStorage e arquivo exportado carrega `version`. Migrações são escritas só quando v2 sair, com **teste de regressão**.
- Decisões deliberadas de simplificação: ver `decisoes.md`.

## Catálogo do Eproc embutido (Caminho A)

48 JSONs originais ficam em `./listas_json/` na raiz. Na **Fase 6**, copiar **apenas** estes para `src/data/`:

- `compSelIdEvento.json` — eventos do gatilho ATP
- `selTipoControle.json` — 9 tipos de controle
- `selTipoAcaoProgramada.json` — 23 tipos de ação programada
- `selClassesJudiciaisMultiplo.json` — classes judiciais
- `selCompetencia.json` — competências
- `selStatusProcessoMultiplo.json` — situações do processo

**Não usar** `selAssuntoMultiplo.json` (1 MB / 3.260 itens — assunto vira texto livre).

## Roadmap FORA de escopo (não começar)

1. Marcação granular de campos.
2. Catálogo da unidade.
3. Extensão Chrome.
4. Integração com Eproc real.
5. Simulação / modo "play".

## Plano de execução (fases)

**Ao final de cada fase:** `npx tsc --noEmit` limpo + `npm test` limpo (se houver) + `git commit "fase N: <descrição>"` + **pausar e reportar**.

- **Fase 0** — Setup, `CLAUDE.md`, `decisoes.md`, Vite + TS, Tailwind v3, Vitest, alias `@`, git init.
- **Fase 1** — Domínio (`src/domain/`): flags, subitems, edges, plano. Tipos puros.
- **Fase 2** — Infra storage (`src/infra/storage/`): schema Zod, load/save, debounce, backup.
- **Fase 3** — Tokens visuais portados do `:root` para `tailwind.config.ts`. Inter local.
- **Fase 4** — Componentes folha sem estado (LocalizadorNode, PjEdge, Icon, Header, Sidebar com handlers vazios).
- **Fase 5** — Store Zustand do canvas + testes.
- **Fase 6** — Componentes compostos (FlowCanvas, NodePanel, EdgePanel + modal, ChecklistModal + derive). Conecta importar/exportar.
- **Fase 7** — Build offline + alvo singlefile + README.

## Regras de ouro

- ❌ Não invente termos do Eproc. Em dúvida, pergunte.
- ❌ Não adicione dep sem justificar.
- ❌ Não pule fases.
- ❌ Não acople `domain` a React/ReactFlow/UI.
- ❌ Não toque no roadmap fora de escopo.
- ❌ Não use CDN em runtime.
- ❌ Não confunda **modelagem** com **simulação**.
- ✅ Em dúvida, pergunte antes de implementar.
- ✅ Commits granulares.
- ✅ Discorde com argumentos quando o pedido conflitar com este guia ou `decisoes.md`.

## Critério de "pronto" da migração

1. Todos os fluxos do `BETA_2.html` funcionam idênticos.
2. JSON exportado reabre sem perda (round-trip testado).
3. `npm run pack` gera `dist-pack/PlanejoEproc/` (com `index.html`, `assets/`, `planos/`, `LEIA-ME.txt`) que abre por duplo clique offline em máquina sem Node nem internet.
4. `npm test` passa limpo.
5. `grep -rE "googleapis|gstatic|unpkg|jsdelivr" dist/` retorna **zero** matches (proibido CDN em runtime).
6. Alvo singlefile (`npm run build:singlefile`) é opcional — quando usado, `vite-plugin-singlefile` precisa estar configurado para inlinar assets binários (WOFF2 viram base64 dentro do CSS).
