# PlanejoEproc

Ferramenta web de **planejamento de fluxos do Eproc** (sistema de tramitação processual eletrônica usado por TJMG e similares). Permite desenhar localizadores como nós, conectá-los com transições (ATP, Preferência, Manual) e gerar um checklist do que precisa ser configurado no Eproc real.

> **Estágio:** beta. `SCHEMA_VERSION = 1`. Sem retrocompatibilidade ainda — migrações virão quando v2 sair.

---

## Instalar como extensão

Alvo único (`decisoes.md#D-15`). Nenhuma referência a CDN em runtime; o modo
local nunca toca a rede.

```bash
npm install
npm run build
```

Saída: `dist-ext/` já completo — `manifest.json`, `index.html` (editor),
`popup.html`, `assets/background.js` (service worker) e `icons/`. Não há passo
de empacotamento depois do build.

1. Abra `chrome://extensions`
2. Ligue **Modo do desenvolvedor** (canto superior direito)
3. **Carregar sem compactação** → escolha a pasta `dist-ext`
4. O ícone aparece na barra. Clique nele para o painel, ou **Abrir editor** para
   o canvas em aba inteira.

> **Fixe o ID antes de distribuir.** Sem uma `key` no manifest, o Chrome deriva
> o ID da extensão do **caminho da pasta** — mover ou renomear `dist-ext/` cria
> uma extensão nova, e como `chrome.storage.sync` é indexado por ID, os códigos
> de lotação replicados ficam para trás. Para fixar:
>
> 1. `chrome://extensions` → **Pacote de extensão**, apontando para `dist-ext/`
> 2. guarde o `.pem` gerado **fora do repo** (já está no `.gitignore`)
> 3. `openssl rsa -in chave.pem -pubout -outform DER | openssl base64 -A`
> 4. cole o resultado em `CHAVE_PUBLICA`, no topo de `manifest.config.ts`
>
> O build avisa enquanto a chave estiver vazia.

---

## Desenvolvimento

### O ciclo do dia a dia

```bash
npm run dev:ext      # deixe rodando num terminal
```

É `vite build --watch`: recompila `dist-ext/` a cada save (~1–2 s), mantendo a
pasta sempre completa — o `manifest.json` e os ícones são emitidos pelo próprio
build, não por um script posterior. **A partir daí você só olha para o
navegador:**

| Mudou | O que fazer |
| --- | --- |
| Componente, store, CSS, `infra/` | **F5** na aba da extensão |
| `src/extension/background.ts` | **Recarregar** no card em `chrome://extensions` |
| `manifest.config.ts` | **Recarregar** no card, idem |

Para trabalho de UI puro, `npm run dev` é ainda mais rápido: HMR, sem nem F5. A
ressalva é que ali não existe `chrome.*` — a persistência cai no `localStorage`,
e não há popup, sync de fundo nem notificações.

Comandos:

| Comando               | O que faz                                                     |
| --------------------- | ------------------------------------------------------------- |
| `npm run dev:ext`     | **Watch.** Recompila `dist-ext/` a cada save.                 |
| `npm run dev`         | Servidor de dev com HMR, editor como página comum.            |
| `npm run build`       | Build completo de `dist-ext/` (com typecheck).                |
| `npm run preview`     | Serve `dist-ext/` por HTTP para inspeção (sem `chrome.*`).    |
| `npm run icons`       | Regera os PNGs da extensão (versionados; raramente muda).     |
| `npm test`            | Roda toda a suíte (Vitest, jsdom).                            |
| `npm run typecheck`   | Type check sem emitir nada.                                   |

`dev:ext` deixa o `tsc` de fora de propósito — erro de tipo aparece no editor e
em `npm run typecheck`; pagá-lo a cada save só tornaria o loop lento.

### Depurando o service worker

Em `chrome://extensions`, no card do PlanejoEproc, clique em **service worker**
para abrir o DevTools dele. Os logs saem com o prefixo `[planejoeproc:sw]`. Para
forçar um ciclo sem esperar 15 minutos, no console dele:

```js
chrome.alarms.create('planejoeproc:sync', { delayInMinutes: 0.1 })
```

### Planos de amostra

`exemplos/exemplo-família.json` serve para exercitar "Abrir arquivo" sem ter que
desenhar um fluxo do zero.

