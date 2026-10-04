# PlanejoEproc — guia para Claude Code

> Este arquivo é a referência permanente do projeto. Sempre que você (Claude) for invocado nesta pasta, leia-o antes de propor qualquer mudança.

## O que é

Aplicação web React + TypeScript chamada **PlanejoEproc**, derivada do protótipo monolítico `PlanejoEproc__BETA_2.html.html` na raiz. O protótipo é a **fonte da verdade do domínio, dos fluxos de UI e do comportamento esperado**, mas o produto final é um projeto Vite estruturado, com testes, validação de schemas, e arquitetura por camadas.

Estágio: **beta**, sem usuários reais. `SCHEMA_VERSION = 4` (as flags customizáveis do D-22 trouxeram a v2; a regra virando recurso da aresta, no D-24, trouxe a v3; a regra de ATP espelhando a tela do Eproc, no D-27, trouxe a v4). As migrações moram em `infra/storage/migracoes.ts`, se **encadeiam** (v1→v2→v3→v4) e são aplicadas **dentro do `PlanoSchema`**, para que os sete pontos que chamam `safeParse` as herdem — em especial `loadPlano`, que manda para a quarentena tudo que não valida. Toda versão nova segue esse molde, com teste de regressão — e **congelando** a forma anterior do schema: a v1 reusava o `EdgeSchema` corrente e por isso mudava junto com ele.

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
- **"Catálogo do órgão"** importa o XLS pelo file picker. É o caminho offline, e o
  app **não consegue** ler esse arquivo sozinho — sempre pelo botão. O mesmo
  modal é a tela de **consulta** dos recursos mapeados dos dois caminhos, com as
  anotações do usuário (decisoes.md#D-25).

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
- **Regra de ATP** — os três blocos da tela de cadastro do Eproc: **Regras**
  (comportamento da origem, tipo de controle), **Executar Ação** (ações
  programadas) e **Filtros Opcionais** (decisoes.md#D-27). É um **recurso da aresta**, como
  Modelo ou Texto padrão, e por isso uma transição comporta várias — duas ATPs,
  ou uma ATP e uma preferência (decisoes.md#D-24). Quem nomeia é o recurso; a
  regra guarda só o detalhamento.
- **Gatilho** — evento que dispara automação. Espelha `selTipoControle` (9 tipos),
  que a tela do Eproc chama de **Tipo de Controle**.
- **Ação programada** — o que o Eproc executa depois de mover o processo
  (`selTipoAcaoProgramada`, 24 tipos). Opcional, e pode ser mais de uma, em ordem.
- **Localizador de Erro** — para onde o processo vai se a ação programada falhar.
- **Unidade** — vara, cartório, gabinete.
- **Ações Preferenciais Vinculadas** — rótulo do bloco, no painel do
  localizador, que junta três origens com selo próprio: as que **já atuam** nele
  segundo o Eproc (informação, `decisoes.md#D-16`), as **planejadas** pelo usuário
  (`LocalizadorData.acoesPreferenciais`, viram tarefa no checklist) e as regras de
  ATP **"Por Ação Manual"** que saem dele (derivadas da aresta) — decisoes.md#D-28.
- **Flag do localizador** — marcador definido pelo usuário dizendo **quem
  trabalha** aquele localizador: um **setor** ("Setor de Cálculo") ou um
  **servidor** ("Joana Silva"), como a unidade preferir recortar. Os dois são o
  mesmo tipo de marcador, numa lista plana. A lista é da **unidade** — uma chave
  por silo de armazenamento, ao lado do índice de planos (decisoes.md#D-26); o nó
  guarda ids. `Plano.flags` continua existindo, como **retrato** que viaja com o
  plano exportado ou publicado, e é por ele que a lista se propaga entre colegas.
  Unidade nova nasce com `E` Espera e `F` Fixo de fluxo, e o usuário edita à
  vontade (decisoes.md#D-22).
- **Atalho** — nó que representa outro localizador do mesmo plano, para evitar
  setas longas; não tem nome próprio nem entra no checklist (decisoes.md#D-30).
- **Grupo** — moldura que organiza o desenho; não é setor, não vai ao Eproc nem
  ao checklist (decisoes.md#D-31).
- **Conjunto de eventos** — atalho para selecionar e ler eventos da regra de ATP;
  o plano continua gravando os eventos um a um (decisoes.md#D-29).
- **Consulta salva** — filtro com nome salvo numa tela de relatório do Eproc (que
  o Eproc chama de preferência da tela). Coletada só pelo nome (decisoes.md#D-32).
- **Fila de trabalho** — o que um setor abre no Eproc para saber o que fazer: uma
  preferência de consulta ou uma consulta salva de relatório, com os
  localizadores que ela olha. Mora no **painel da unidade**, que confere a
  **cobertura** (todo localizador do setor numa fila, ou fora de propósito com
  motivo). Não chamar de "consulta": é o termo do usuário (decisoes.md#D-33).
- **Grupo de preferências** — agrupa só filas de **preferência de consulta**;
  minuta e intimação em bloco não entram (decisoes.md#D-33).
- **Modelagem** — preencher os campos da regra.
- **Simulação** (≠ modelagem) — executar mentalmente o fluxo. **FORA do roadmap.**

## Decisões de modelagem (Nível 2 de fidelidade)

A **estrutura** dos tipos espelha o Eproc real; os **valores** são livres por enquanto (texto/string), e ficarão tipados quando o catálogo entrar.

- **Aresta** tem `kind` (`'atp' | 'pref' | 'manual'`), que é escolha do usuário e manda no traço no canvas. As regras são `Subitem`s dela, discriminados pela `categoria`; ATP tem `trigger` discriminado por `tipo` (9 valores espelhando `selTipoControle`).
- **As ações programadas e os filtros da ATP são descritores**, não tipos: `ACOES_PROGRAMADAS` e `FILTROS_DEF`, em `domain/atp/`, dizem quais campos existem; a UI (`CampoDinamico`) e o checklist os leem. As chaves são os **ids dos campos do Eproc**. Para acrescentar um campo, mexa no descritor — não crie JSX nem campo de schema para ele (decisoes.md#D-27).
- **Schema versionado:** `SCHEMA_VERSION = 4`. Toda chave de localStorage e arquivo exportado carrega `version`. Cada migração vem com **teste de regressão** (abrir um plano da versão anterior e conferir que nada se perdeu) — ver `infra/storage/migracoes.test.ts`.
- Decisões deliberadas de simplificação: ver `decisoes.md`.

## Catálogo do Eproc embutido (Caminho A)

Os JSONs originais ficam em `./listas_json/` na raiz. Vão para `src/data/` **só** os que um descritor da regra de ATP cita (`CatalogoId`, em `domain/atp/campos.ts`) — o `Record<CatalogoId, …>` de `data/index.ts` não compila se faltar um. As 24 ações programadas não são JSON: moram no domínio, com os campos de cada uma.

**Não embutir**, e o motivo não é só tamanho (decisoes.md#D-27):

- `selAssuntoMultiplo.json` (1 MB), precedente, entidade, órgão de origem — grandes demais; viram campo de digitação.
- `compSelIdLocalizador*.json`, `compSelVarJuizo.json`, `selClassificadorConteudo.json`, remessa, subseção — são **da unidade ou do tribunal** de quem exportou. O build é o mesmo para todos; lista de uma vara, e nome de gente, não entram nele.

## Roadmap FORA de escopo (não começar)

1. Marcação granular de campos.
2. ~~Catálogo da unidade~~ e ~~Integração com Eproc real~~ — **entraram** em
   agosto/2026 (decisoes.md#D-16). O que continua fora deste tema:
   - **Escrever no Eproc.** A coleta é só leitura, e assim fica.
   - **Detalhe interno da preferência** (evento, localizador destino): exige
     avaliar `arrCamposPersonalizados` no MAIN world, ou seja `eval` — proibido
     pelo critério de "pronto" nº 7.
   - **ATPs cadastradas** (`automatizar_localizadores`).
   - **Filtros das consultas salvas** nas telas de relatório. Os nomes já são
     coletados (decisoes.md#D-32); os filtros só sairiam aplicando a consulta ou
     com `eval`.
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
- Flags do localizador customizáveis por setor/servidor (decisoes.md#D-22).
  Trouxeram a `SCHEMA_VERSION = 2` e a primeira migração.
- Os setores viraram lista da **unidade**, com tela geral de gerenciamento
  (decisoes.md#D-26), em `features/setores/`. Sem bump de versão: `Plano.flags`
  ficou como retrato, e `infra/storage/consolidarSetores.ts` funde por rótulo o
  que cada plano trazia — a mesma função absorve os setores dos planos que chegam
  de fora. Se você for mexer nas flags, é lá, não no `Plano`.
- Localizadores de sistema entram nos dois catálogos, marcados em vez de
  filtrados (decisoes.md#D-23). Sem bump de versão: os campos `sistema` novos são
  opcionais justamente para não mandar catálogo e plano gravados à quarentena.
- A regra de ATP/Preferência virou recurso da aresta (decisoes.md#D-24), em
  `domain/regras.ts`. Trouxe a `SCHEMA_VERSION = 3` e a segunda migração.
- O modal do catálogo lista os recursos mapeados e aceita anotação do usuário
  (decisoes.md#D-25), em `features/catalogo/`. Anotação mora em chave própria,
  fora dos catálogos, porque reimportar sobrescreve os dois.
- O "Detalhar ATP" passou a espelhar a tela *Cadastrar Nova Regra de ATP*
  (decisoes.md#D-27): domínio em `domain/atp/`, modal em
  `features/canvas/components/detalhe/`. Trouxe a `SCHEMA_VERSION = 4` e a
  terceira migração.

### Cards de ideias (outubro/2026)

Análise em `ideias/analise-cards.md`. Todos sem bump de schema — campos novos
opcionais, como no D-23:

- Descrição do recurso quebra linha; planos em ordem recente ou A–Z; câmera
  lembrada por plano (`infra/storage/cameras.ts`, chave de UI por silo).
- Cópias do mesmo localizador acendem juntas no hover (`features/canvas/gemeos.ts`).
- Seleção múltipla: a verdade é o `selected` do ReactFlow nos nós e arestas;
  `selectedId` é derivado. A assinatura de persistência ignora os campos de tela
  (`CAMPOS_DE_TELA` em `features/canvas/store.ts`) — sem isso todo clique
  regravaria o plano.
- Ações preferenciais planejadas e ATP manual no painel do nó (D-28).
- Conjuntos de eventos na regra de ATP (D-29), em `features/eventos/`.
- Atalho de localizador (D-30) e grupos (D-31). As molduras ficam em
  `CanvasState.grupos`, **fora** de `nodes`: o resto do app lê `nodes` como "os
  localizadores". O `ReactFlowProvider` envolve também o painel lateral.
- Consultas salvas na sincronização (D-32).
- Painel da unidade (D-33), em `features/painel/`: filas de trabalho por setor,
  cobertura e grupos de preferências. Chave `painel` por silo, fora do plano; as
  filas guardam localizadores **por nome**. O cabeçalho alterna "Fluxo | Painel
  da unidade", e o atalho Delete fica desligado no painel.
- `components/SugestoesInput.tsx` substitui o `<datalist>` em todo o app: o
  Chrome o desenha escuro e sem estilo possível. Não volte a usar `<datalist>`.
  As barras de rolagem são globais (`::-webkit-scrollbar` em `index.css`); a
  classe `.scroll` não é mais necessária.
- Sigla de setor com até 3 caracteres; a sugestão automática continua em 2.
- Tema escuro por padrão, claro a um clique (D-34). **Cor nova sempre como
  token**, nos dois blocos do topo de `index.css`; cor escrita direto numa
  regra vale para um tema só. Cores que o ReactFlow recebe como texto ficam em
  `CORES_CANVAS` (`FlowCanvas.tsx`).
- O canvas desenha sempre em Diagrama (`FLOW_MODE_DESENHO`); `Plano.flowMode`
  continua no schema, mas não é lido para desenhar (D-34).
- O Eproc passou a amarrar o hash do autocompletar ao `nomeAcao` da tela, e a
  coleta das preferências parou (D-35). Na falha, `aplicarColeta` recebe o
  catálogo anterior e mantém a lista, somada aos nomes das ações
  preferenciais. Recusa de hash chega como HTTP 200 com HTML: trate como
  falha, nunca como lista vazia.
- Cabeçalho enxuto (D-36): o nome do plano ativo **é** o seletor (duplo
  clique ou F2 renomeia), as ações moram nos menus **Plano** e **Unidade**
  (`components/MenuSuspenso.tsx`) e o progresso usa a conta do checklist.
  Botão novo no cabeçalho vira item de menu, não botão solto. Mudou um rótulo
  de menu? O tutorial (`roteiro.ts`, `Passo1Sincronizar.tsx`) e o aviso do
  service worker citam esses nomes.

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
