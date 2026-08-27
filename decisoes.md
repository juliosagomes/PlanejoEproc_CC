# Decisões de simplificação consciente

> Registro de pontos onde escolhemos **não espelhar fielmente** uma estrutura do Eproc, com a justificativa e o que precisaria mudar para evoluir.
>
> Sempre que detectar a tentação de "espelhar fielmente" um campo do Eproc e isso parecer caro demais para o ganho, registre aqui antes (ou no momento de) implementar.

---

## D-1 · Assunto é texto livre, não vinculado ao catálogo

**Decisão.** O campo "Assunto" da regra/transição é digitado livremente pelo usuário. Não é um select alimentado por `selAssuntoMultiplo.json`.

**Por que.** O JSON `selAssuntoMultiplo.json` tem ~1 MB e ~3.260 itens. Embutir no bundle aumenta o tamanho desproporcionalmente para um campo que, no protótipo atual, é raramente preenchido e nunca filtrado. O usuário sabe escrever o assunto que precisa.

**O que precisaria mudar para evoluir.** Quando virar requisito (ex.: filtro por assunto, autocomplete validado), trocar o input por um combobox virtualizado (lista grande), e mover o JSON para `src/data/`. Tipo do campo passa de `string` para `{ id: number, descricao: string }`.

---

## D-2 · Filtros opcionais (Bloco 3 do Eproc) — UI mostra subset, tipo comporta o todo

**Decisão.** A modelagem da ATP/Preferência expõe na UI apenas um subset dos 25+ campos de filtro do Bloco 3 do Eproc (gatilho/condição). O **tipo** do domínio, porém, comporta a estrutura completa, então adicionar mais campos na UI no futuro **não exige refatoração de tipo**.

**Por que.** Mostrar todos os filtros de uma vez sobrecarrega a UI e a maioria nunca é usada. Mas se o tipo for restrito ao subset visual, qualquer expansão futura quebra arquivos exportados.

**O que precisaria mudar para evoluir.** Só adicionar o controle visual ao painel/modal — o tipo já aceita o campo. Se preencher um campo novo, schema Zod precisa cobri-lo (atualizar `infra/storage/schema.ts`).

---

## D-3 · `condicoes` da ATP é textarea livre

**Decisão.** O campo `condicoes` (filtros/condições da regra de ATP) é uma `string` livre digitada num textarea, não uma estrutura `Array<{ campo, operador, valor }>` ou similar.

**Por que.** Estruturar condições corretamente exige modelar operadores, tipos de valor por campo, validação cruzada, e UI de "rule builder". Isso é um sub-projeto inteiro. O protótipo trata como prosa ("tipo do documento = Petição inicial; classe = Cumprimento de sentença…") e o usuário entende o que escreveu.

**O que precisaria mudar para evoluir.** Quando feature concreta exigir (ex.: validação automática, simulação), modelar `Condicao = { campoId, operador, valor }`, escrever migração v1→v2 que tenta parsear o texto livre, e introduzir UI dedicada. Schema Zod ganha union discriminada por operador.

---

---

## D-4 · Ação da ATP cindida em código + descrição livre

**Decisão.** `AtpRule` ganhou dois campos: `acaoTipo?: string` (código de `selTipoAcaoProgramada`, ex.: `'CAR'`) e `acao?: string` (descrição livre que suplementa o código). Antes, BETA_2 tinha só `acao` como textarea.

**Por que.** O briefing da Fase 6 pede selects do catálogo `selTipoAcaoProgramada` no modal de detalhamento. A "Ação" canônica do Eproc é o código (23 opções). Mas há detalhes que o catálogo não cobre ("citar por AR no endereço alternativo X") — manter `acao` livre evita perder essa expressividade.

**O que precisaria mudar para evoluir.** Quando o catálogo virar fonte normalizada de exibição (ex.: dashboards), validar `acaoTipo` contra um enum dos códigos canônicos. Migração futura pode tentar parsear o `acao` antigo procurando códigos conhecidos no início do texto.