---

## Stack

- **Vite 5** + **React 18** + **TypeScript** com `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`.
- **Manifest V3** sem framework de extensão — um build só do Vite, com as duas páginas e o service worker como entradas, e o `manifest.json` emitido por um plugin inline a partir de `manifest.config.ts`. `@types/chrome` só como devDependency.
- **Tailwind v3** com tokens em PT-BR mapeando variáveis CSS (ver `src/index.css` `:root` + `tailwind.config.ts`).
- **ReactFlow 11** para o canvas.
- **Zustand 4** + `subscribeWithSelector` para a store do canvas.
- **Zod** nas bordas (parsing de localStorage e import de JSON).
- **Vitest 2** + **jsdom** para testes de lógica pura.
- **@fontsource/inter** (subset latin) embutido no bundle.

---

## Arquitetura

```
src/
  domain/          ← tipos puros (SCHEMA_VERSION, Plano, AtpRule, …). Sem React/RF/Zod.
  infra/
    plataforma/    ← chrome.storage atrás de um espelho síncrono (D-12);
                     localStorage como backend dos testes e do `npm run dev`.
    storage/       ← planos e catálogo, com Zod, debounce e backup automático.
    sync/          ← cliente HTTP, pull/push headless, mapa, lotações, prefs.
    catalogo/      ← parser do XLS de localizadores do órgão (SheetJS).
    eproc/         ← leitura da unidade no Eproc: parsers puros + Zod + merge.
  features/
    canvas/        ← store, ReactFlow, NodePanel, EdgePanel, modal de detalhamento.
    checklist/     ← derive (função pura) e ChecklistModal.
    sessao/        ← tela de entrada, store da sessão (modo local ou lotação).
    sync/          ← wrapper de UI sobre infra/sync/operacoes.
    plans/         ← switcher de plano e botão de salvar cópia.
    catalogo/      ← os dois catálogos: import do XLS e coleta da unidade.
  extension/       ← só na extensão: service worker, popup, hooks de chrome.*.
    coletor/       ← script injetado na aba do Eproc (regras próprias, ver CLAUDE.md).
  data/            ← 6 catálogos do Eproc embutidos (Caminho A — ver CLAUDE.md).
  components/      ← genéricos (Header, Sidebar, PanelHeader, Icon).
  utils/           ← cn, uid.
  App.tsx          ← orquestração.
  main.tsx         ← bootstrap (hidrata a plataforma antes do primeiro render).
  index.css        ← tokens visuais + @layer components.
manifest.config.ts ← o manifest MV3. Emitido pelo build (plugin em vite.config.ts).
scripts/
  gen-icons.mjs    ← desenha os PNGs da extensão sem dependência externa.
listas_json/       ← os 48 JSONs originais do Eproc (referência completa,
                     não embutidos no build — só os 6 de src/data/).
PlanejoEproc__BETA_2.html.html
                   ← protótipo monolítico — fonte da verdade do domínio
                     e dos comportamentos esperados.
CLAUDE.md          ← guia para Claude (e humanos): arquitetura, padrões, glossário.
decisoes.md        ← decisões deliberadas de simplificação consciente.
```

**Direção das dependências (não inverter):** `domain` → `infra` → `features` → `App`, com `infra/plataforma` no piso (não importa nem `domain`) e `extension` importando de `infra`/`domain`, nunca o contrário. `domain` não importa nada do projeto. `components/` não importa de `features/`.

**`chrome.*` só existe em `infra/plataforma/` e `src/extension/`.** Em qualquer outro arquivo é sinal de fronteira vazada.

---

## Sessão: modo local ou lotação

Ao abrir, o app pergunta **de quem são os planos** antes de mostrar o editor.
São três caminhos:

| Escolha | O que acontece |
|---|---|
| **Abrir modo local** | Os planos ficam só neste navegador. Nenhuma conexão é usada, nunca. |
| **Entrar com código de lotação** | Baixa os planos daquela lotação e passa a trabalhar dentro dela. |
| **Criar nova lotação** | Cria a lotação no servidor e devolve os dois códigos de acesso. |

**Lotação** é o conjunto de planos de uma unidade (vara, cartório, gabinete),
guardado no servidor de sincronização (ver `apps-script/`). Cada uma tem dois
códigos:

