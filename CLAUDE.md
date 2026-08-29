# PlanejoEproc — guia para Claude Code

> Este arquivo é a referência permanente do projeto. Sempre que você (Claude) for invocado nesta pasta, leia-o antes de propor qualquer mudança.

## O que é

Aplicação web React + TypeScript chamada **PlanejoEproc**, derivada do protótipo monolítico `PlanejoEproc__BETA_2.html.html` na raiz. O protótipo é a **fonte da verdade do domínio, dos fluxos de UI e do comportamento esperado**, mas o produto final é um projeto Vite estruturado, com testes, validação de schemas, e arquitetura por camadas.

Estágio: **beta**, sem usuários reais. `SCHEMA_VERSION = 1`. **Sem requisito de retrocompatibilidade** ainda. Migrações virão quando v2 sair.

## Para quem

Servidores e magistrados do Poder Judiciário (TJMG e similares) que usam o Eproc. A ferramenta serve para **planejar fluxos de trabalho dentro do Eproc** — desenhar localizadores, transições, regras de automação — antes de configurá-los no sistema real.

## Restrições do ambiente do usuário final (não-negociáveis)

- App **funciona offline** para tudo que não seja sincronização. Modo local nunca toca a rede.
- **Sem CDN em runtime.** Nada de `unpkg.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com` no produto final. Tudo embutido no build. Na extensão isso deixa de ser só disciplina: a CSP do MV3 (`script-src 'self'`) proíbe.

### Um alvo só: a extensão (decisoes.md#D-15)

`npm run build` → `dist-ext/`, instalada em `chrome://extensions` → Modo do
desenvolvedor → **Carregar sem compactação**. Não existe alvo alternativo: quem
não puder instalar extensão fica sem o app, e isso é custo assumido no D-15.

O `manifest.json` e os ícones são **emitidos pelo próprio build** (plugin
`extensao()` no `vite.config.ts`, a partir de `manifest.config.ts`), então
`dist-ext/` sai completo de cada compilação — inclusive em watch. Não há passo
de empacotamento depois do Vite; se você sentir vontade de criar um, leia o
D-15 primeiro, porque foi exatamente ele que quebrou o ciclo de dev.

O service worker é uma **entrada do build normal**, não um segundo passe:
`"type": "module"` no manifest permite `import` estático dos chunks
compartilhados. Por isso `background.js` tem ~3 KB em vez de reempacotar
`infra/` e Zod.