---

## D-5 · Selects de catálogo usam `react-select`, não `<select multiple>` nativo

**Decisão.** Os 4 selects de catálogo do `EdgeDetailModal` (Eventos, Classes judiciais, Competência, Situação do processo) usam `react-select` em modo `isMulti` com busca, encapsulado no componente `src/components/CatalogMulti.tsx`. O `<select multiple>` nativo (limitado, sem typeahead, com seleção via Ctrl/Cmd-clique pouco descoberta) foi descartado.

**Por que.** Os catálogos têm 40-700 itens; rolar uma lista nativa para encontrar uma classe judicial específica é inviável. `react-select` traz typeahead, navegação por teclado e chips de seleção sem manter dependência vanilla-JS (TomSelect), que exigiria wrapper React comunitário ou adapter manual com refs. A lib é totalmente bundlável pelo Vite (CSS-in-JS via Emotion, embutido no JS) — atende o requisito offline/sem-CDN sem etapa extra.

**O que precisaria mudar para evoluir.** Se algum catálogo crescer demais (≥10k itens) e listar tudo virar custo, ativar `react-window` (via `MenuList` custom do react-select) ou trocar por combobox virtualizado dedicado. Se o tema escuro for adicionado, os `styles` de `CatalogMulti` já leem `var(--…)` — basta os tokens responderem ao tema.

---

---

## D-6 · Parser de XLS via SheetJS embutido

**Decisão.** O catálogo de localizadores do órgão é importado a partir do XLS exportado pelo Eproc, lido em runtime no browser via `xlsx` (SheetJS). A biblioteca é embutida no bundle (~700 KB minificada).

**Por que.** O export oficial do Eproc é XLS binário (OLE2/BIFF8) — não HTML disfarçado nem CSV. As alternativas eram (a) pedir ao usuário converter para CSV no Excel antes de importar (atrito desnecessário num app que já promete ser "abrir e usar"), (b) ter uma página HTML companion só de conversão (UX de duas etapas), ou (c) embutir um parser XLS. Embutir é o caminho mais limpo: a importação acontece num clique. O custo de bundle é amortizado sobre uma feature que o usuário usa frequentemente. SheetJS é a única lib madura que lê BIFF8 em JS puro (sem WASM), é totalmente bundlável pelo Vite, e funciona em `file://`.

**Risco aceito.** SheetJS 0.18.5 (versão pública do npm) tem alertas de prototype pollution / ReDoS. Mitigação: o XLS importado é exclusivamente do próprio órgão do usuário, processado localmente, sem trânsito por servidor. Sem superfície de ataque externa em beta. Atualizar para 0.20.x (CDN oficial) quando a feature exigir.

**O que precisaria mudar para evoluir.** Para outros formatos (XLSX, ODS), o mesmo `XLSX.read()` já cobre — basta o parser não fixar `.xls`. Para suporte a outros sistemas (PJe, etc.), parser específico por origem; estrutura atual de `infra/catalogo/` acomoda.

---

## D-7 · Catálogo do órgão é global por navegador, fora do plano

**Decisão.** O catálogo de localizadores do órgão é persistido em chave própria do `localStorage` (`planejoeproc:catalogo:orgao`), independente dos planos. **Não** entra no JSON exportado de plano. Itens com `Localizador Sistema = Sim` são filtrados no parser e nunca chegam ao storage.

**Por que.** O catálogo é uma propriedade do **usuário/órgão**, não do plano específico. Carregar uma vez deve valer para todos os planos. Se viajasse junto do JSON, planos antigos ficariam com catálogos desatualizados ao abrir noutra máquina, e duplicaríamos centenas de KB no payload de cada export. Filtrar Sistema=Sim no parser é alinhado ao propósito do app: incentivar o usuário a desenhar fluxos próprios; localizadores de sistema do Eproc são padrão e sugeri-los seria contraproducente.