- **Código de visualização** — quem tiver só consegue **baixar** os planos.
- **Código de edição** — também consegue **enviar** alterações. Trate como senha.

Os códigos aparecem **uma única vez**, na criação: o servidor não tem como
consultá-los nem revogá-los depois (`decisoes.md#D-8`).

### Isolamento

Cada lotação tem seu próprio silo no `localStorage`, e o modo local tem o dele.
Entrar numa lotação **não apaga nem mistura** nada: o que você vê no seletor de
planos é sempre só o do contexto atual, e sair de um contexto preserva o que
estava lá para a próxima entrada. O catálogo de localizadores do órgão é a
exceção deliberada — continua global ao navegador (`decisoes.md#D-7`).

### Baixar e enviar

Dentro de uma lotação, o cabeçalho ganha dois botões:

- **Baixar do servidor** — traz a versão do servidor. Planos já conhecidos são
  atualizados no lugar; planos excluídos no servidor somem daqui também.
  Rascunhos criados aqui e nunca enviados são preservados.
- **Enviar ao servidor** (só com código de edição) — envia **todos** os planos
  da lotação e propaga as exclusões que você fez. Sem escolher plano a plano:
  a lotação é o conjunto.

Se um envio falhar, as exclusões pendentes não são perdidas — vão junto na
tentativa seguinte.

A tela de entrada guarda as lotações já usadas neste navegador (com o código),
para reentrar em um clique — as **20 mais recentes**. *Esquecer* remove a
lotação da lista sem apagar os planos dela.

### Sincronização automática (só na extensão)

O service worker acorda a cada 15 minutos (ajustável no popup: 15/30/60 ou
desligado) e **baixa** a última lotação que você abriu. Se algo mudou, uma
notificação diz o quê; clicar nela abre o editor.

Três escolhas de desenho que valem saber (`decisoes.md#D-13`):

- **Só a última lotação.** Sincronizar todas as conhecidas gastaria a cota do
  Apps Script baixando planos que ninguém está olhando.
- **Só baixa, por padrão.** Enviar sozinho publicaria *todos* os seus planos e
  propagaria exclusões sem você mandar — com uma cópia local desatualizada, isso
  sobrescreve o trabalho de um colega em silêncio. Há um toggle "Enviar meus
  planos junto" no popup, desligado de fábrica e com o aviso ao lado.
- **Com o editor aberto, quem sincroniza é a aba.** O worker só avisa. Assim uma
  única thread mexe no silo por vez, e o canvas recarrega o plano ativo sozinho
  em vez de ficar exibindo uma versão que o storage não tem mais.

Os códigos das lotações e essas preferências viajam por `chrome.storage.sync`,
ou seja, aparecem em toda máquina logada no mesmo perfil do Chrome. **Planos
não** — só metadados (`decisoes.md#D-14`).

> A sincronização exige que o backend em `apps-script/Code.gs` esteja
> implantado **na versão atual**. Veja `apps-script/README.md`.

---

## Catálogo da unidade: sincronizar com o Eproc

O botão **"Sincronizar com a unidade"**, no cabeçalho, lê da sua unidade no Eproc
os **localizadores**, **preferências**, **modelos** e **textos padrão**, e passa a
usá-los como sugestão no editor — no nome do localizador e nos recursos atrelados
a uma transição.

Cuidado com o vocabulário: aqui há **duas** sincronizações diferentes, e o botão
diz qual é qual.

| | lê de | traz |
|---|---|---|
| *Sincronizar com a unidade* | o Eproc | catálogos da sua vara |
| *Baixar do servidor* | o Apps Script | planos da lotação |

**Como usar**

1. Abra o Eproc numa aba e faça login.
2. Volte para a aba do PlanejoEproc e clique em *Sincronizar com a unidade*.

Não é preciso estar numa tela específica — o app entra pelo painel. Se não houver
aba do Eproc aberta, ele avisa; ele nunca navega por conta própria.

**O que esperar**

É **só leitura**: nada é criado, alterado ou apagado no Eproc. A coleta leva
alguns segundos, porque as telas de modelos e textos padrão precisam ser
paginadas uma a uma.