Dois caminhos para conhecer os localizadores da unidade, e os dois continuam
existindo (decisoes.md#D-16):

- **"Sincronizar com a unidade"** lê direto do Eproc, na aba onde o usuário já
  está logado. Exige extensão instalada e sessão viva.
- **"Catálogo órgão"** importa o XLS pelo file picker. É o caminho offline, e o
  app **não consegue** ler esse arquivo sozinho — sempre pelo botão.

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
| Parser XLS | `xlsx` (SheetJS) — só para importar catálogo do órgão (decisoes.md#D-6) |
| Persistência | `chrome.storage.local`, atrás de `infra/plataforma/` (decisoes.md#D-12). O `localStorage` fica como backend dos testes e do `npm run dev` |
| Extensão | Manifest V3, sem framework de extensão (nada de crxjs/webextension-polyfill) |
| Tipos do Chrome | `@types/chrome` (devDependency) — sem ele, `chrome.*` seria `any` solto sob `strict` |
| Testes | Vitest + jsdom (lógica pura prioridade; UI opcional) |
| Distribuição | `npm run build` → `dist-ext/`. Alvo único (decisoes.md#D-15) |
| Pacotes | npm |

**Não troque sem justificar por escrito antes de implementar.**

## Arquitetura

```
src/
  domain/          ← tipos puros e regras. NÃO importa React, ReactFlow, Zod.
  infra/           ← adapter para mundo externo (storage, parsing, rede).
    plataforma/    ← nível mais baixo: decide localStorage vs chrome.storage.
    storage/       ← planos e catálogo do órgão, sempre SÍNCRONO.
    catalogo/      ← parser do XLS de localizadores do órgão (SheetJS).
    eproc/         ← leitura da unidade no Eproc: parsers puros, Zod, merge.
    sync/          ← cliente HTTP, pull/push headless, mapa e lotações.
  features/        ← organização por feature (canvas, checklist, tutorial…).
  extension/       ← só a extensão: service worker, popup, hooks de chrome.*.
    coletor/       ← script injetado na aba do Eproc. Regras próprias, ver abaixo.
  data/            ← JSONs do Eproc embutidos no build (subset).
  components/      ← componentes genéricos (Header, Sidebar, PanelHeader).
  App.tsx
  main.tsx
  index.css
```

**Direção das setas:**
- `domain` não importa nada do projeto.
- `infra/plataforma` não importa nem `domain` — é o piso.
- `infra` importa `domain`.
- `features` importam `domain` e `infra`.
- `extension` importa `domain` e `infra`; **nunca** o contrário.
- `App` orquestra `features` e `extension`.

Quebra dessa direção é antipadrão. Se sentir vontade de fazer `domain` importar React, **pare** — o desenho está errado.

**Três regras extras por causa da extensão:**

- **`chrome.*` só aparece em `infra/plataforma/` e `src/extension/`.** Em qualquer outro lugar é sinal de que a fronteira vazou. `features/` e `App` falam com a extensão por hooks e mensagens tipadas (`extension/mensagens.ts`).
- **`infra/storage` é síncrono e continua assim.** Se surgir vontade de torná-lo `async` para "acompanhar o `chrome.storage`", leia `decisoes.md#D-12` primeiro — o espelho existe exatamente para evitar isso.
- **O service worker não escreve plano.** Ele verifica o servidor e notifica; aplicar é sempre um clique do usuário no editor (`decisoes.md#D-17`). Se aparecer a ideia de "sincronizar sozinho para poupar um clique", ela já foi implementada e removida — o motivo está no D-17, e é perda de trabalho, não preferência de estilo.

**Três regras do coletor (`extension/coletor/eproc.ts`).** Ele é injetado na aba
do Eproc por `chrome.scripting.executeScript`, e isso impõe restrições que não
existem em nenhum outro arquivo do projeto:

- **Tudo vive dentro da função.** O `executeScript` serializa com `toString()` e
  re-avalia na outra página; nada do escopo de módulo existe lá. Um helper no
  topo do arquivo ou um `import` de valor vira `ReferenceError` **no console da
  aba do Eproc**, não no do app. Só `import type` é permitido. Há teste que
  reproduz a re-avaliação em escopo vazio justamente para isso.
- **Roda em `world: 'MAIN'`.** As telas de modelos e textos padrão só paginam
  chamando `infraAcaoPaginar`, função **da página**, que o mundo isolado não
  enxerga. No isolado a coleta traz só a primeira página sem erro nenhum.
- **Ele não parseia.** Recorta fragmentos HTML/XML e devolve; interpretar é
  trabalho de `infra/eproc/`, onde há testes. Consequência: o que exige escolha
  (qual tabela pegar) é decidido **dentro** da página, para que dado alheio —
  como a tabela de servidores de um grupo — nunca saia de lá.

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
- **Ação preferencial** — o **vínculo** entre uma preferência e um localizador,
  como o Eproc chama. Não é sinônimo de Preferência: a preferência é a regra, a
  ação preferencial é o fato de ela atuar naquele localizador.
- **Manual** — transição sem automação. Aresta cinza tracejada.
- **Modelo** — minuta/template de texto.
- **Texto padrão** — trecho reutilizável de redação.
- **Regra de ATP** — gatilho + condição + ação.
- **Gatilho** — evento que dispara automação. Espelha `selTipoControle` (9 tipos).
- **Unidade** — vara, cartório, gabinete.
- **Ações Preferenciais Vinculadas** — rótulo do bloco que lista, no painel do
  localizador, as preferências que já atuam nele segundo o Eproc. É informação,
  não plano (`decisoes.md#D-16`).
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
2. ~~Catálogo da unidade~~ e ~~Integração com Eproc real~~ — **entraram** em
   agosto/2026 (decisoes.md#D-16). O que continua fora deste tema:
   - **Escrever no Eproc.** A coleta é só leitura, e assim fica.
   - **Detalhe interno da preferência** (evento, localizador destino): exige
     avaliar `arrCamposPersonalizados` no MAIN world, ou seja `eval` — proibido
     pelo critério de "pronto" nº 7.
   - **ATPs cadastradas** (`automatizar_localizadores`).
   - **Gerar arestas** a partir das ações preferenciais coletadas. Os vínculos já
     são sincronizados e aparecem como **informação** no painel do localizador
     ("Ações Preferenciais Vinculadas"). Convertê-los em arestas do plano é outra
     coisa: muda a premissa do app, que existe para você *desenhar* o fluxo, e o
     transformaria em diagramador do que já está lá. Pode ser o uso certo —
     desenhar o "como está" antes do "como deveria ser" —, mas é decisão de
     produto, não continuação. Decidir antes de codar.
3. Simulação / modo "play".
4. ~~Publicação na Chrome Web Store~~ — **entrou** em agosto/2026. O alvo agora
   é a **loja pública**. O que isso muda no dia a dia: `manifest.config.ts` é
   material de revisão da Google (cada `permission` precisa de justificativa
   defensável), a `CHAVE_PUBLICA` deixa de ser opcional, e mudança de
   comportamento visível ao usuário pede versão nova em `package.json`.
   Continua fora: `update_url` próprio e política corporativa TJMG.
5. Auto-reload da extensão em desenvolvimento (a página detectar o rebuild e se
   recarregar sozinha). Avaliado e descartado: F5 resolve, e o mecanismo pediria
   carimbo de build + polling — mais peças para dar errado do que economia de
   teclas.

## Plano de execução (fases)

**Ao final de cada fase:** `npx tsc --noEmit` limpo + `npm test` limpo (se houver) + `git commit "fase N: <descrição>"` + **pausar e reportar**.

- **Fase 0** — Setup, `CLAUDE.md`, `decisoes.md`, Vite + TS, Tailwind v3, Vitest, alias `@`, git init.
- **Fase 1** — Domínio (`src/domain/`): flags, subitems, edges, plano. Tipos puros.
- **Fase 2** — Infra storage (`src/infra/storage/`): schema Zod, load/save, debounce, backup.
- **Fase 3** — Tokens visuais portados do `:root` para `tailwind.config.ts`. Inter local.
- **Fase 4** — Componentes folha sem estado (LocalizadorNode, PjEdge, Icon, Header, Sidebar com handlers vazios).
- **Fase 5** — Store Zustand do canvas + testes.
- **Fase 6** — Componentes compostos (FlowCanvas, NodePanel, EdgePanel + modal, ChecklistModal + derive). Conecta importar/exportar.
- **Fase 7** — Build offline + README.

### Port para extensão do Chrome (concluído)

- **Fase A** — `infra/plataforma/`: `StorageLike`, espelho síncrono do
  `chrome.storage`, e as 4 cópias de `getStorage()` unificadas numa só.
- **Fase B** — Alvo de build da extensão + `scripts/gen-icons.mjs`.
- **Fase C** — `infra/sync/operacoes.ts` (pull/push sem UI, compartilhados com o
  worker), `infra/sync/sessaoPersistida.ts`, `extension/background.ts`, e o
  editor reagindo a mudanças externas.
- **Fase D** — Allowlist de `chrome.storage.sync` para códigos e preferências +
  popup.
- **Fase E** — Alvo único (decisoes.md#D-15): singlefile apagado, os dois
  passes do Vite fundidos num só, manifest emitido pelo build, e `npm run
  dev:ext` (watch) como ciclo de desenvolvimento.

### Preparação para a loja (em curso, agosto/2026)

- Marca única: o glifo do ícone da extensão substituiu o "eP" no cabeçalho e na
  tela de entrada (`components/BrandMark.tsx`). Mexeu no desenho de
  `scripts/gen-icons.mjs`? Refaça a conta de coordenadas lá também.
- Verificação de fundo no lugar da sincronização automática (decisoes.md#D-17).
- "Apagar todos os planos", só no modo local (decisoes.md#D-18).
- Sessão de visualização virou somente leitura de verdade (decisoes.md#D-19).
- A marca do cabeçalho mostra/esconde a barra lateral.
- Tutorial de 8 slides na primeira execução (decisoes.md#D-20), em
  `features/tutorial/`. As ilustrações reusam as **classes** do app, nunca os
  componentes — a lista de classes emprestadas está no topo de
  `ilustracoes/pecas.tsx`; renomeou uma delas, passe o grep lá.

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
3. `npm run build` gera `dist-ext/` **completo** — manifest, ícones, páginas e service worker — que carrega sem compactação no Chrome e abre o editor em aba.
4. `npm run dev:ext` mantém `dist-ext/` completo a cada rebuild: salvar um arquivo e apertar F5 na aba mostra a mudança, sem rodar npm de novo.
5. `npm test` passa limpo.
6. `grep -rE "googleapis|gstatic|unpkg|jsdelivr" dist-ext/` retorna **zero** matches (proibido CDN em runtime).
7. `dist-ext/` não contém `eval(` nem `new Function(` — a CSP do MV3 os bloqueia, e um deles escondido numa dependência só aparece em runtime.