**O que precisaria mudar para evoluir.** Se virar requisito "compartilhar plano + catálogo de uma máquina para outra", adicionar export/import específico do catálogo (botão dedicado), nunca incluí-lo no JSON do plano. Se um dia o usuário quiser ver localizadores de sistema como referência, expor uma toggle no parser (mas continuar sugerindo só os customizados na autocomplete).

---

## D-8 · Sincronização é opt-in, sem login, backend Sheets+Drive

> **Emendada por [D-9](#d-9--sessão-por-lotação-silo-de-armazenamento--tela-de-entrada).**
> O "opt-in por modal" virou escolha de contexto na tela de entrada, e
> "workspace" passou a se chamar **lotação** na UI. O que segue abaixo continua
> valendo: backend, formato de armazenamento e modelo de acesso por código.

**Decisão.** A feature de sincronização (`infra/sync/`, `features/sync/`)
é inteiramente opcional: o app continua funcionando 100% offline para quem
escolher o modo local — nenhuma chamada de rede acontece fora de uma ação
explícita do usuário. O backend é um único Google Apps Script Web App
(código de referência em `apps-script/`), com a planilha guardando só um
índice (workspaces e metadados de cada plano) e o conteúdo de cada plano
salvo como arquivo JSON no Drive, um por plano. Acesso é por código —
`codigoLeitura` (só sincroniza) e `codigoEdicao` (também publica) — sem
login algum; os códigos são, na prática, segredos tipo bearer-token.

**Por que.** Um plano real medido (`exemplos/exemplo-família.json`) já fica
em ~7,4 KB minificado com pouco texto livre preenchido; como `condicoes`,
`acao`, `observacoes` e `minutaConteudo` (D-3/D-4) são `z.string()` sem
`.max()`, um plano de vara completo facilmente passa de 20–80 KB — perto ou
acima do limite de ~50.000 caracteres por célula do Google Sheets. Guardar o
conteúdo em Drive (sem limite prático de tamanho) em vez de numa célula
evita truncamento silencioso, mantendo o mesmo custo zero e a mesma conta
Google. Não há login porque o público (servidores/magistrados usando o
Eproc dentro do próprio órgão) não justifica, na fase de beta, o custo de
implementar autenticação de verdade — o código já restringe quem consegue
ler/escrever a quem o recebeu deliberadamente.

**O que precisaria mudar para evoluir.** Se um `codigoEdicao` vazar, hoje não
há como revogá-lo — precisaria de um endpoint `revogar` no Apps Script que
gera um novo código e invalida o antigo. Se o volume de uso crescer além do
que a cota gratuita do Apps Script aguenta, trocar `infra/sync/client.ts`
para apontar a outro backend (Firebase, Supabase) é isolado — nada em
`domain/` ou no restante de `infra/storage/` depende do transporte.

---

## D-9 · Sessão por lotação: silo de armazenamento + tela de entrada

**Decisão.** O app abre numa **tela de entrada** onde o usuário escolhe o
contexto: modo local, entrar numa **lotação** por código, ou criar uma. Cada
contexto tem seu próprio silo de chaves no `localStorage`
(`planejoeproc:…` no local — o prefixo histórico —, `planejoeproc:lot:<wsId>:…`
nas lotações), gerido por `infra/storage/escopo.ts`. Dentro de uma lotação a
sincronização vira dois botões no cabeçalho — *Baixar do servidor* e, com
código de edição, *Enviar ao servidor* — no lugar do antigo modal
"Compartilhar" com abas e checkboxes de quais planos publicar.

**Por que.** No desenho anterior (D-8) todos os planos viviam num único índice
plano: os locais e os recebidos de qualquer código. Depois de sincronizar com
duas lotações diferentes, o `PlanSwitcher` virava uma lista sem procedência —
o usuário não tinha como saber de quem era cada plano nem o que aconteceria ao
publicar. Isolar por silo torna a resposta estrutural em vez de depender de um
filtro que alguém possa esquecer de aplicar em algum caminho de leitura. Como
consequência, "publicar quais planos?" deixa de ser uma pergunta: a lotação
**é** o conjunto.

Três subdecisões que valem registro:

- **Silo por prefixo de chave, não campo `lotacaoId` filtrado.** Um campo
  exigiria que toda leitura lembrasse de filtrar; o prefixo faz o vazamento
  entre lotações ser impossível por construção. O modo local mantém o prefixo
  antigo, então ninguém precisa de migração.
- **Exclusões propagam por *tombstone*, não por "o push substitui o conjunto".**
  O cliente guarda os `remotoId` que excluiu e os manda em `remover[]` no
  próximo envio. A alternativa — o servidor apagar tudo que não veio no
  payload — apagaria em silêncio o plano que um colega acabou de publicar,
  sempre que o conjunto local estivesse desatualizado.
- **A tela de entrada aparece sempre, mas guarda os códigos.** Aparecer sempre
  deixa explícito em qual contexto se está (era justamente a informação que
  faltava). Guardar o código em claro no `localStorage` é o preço de reentrar
  em um clique; ele já é um bearer-token e o desenho anterior já persistia o
  `codigoEdicao` na mesma condição, então não é regressão — mas é uma
  superfície real: qualquer script rodando na página consegue lê-lo.

**O que precisaria mudar para evoluir.** Se um dia houver login de verdade, a
sessão deixa de ser escolha manual e vira consequência da autenticação — a
`features/sessao/store.ts` continua sendo o único ponto que chama `setEscopo`,
então o resto do app não muda. Se os códigos guardados virarem preocupação
concreta, o caminho é não persistir o de edição (pedir a cada entrada) ou
guardar só um handle opaco resolvido pelo servidor. Se surgir necessidade de
mover um plano entre lotações, hoje só dá por exportar/importar arquivo —
faria sentido uma ação dedicada, porque os silos são isolados de propósito.
Revogação de código continua fora de escopo (ver D-8).

---

## D-10 · Códigos consultáveis dentro da lotação, assimetricamente

**Decisão.** O menu do cabeçalho ganha *Ver códigos de acesso*, que mostra o
que a permissão da sessão autoriza: com código de leitura, só o de leitura;
com código de edição, os dois. Para viabilizar o segundo caso,
`actionSincronizar` passou a devolver `codigoLeitura` **apenas** quando o
código apresentado foi o de edição. O `codigoEdicao` continua não aparecendo
em resposta alguma.

**Por que.** Antes, os códigos apareciam uma única vez — no
`CodigosLotacaoModal`, na criação. Quem não anotou perdia o de leitura para
sempre, e um colega que entrou com o código de edição nunca chegou a vê-lo:
para dar acesso somente-leitura a alguém, a única saída prática era repassar o
código de edição, ou seja, a ausência do recurso *empurrava* para o
compartilhamento excessivo de privilégio. Devolver o código de leitura a quem
já provou ter o de edição não concede capacidade nova: o de edição é
estritamente mais forte — permite tudo que o de leitura permite, e mais. A
assimetria é o que preserva a garantia que importa (leitura nunca vira
edição), e é por isso que a condição vive no **servidor**, não na UI: um
cliente adulterado não consegue pedir o que o código dele não autoriza.

Duas consequências de implementação:

- **`codigoLeitura` é `optional()` no schema Zod.** Uma implantação antiga do
  Apps Script simplesmente não manda o campo; falhar a validação aí derrubaria
  a entrada na lotação inteira por causa de um recurso acessório. A UI degrada
  para um aviso pedindo para republicar o `Code.gs`.
- **Não é persistido.** Fica só em `SessaoLotacao`, em memória, renovado a cada
  `sincronizar`. `LotacaoConhecida` continua guardando um único código — o de
  entrada —, então isto não amplia a superfície do `localStorage` discutida
  em D-9.

**O que precisaria mudar para evoluir.** Com revogação/rotação de código
(fora de escopo, D-8), esta tela é o lugar natural para "gerar novo código de
leitura" — o servidor trocaria o UUID na planilha e a resposta seguinte já
traria o novo. Se um dia houver mais de dois níveis de permissão, a regra
"editor vê tudo abaixo dele" generaliza, mas aí vale ordenar os níveis
explicitamente em vez de repetir `if`.

---

## D-11 · Extensão do Chrome como alvo principal; singlefile rebaixado

> **Emendada por [D-15](#d-15--alvo-único-singlefile-removido).**
> O singlefile não existe mais — o "sem garantia de paridade" descrito abaixo
> durou pouco e virou remoção. O resto (por que a extensão resolve os três
> limites do `file://`) continua valendo, e é o registro de por que o alvo
> existe.

**Decisão.** O produto passa a ser uma **extensão MV3** (`npm run build` →
`dist-ext/`, carregada sem compactação). O alvo singlefile
continua existindo e buildando, mas **sem garantia de paridade de recursos** —
sincronização automática, notificações e réplica de códigos entre máquinas só
existem na extensão. Com isso, o item 3 do "Roadmap FORA de escopo" do
`CLAUDE.md` (Extensão Chrome) sai de lá.

**Por que.** Três limites do `file://` eram estruturais, não de implementação:

1. O `localStorage` é indexado pelo **caminho do arquivo**. Mover a pasta
   "perdia" os planos — o `LEIA-ME.txt` gerado pelo `pack.mjs` chegava a avisar
   isso como se fosse comportamento esperado.
2. Não existe processo de fundo. A sincronização com a lotação só acontecia
   quando alguém clicava, então "o colega publicou e eu não sei" não tinha
   solução possível.
3. Chromium bloqueia ES modules em `file://`, o que obrigava ao singlefile e,
   por tabela, a inlinar tudo num HTML de 1,3 MB.

Em `chrome-extension://<id>` os três somem de uma vez: origem estável, service
worker com `chrome.alarms`, e módulos carregando normalmente. O singlefile
sobrevive porque nem toda máquina de órgão permite instalar extensão, e perder
esse caminho fecharia a porta para quem mais precisa da ferramenta.

**O que precisaria mudar para evoluir.** Publicar na Chrome Web Store exige
conta de desenvolvedor, revisão e política de privacidade; o build já gera o
`manifest.json` com `version` vinda do `package.json`, então falta só zipar e
preencher a ficha. *(A previsão que estava aqui — "se o singlefile virar peso
morto, apagá-lo é uma remoção limpa" — se cumpriu: ver D-15.)*

---

## D-12 · Espelho síncrono do `chrome.storage`, não migração para async

**Decisão.** `infra/storage/` e `infra/sync/` continuam **100% síncronos**. O
que muda é o backend por baixo: `infra/plataforma/storageLike.ts` define a
interface mínima (`getItem`/`setItem`/`removeItem`) e
`infra/plataforma/chromeMirror.ts` a implementa sobre um `Map` em memória,
hidratado uma vez no boot a partir do `chrome.storage` e com escrita
write-through coalescida por microtask. As quatro cópias duplicadas do helper
`getStorage()` (storage, catalogo, syncMap, lotacoes) viraram uma só.

**Por que.** `savePlano` é chamado pela subscription da store do canvas, que não
pode esperar promessa sem virar máquina de estados. Migrar para `async`
contaminaria a store do canvas, a de sessão, a de catálogo, a de sync, o
`App.tsx` e os 135 testes existentes — um refactor grande, arriscado, e cujo
único ganho seria satisfazer a forma da API do Chrome. O espelho entrega a
mesma semântica com uma fronteira de ~150 linhas, e a prova é que a suíte
inteira passou **sem uma linha alterada**.

**Risco aceito.** Uma escrita disparada no `beforeunload` pode não chegar a ser
persistida: o espelho só emite o `chrome.storage.set` na microtask seguinte, e a
página pode morrer antes. Mitigação: `flushPersist()` (que o app já chamava no
`beforeunload`) agora termina em `flushPlataforma()`, que despacha o lote na
hora. Não há como *aguardar* a confirmação num handler de unload — a janela
residual é o tempo do IPC.

**O que precisaria mudar para evoluir.** Se um plano passar a não caber
confortavelmente em memória (hoje o espelho carrega tudo), o caminho é paginar:
manter no `Map` só o índice e o plano ativo, e buscar os demais sob demanda —
o que aí sim exigiria uma API assíncrona para `loadPlano(id)` de plano
não-ativo. Nada mais precisaria mudar.

---

## D-13 · Sincronização de fundo: só a última lotação, só pull, e delegando à aba

**Decisão.** O service worker acorda por `chrome.alarms` (15 min por padrão) e:
sincroniza **apenas a última lotação aberta**; faz **apenas pull** (o push
automático é uma preferência que nasce desligada); e, se houver aba do editor
aberta, **não age** — manda a mensagem `sincronize-voce` e deixa a aba fazer.

**Por que.** Três riscos distintos, cada um com sua resposta:

- **Sincronizar todas as lotações conhecidas** multiplicaria o consumo da cota
  gratuita do Apps Script (`apps-script/README.md`) para baixar planos que o
  usuário não está olhando. A última aberta é a única com chance de importar
  agora.
- **Push automático** manda *todos* os planos locais e propaga tombstones. Sem
  intervenção humana, um silo desatualizado sobrescreveria em silêncio o
  trabalho de um colega — exatamente o cenário que os tombstones existem para
  evitar (D-9). O pull não tem esse risco: preserva rascunhos nunca publicados.
  Por isso a assimetria, e por isso o aviso explícito no popup de quem ligar.
- **Escrever no silo com o editor aberto** corromperia o estado: o plano ativo
  vive na memória da store do canvas, e a próxima gravação com debounce
  escreveria por cima do que acabou de chegar do servidor. Delegar garante uma
  única thread mexendo no silo por vez, e reusa o caminho de recarga que o
  `App.tsx` já tinha para depois do pull.

Como consequência, `infra/sync/operacoes.ts` nasceu: pull e push extraídos do
Zustand, recebendo a lotação por parâmetro, para que worker e UI executem
exatamente o mesmo código. `features/sync/store.ts` virou um wrapper fino.
E como a sessão é memória pura por desenho (D-9), o worker precisa de
`infra/sync/sessaoPersistida.ts` para saber qual lotação é a "última" — que
guarda só o `workspaceId`, nunca o código (esse continua vindo de `lotacoes.ts`).

**O que precisaria mudar para evoluir.** Sincronizar várias lotações pede um
alarme por lotação (ou um laço com espaçamento) e uma política de cota. Push
automático seguro pede detecção de conflito de verdade — hoje não há vetor de
versão nem `updatedAt` por plano no servidor que permita dizer "a minha cópia é
mais velha". Enquanto isso não existir, manter o padrão desligado é a única
posição defensável.

---

## D-14 · Códigos de lotação replicados via `chrome.storage.sync`

**Decisão.** Duas chaves — `planejoeproc:lotacoes` (lotações conhecidas, **com
os códigos**) e `planejoeproc:sync:prefs` — são roteadas pelo espelho para
`chrome.storage.sync` em vez de `local`. Todo o resto, planos inclusive, fica em
`local`. Erro de cota na escrita cai para `local` com aviso, sem quebrar o
fluxo.

**Por que.** Reentrar numa lotação exige o código; sem réplica, quem trabalha em
duas máquinas precisa carregar o código à mão para a segunda — e o atrito
empurra para o hábito de repassar o código de **edição** para tudo, que é
justamente o que o D-10 tentou desestimular. Planos ficam fora porque o limite
do `sync` é 8 KB por item e um plano de vara passa de 20–80 KB (D-8): tentar
replicá-los produziria falhas silenciosas de cota, não sincronização.

**Ampliação consciente da superfície.** O D-9 já registrava que os códigos ficam
em claro e legíveis por qualquer script da página. Agora eles também **trafegam
pela conta Google do usuário** e passam a existir em toda máquina logada no
mesmo perfil Chrome. É o que foi pedido, e o alcance continua limitado ao
próprio usuário — mas é maior do que era, e por isso está escrito aqui.
Consequência de implementação: `registrarLotacao` passa a manter só as **20
lotações mais recentes**, o que mantém o item bem abaixo dos 8 KB.

**O que precisaria mudar para evoluir.** Se um dia houver login de verdade (D-9),
a réplica deixa de fazer sentido: a lista de lotações viria do servidor e o
`sync` guardaria no máximo uma preferência de UI. Se os códigos em claro virarem
preocupação concreta antes disso, o caminho é não replicar o de edição — só o de
leitura — e pedir o de edição a cada máquina nova.

---

## D-15 · Alvo único: singlefile removido

**Decisão.** O alvo singlefile foi **apagado** — `scripts/pack.mjs`, o modo
`singlefile` do Vite, o alvo `dist/` e a dependência `vite-plugin-singlefile`.
Sobrou um alvo: `vite build` → `dist-ext/`. No mesmo movimento, os dois passes
do Vite viraram um (o service worker é uma entrada do build normal, não um
`vite.config.worker.ts` à parte) e o `manifest.json` passou a ser **emitido pelo
próprio build**, por um plugin, em vez de por um script pós-build.

**Por que.** O motivo imediato é o ciclo de desenvolvimento. Com o manifest e os
ícones vindo de um script que rodava *depois* do Vite, `vite build --watch` era
inútil: os assets eram regenerados, mas a pasta ficava sem manifest — e uma
pasta sem manifest não é uma extensão. Consequência prática: era preciso rodar
`npm run pack:ext` à mão a cada alteração para ver qualquer coisa no navegador.
Emitindo o manifest de dentro do build, todo rebuild produz uma pasta completa
por construção, e o ciclo vira `npm run dev:ext` uma vez + F5 na aba.

Manter o singlefile ao lado disso custava um segundo modo de build, um segundo
empacotador, uma dependência e uma seção de documentação — para um alvo que já
estava declarado sem garantia de paridade (D-11) e que ninguém usava. Unificar
também eliminou duplicação real: `infra/storage`, Zod e `infra/sync` estavam
compilados duas vezes, uma no `background.js` e outra no bundle das páginas;
agora são chunks compartilhados (o `background.js` caiu de ~99 KB para ~3 KB).

**Custo assumido, explicitamente.** Quem não conseguir instalar extensão na
máquina do órgão fica **sem o app** — não há mais um caminho alternativo. Essa
era a razão de existir do singlefile, e ela foi deliberadamente descartada em
favor de um repo com uma coisa só. Se essa restrição reaparecer num usuário
real, o alvo está recuperável no histórico do git (commit anterior a este) —
mas reintroduzi-lo significa reintroduzir a assimetria de recursos do D-11, não
um app equivalente.

**O que precisaria mudar para evoluir.** O `localStorage` continua no código
como backend alternativo em `infra/plataforma/` — não por causa do singlefile,
mas porque é o caminho dos testes (jsdom não tem `chrome`) e do `npm run dev`.
Se o service worker um dia recusar os chunks compartilhados, o retorno é um
`vite.config.worker.ts` com `lib` + `inlineDynamicImports`; o sintoma seria erro
de registro do service worker no card de `chrome://extensions`.

---

## Como adicionar uma decisão nova

1. Atribuir ID sequencial (`D-N`).
2. Estrutura: **Decisão** (1 frase) → **Por que** → **O que precisaria mudar para evoluir**.
3. Mencionar `decisoes.md#D-N` no commit ou no comentário do código onde a decisão se manifesta, para o leitor futuro encontrar o porquê.