O resultado aparece com a contagem por tipo. Se alguma fonte vier vazia ou
incompleta, o modal diz **por quê** — perfil sem acesso àquela tela, sessão
expirada, ou paginação que não avançou. Resultado parcial é sucesso: uma tela que
seu perfil não alcança não derruba o resto.

Cada unidade tem seu próprio catálogo, identificado por *servidor + login +
sigla da unidade*. Trocar de unidade no Eproc e sincronizar de novo **não**
sobrescreve o catálogo da anterior; trocar só de papel na mesma vara aproveita o
mesmo catálogo.

**O XLS continua funcionando.** O botão *Catálogo órgão* importa a planilha
exportada do Eproc, e é o caminho de quem não pode usar a coleta. As sugestões
mostram a união dos dois; em nome repetido, o que veio da unidade prevalece.

> Detalhes técnicos das rotas usadas, e por que cada uma foi escolhida:
> `decisoes.md#D-16`.

---

## Persistência e migrações

- Os planos ficam em `chrome.storage.local`. Todo o resto do código continua
  enxergando uma API **síncrona** — `chrome.storage` é assíncrono, então há um
  espelho em memória hidratado no boot, com escrita write-through
  (`decisoes.md#D-12`). A escolha do backend acontece num único ponto
  (`src/infra/plataforma/`), que cai no `localStorage` onde não há `chrome.*`:
  os testes em jsdom e o `npm run dev`.
- As chaves são prefixadas pelo silo da sessão: `planejoeproc:…` no modo local
  (as mesmas de sempre) e `planejoeproc:lot:<workspaceId>:…` dentro de uma
  lotação. Ver `src/infra/storage/escopo.ts`.
- Sem sessão escolhida, o storage é inerte: toda leitura devolve vazio e toda
  escrita é no-op — a tela de entrada não tem como sobrescrever plano nenhum.
- A chave legada `planejoeproc:plano` (formato single-plano) é migrada uma
  única vez, e só no modo local.
- Se o JSON estiver malformado ou não passar no `PlanoSchema` (Zod), o conteúdo é **movido** para `planejoeproc:plano:corrompido:YYYY-MM-DD` e o app abre vazio. Não há perda silenciosa.
- Toda gravação passa por um saver com debounce de 300 ms; mudanças muito próximas coalescem em uma única escrita.
- O atalho `Delete` remove a seleção (nó ou aresta) — exceto quando o foco está em `INPUT`/`TEXTAREA`/`contenteditable`.
- `beforeunload` faz flush do save pendente.
- Quando o `SCHEMA_VERSION` virar 2, a migração será escrita em `src/infra/storage/` com **teste de regressão** (importa arquivo da v1, confere que não perde dado).

---

## Critérios de "pronto" da migração

1. Todos os fluxos do `PlanejoEproc__BETA_2.html.html` funcionam idênticos no projeto Vite.
2. JSON exportado reabre sem perda (round-trip testado).
3. `npm run build` gera `dist-ext/` completo, que carrega sem compactação e abre o editor em aba.
4. `npm run dev:ext` mantém `dist-ext/` completo a cada rebuild — salvar e apertar F5 mostra a mudança, sem rodar npm de novo.
5. `npm test` passa limpo.
6. `grep -rE "googleapis|gstatic|unpkg|jsdelivr" dist-ext/` retorna zero matches.
7. `dist-ext/` não contém `eval(` nem `new Function(` — a CSP do MV3 bloqueia os dois.

---

## Documentação relacionada

- **`CLAUDE.md`** — guia de stack, arquitetura, glossário de domínio, padrões de código e regras de ouro. Lido por Claude e útil para qualquer dev novo no projeto.
- **`decisoes.md`** — registro de decisões deliberadas (D-1: assunto livre; D-2: filtros como subset; D-3: condições textarea; D-4: `acaoTipo` + `acao`; D-8: backend Sheets+Drive; D-9: sessão por lotação; D-11: extensão como alvo principal; D-12: espelho síncrono do `chrome.storage`; D-13: sync de fundo só-pull; D-14: códigos via `chrome.storage.sync`; D-15: alvo único).
- **`apps-script/README.md`** — deploy e republicação do backend de sincronização.
- **`listas_json/`** — referência completa dos 48 JSONs do Eproc.

---

## Créditos

Criado por **Júlio Henrique de Sá Gomes** (TJMG · `julio.sa@tjmg.jus.br`).
