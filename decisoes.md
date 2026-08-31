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

> **Emendada por [D-23](#d-23--localizadores-de-sistema-entram-marcados-em-vez-de-filtrados).**
> O filtro de `Localizador Sistema = Sim` deixou de existir: eles entram no
> catálogo, marcados. O resto abaixo — chave própria, fora do JSON do plano —
> continua valendo.

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

> **Superada em parte pelo D-17** (agosto/2026). O que sobrou de pé: "só a
> última lotação". O pull automático e a delegação à aba foram removidos — o
> worker não escreve mais plano nenhum. Fica registrada porque o raciocínio
> sobre cota continua valendo e porque a terceira bala descreve o problema que
> o D-17 resolveu de outro jeito.


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

## D-16 · Catálogo lido direto da unidade no Eproc

**Decisão.** O app passa a ler localizadores, preferências, modelos, textos
padrão e os **vínculos de ação preferencial** **direto do Eproc**, por um botão
no cabeçalho. A coleta roda na aba do
Eproc já autenticada, via `chrome.scripting.executeScript` sob demanda —
não há `content_scripts` no manifest, então nada roda no Eproc sem o clique. Só
leitura: nada é escrito no sistema do tribunal. Com isso, os itens 2 e 3 do
"Roadmap FORA de escopo" do `CLAUDE.md` saem de lá.

O código novo mora em `infra/eproc/` (parsers puros + Zod + merge) e
`extension/coletor/` (o script injetado). **Não** em `infra/sync/`, que é a
sincronização de *planos com o Apps Script* (D-8/D-9/D-13) e não tem relação
nenhuma com o Eproc. Misturar as duas sob o mesmo nome é o principal risco de
confusão da feature; na UI, "sincronizar" passou a exigir qualificação — *com a
unidade* × *com o servidor*.

**Por que assim, e não como estava planejado.** Quase toda decisão aqui foi
corrigida pelo contato com o Eproc real, e vale registrar o que foi medido:

- **Não existe URL de ação montável.** Toda ação exige `hash` assinado, e o hash
  é de uso único. Só se segue `<a href>` vindo do DOM. Entrada estável:
  `https://<host>/eproc/` (raiz, sem query) redireciona para o painel com hash
  novo.
- **`localizador_orgao_listar` responde a `fetch` e pagina por POST** do form —
  medido: 50+50+50+29 = 179 únicos, zero sobreposição. O Epryx usa iframe aqui;
  partindo do painel de secretaria, não é preciso.
- **Modelos e textos padrão exigem o iframe.** Nessas telas todos os controles de
  página são `javascript:infraAcaoPaginar(…)`: sem URL para seguir, o POST do
  form devolve página sem grade, e trocar itens-por-página não dispara requisição
  alguma (verificado com o monitor de rede). Paginar exige o JS da página rodar.
- **O coletor roda em `world: 'MAIN'`.** O mundo isolado, que é o padrão, não
  enxerga funções da página — `infraAcaoPaginar` seria invisível e a coleta
  traria só a primeira página **sem erro nenhum**. O coletor não usa `chrome.*`;
  se um dia usar, esta escolha quebra.
- **Preferências vêm do autocompletar**, uma requisição por tipo
  (`nomeAcao` = `minuta_cadastrar` / `processo_movimento_consultar` /
  `processo_intimacao_bloco`), sem paginação. Um único `hash`, extraído do HTML
  de qualquer tela de lista do painel, serve os três. A alternativa —
  passear pelos grupos de preferências — custava 6 requisições e passava por uma
  tela que lista **nome e login dos servidores do grupo**; o autocompletar não
  toca nesse dado.
- **Modelos vêm da grade, não do autocompletar.** O autocompletar
  (`modelo_matriz_padrao_auto_completar`) devolve 933 numa requisição, mas só
  existe com processo aberto e mistura modelos de todo o tribunal. A grade dá os
  ~180 **da unidade** — para um catálogo de unidade, a rota mais rica não é a
  mais adequada.

**Vínculos de ação preferencial: coletados, mas só como informação.**
`localizador_acao_preferencial_listar` é a única fonte que não é catálogo — não é
lista de nomes para sugerir, é **relação**: no vocabulário do PlanejoEproc, as
arestas verdes que a unidade já tem. Ela responde a `fetch` e **não pagina**
(devolve tudo, sem rodapé de registros), então custa uma requisição.

O consumo é deliberadamente tímido: um bloco de leitura no painel do localizador
("No Eproc, já atuam aqui"), que some quando não há o que dizer. **Não** gera
arestas no plano. A razão não é técnica — o parser é o mais fácil de todos —, é
de produto: o app existe para o usuário *desenhar* o fluxo, e materializar o
fluxo atual como arestas o transformaria em diagramador do que já está lá. Pode
vir a ser o uso certo; enquanto não for decidido, mostrar ao lado é reversível e
gerar não é.

**Escopo por unidade.** Chave `host::login::sigla`, lida ao vivo de
`#selInfraUnidades` e `#nav-profile`. Um host serve todas as varas do tribunal;
chavear só por host faria a coleta de uma unidade sobrescrever a da outra sem
nada denunciar a troca. A sigla exclui o **papel** de propósito: o mesmo usuário
aparece na mesma vara como "Gerente de Secretaria" e como "Usuário Automatizador",
e chavear pelo `value` do `<option>` criaria um catálogo por papel.

O catálogo do XLS (D-7) **continua existindo**. É o caminho de quem não pode usar
a coleta, e o app precisa seguir 100% offline. As sugestões leem a união dos dois,
com o da unidade vencendo em colisão.

**Sobre o Epryx.** O usuário tem permissão dos autores para reusar o código (o
`CLAUDE.md` afirmava o contrário e foi corrigido junto com esta decisão). Na
prática o que se aproveitou foi o **mapa** — quais telas expõem o quê, e as
armadilhas conhecidas —, não arquivos: o Epryx é JS clássico sobre globais e este
projeto é TS estrito em camadas. Duas conclusões dele foram contrariadas por
medição (o iframe no `localizador_orgao_listar`, e o "beco sem saída" do
`modelo_padrao_listar`), e uma foi confirmada (o iframe nas grades de modelos e
textos).

**Custo assumido.** A coleta depende de rotas e do DOM do Eproc, que mudam por
tribunal e por versão. A mitigação é degradação por fonte — cada uma tem status e
motivo próprios, e resultado parcial é sucesso — mais conferência de tela antes de
parsear, porque um hash gasto **não dá erro**: desvia para o Painel do Servidor,
que também tem `table.infraTable`. Quebra vai acontecer; o desenho existe para
que ela apareça como aviso, não como dado errado em silêncio.

**O que precisaria mudar para evoluir.** Se um usuário de outro tribunal reportar
desvio no `localizador_orgao_listar`, o caminho de volta é o iframe, que já existe
em `coletarGradePorIframe`. Preferências vêm sem código do Eproc (a tela não expõe
`num_id_form_personalizacao`): qualquer integração mais funda que autocompletar
precisará de outra rota. E se um dia os vínculos virarem arestas de verdade, o
dado já está no catálogo — falta só a decisão de produto e o consumidor.

---

## D-17 · A extensão verifica e avisa; baixar continua sendo decisão do usuário

**Decisão.** O alarme do service worker deixou de fazer pull. Ele consulta o
servidor, compara com o que há no silo (`diffSincronizacao`, que não escreve
nada) e, havendo diferença, **notifica**. Trazer os planos continua existindo
num lugar só: o botão "Baixar do servidor", no cabeçalho do editor. O popup
perdeu o botão "Sincronizar agora" — virou "Verificar agora" — e a preferência
`autoPush` foi removida junto com a `notificar`.

**Por que.** Um pull aplica a versão do servidor por cima do silo. O alarme não
tem como saber que a pessoa está no meio de uma alteração, e o D-13 tinha uma
resposta parcial para isso: com o editor aberto, delegava à aba. Só que
delegar não resolvia o problema — apenas mudava quem executava o mesmo pull.
A aba recarregava o plano ativo do storage e o que estivesse sendo escrito
naquele instante sumia. O usuário via o próprio trabalho desaparecer sem ter
clicado em nada, quinze minutos depois de começar.

Sincronização automática pressupõe que a máquina saiba resolver o conflito. Aqui
não há vetor de versão nem merge — a política é "o servidor manda" (D-9). Sob
essa política, a única aplicação segura é a que a pessoa pediu, sabendo o que
tem na tela. Automatizar o resto é automatizar a perda.

`autoPush` cai pelo mesmo argumento, com o sinal trocado: publicar sozinho
sobrescreve o trabalho de um colega em vez do próprio. Ele já nascia desligado
por isso; com o pull automático fora, manter só a metade perigosa não fazia
sentido. E `notificar` deixou de significar algo: a notificação passou a ser o
**único** resultado da verificação — desligá-la com o intervalo ligado seria
pedir para o worker acordar de hora em hora e não fazer nada.

Duas consequências de mecânica que valem registro:

- **O carimbo comparado vem do servidor**, não do relógio local
  (`SyncMapEntry.remotoAtualizadoEm`). Com `Date.now()` daqui, alguns segundos
  de diferença entre os dois relógios fariam a extensão anunciar mudança a cada
  verificação — e uma notificação que sempre aparece é uma notificação que o
  usuário desliga, perdendo junto os avisos verdadeiros. Por isso o `push`
  passou a ler `atualizadoEm` da resposta do `publicar`.
- **O resultado é persistido** (`planejoeproc:sync:pendente`). O worker MV3 é
  reciclado entre eventos: o que o alarme das 14h descobriu não existe mais na
  memória quando o popup abre às 14h05.

**O que precisaria mudar para evoluir.** Pull automático seguro pede o que o
D-13 já apontava e continua faltando: detecção de conflito de verdade. Com
`atualizadoEm` por plano dos dois lados — e agora há, dos dois lados — dá para
construir um "traga só o que não conflita com o que estou editando". Enquanto
esse cálculo não existir, verificar e avisar é a posição defensável. Um passo
intermediário barato: em vez da notificação do sistema, uma faixa dentro do
editor com um botão "baixar agora", para quem já está com a aba aberta.

---

## D-18 · "Apagar todos os planos" só existe no modo local

**Decisão.** O seletor de planos ganhou um "Apagar todos os planos" no rodapé,
e o `App` só passa o handler quando `sessao.tipo === 'local'`. A confirmação
não é um `window.confirm`: pede que o usuário digite `APAGAR`.

**Por que.** O modo local acumula lixo — plano de teste, cópia de cópia,
importação que deu errado — e apagar um a um pelo menu é trabalho manual sem
recompensa. Numa lotação a mesma ação seria outra coisa inteiramente: cada
exclusão vira tombstone e propaga ao servidor no envio seguinte, ou seja,
apagaria o trabalho da unidade inteira para todo mundo. A distância entre
"limpar meu navegador" e isso é grande demais para caber no mesmo botão, com o
mesmo rótulo, a um clique de distância.

O `APAGAR` digitado existe porque daqui não há desfazer **nem cópia remota**: o
modo local nunca envia nada. Um `confirm` está a um Enter distraído do
irreversível.

`excluirTodosPlanos()` percorre o índice em vez de varrer o storage por
prefixo, e isso é a parte que mais pede cuidado de quem for mexer:
`planejoeproc:` é prefixo de `planejoeproc:lot:<wsId>:`, então uma varredura
ingênua rodada no modo local levaria junto os planos de todas as lotações. Há
teste para exatamente esse caso.

**O que precisaria mudar para evoluir.** Se um dia fizer sentido esvaziar uma
lotação, é operação de servidor com confirmação própria e registro de quem fez
— não o mesmo botão com outra `sessao`.

---

## D-19 · Sessão de visualização é somente leitura de verdade

**Decisão.** Entrar numa lotação com o **código de leitura** trava a edição.
Antes, "visualização" significava só "não pode publicar": o usuário editava à
vontade e a alteração ficava no silo local dele. Agora nada altera o plano —
canvas, painéis, checklist e nome do plano ficam desabilitados, e a
persistência é desligada.

**Por que.** O rótulo dizia uma coisa e o app fazia outra. Quem recebe um
código de leitura entende que está olhando, não editando; a UI reforçava isso
com o selo "Visualização" e ainda assim aceitava tudo. O resultado eram
alterações que a pessoa achava que estavam valendo e que ninguém mais veria —
o pior dos dois mundos, porque nem editar de verdade ela estava, nem sabia
disso. E o primeiro "Baixar do servidor" sobrescrevia esse trabalho fantasma
sem aviso, porque o servidor manda (D-9).

**Onde a trava mora, e por que em dois lugares.** O guarda de verdade é a flag
`somenteLeitura` na store do canvas: toda mutação de conteúdo vira no-op e a
assinatura de persistência não agenda gravação. Esconder botão não é garantia —
atalho de teclado, modal já aberto quando a sessão trocou, ou um componente
novo que alguém esqueça de gatilhar passariam direto. A UI desabilita por cima
disso porque um campo que aceita digitação e descarta o texto é pior do que um
campo cinza.

Três coisas continuam liberadas de propósito, e a fronteira é "isto muda o
plano?":

- **Selecionar nó/aresta e abrir o detalhamento** — é como se *lê* o plano.
  O modal abre com os campos travados em vez de não abrir.
- **Trocar Orgânico/Diagrama** — é como o plano é desenhado na tela, não o que
  ele diz. Como a persistência está desligada, a escolha vive só naquela aba.
- **Salvar cópia, gerar checklist, catálogos do órgão e da unidade** — exportar
  é leitura, e os catálogos são globais ao navegador (D-7), não conteúdo da
  lotação de ninguém.

Dois detalhes que só aparecem rodando: a sessão de leitura **não** cria o plano
em branco de cortesia num silo vazio (seria a primeira escrita de um modo que
promete não escrever), e `flushPersist()` descarta em vez de gravar quando a
flag está ligada — senão um save agendado milissegundos antes da troca de
sessão ainda chegaria vivo ao disco.

**O que precisaria mudar para evoluir.** O pedido natural é "quero mexer na
minha cópia sem publicar". Isso não é afrouxar a trava: é um "Salvar como plano
local" que copia o plano da lotação para o silo local e abre lá, onde a pessoa
é dona. Enquanto isso não existir, o caminho é "Salvar cópia" e reabrir o JSON
no modo local.

---

## D-20 · Tutorial de primeira execução em slides ilustrados

**Decisão.** Na primeira vez que o editor carrega, abre um modal de 8 slides
percorrendo o caminho inteiro do produto: sincronizar com a unidade → criar dois
localizadores → conectar → tipo e resumo → recurso atrelado → balão de hover →
checklist. Cada slide tem um desenho, e o desenho é **ilustração**: o tutorial
não grava plano, não injeta dados em store nenhuma e não toca no catálogo. Fecha
por Concluir, Pular, X, Esc ou clique no scrim — todos marcam como visto — e
volta pelo "Ver tutorial", na barra lateral.

**Por que slides, e não um tour sobre a UI real.** O tour (balões apontando para
os botões de verdade, resto da tela escurecido) ensina onde as coisas ficam, mas
amarra o tutorial às posições atuais dos elementos: qualquer mexida no cabeçalho
desalinha um balão, e o sintoma é silencioso — ninguém tem teste de "o balão
aponta para o botão certo". Slides desenhados custam o acoplamento oposto, que é
mais barato: ficam desatualizados se o produto mudar, mas isso é revisão de
texto, não bug de layout.

**Por que as ilustrações reusam as classes CSS reais.** As cenas são montadas com
`.pj-node`, `.edge-label`, `.edge-tooltip`, `.subitem`, `.edge-swatch` — as
mesmas do app. Custo zero de bundle (o CSS já existe, e o `content` do Tailwind
já cobre `src/**/*.tsx`), fica idêntico ao produto e acompanha mudança de tema
sozinho. O que **não** dá para reusar são os componentes: `LocalizadorNode`
renderiza `<Handle>` e quebra fora do `ReactFlowProvider`, `PjEdge` chama
`useReactFlow()`, e o `react-select` do `LocalizadorNomeInput` portaliza o menu
em `zIndex: 60` — acima do `.modal` (51), ele escaparia por cima da moldura do
slide. Daí as cópias em HTML puro, com a lista de classes emprestadas anotada no
topo de `ilustracoes/pecas.tsx`: o acoplamento é aceitável, invisível não é.

**Onde os detalhes mordem.**

- **A flag é global ao navegador** (`planejoeproc:tutorial:visto`), fora de silo:
  `escopo.ts` devolve `null` sem sessão, e uma chave com escopo não conseguiria
  ser gravada em metade dos momentos em que faz sentido. Guarda `{ versao, em }`,
  não um booleano — a versão é o que permite reexibir um roteiro novo, e ela é
  constante própria, desacoplada do `package.json` (senão toda release
  reexibiria os slides).
- **Fica fora da allowlist do `chrome.storage.sync`.** A assimetria de erro
  aponta para `local`: não replicar custa rever 8 slides, com "Pular" a um
  clique; replicar mal custa um usuário novo que **nunca** vê o tutorial porque
  outro perfil o dispensou. E a cota do `sync` é apertada para as chaves que
  realmente doem se sumirem (D-14).
- **Abre no inicializador preguiçoso do `useState`, não num `useEffect`.**
  `main.tsx` só renderiza depois de `inicializarPlataforma()` e `getStorage()` é
  síncrono, então a flag já está legível no primeiro render. Com efeito, o editor
  apareceria por um quadro sem o tutorial e os slides cairiam na tela depois.
- **Marca ao fechar, nunca ao abrir.** Marcar só ao concluir faria de "Pular"
  uma promessa quebrada no boot seguinte; marcar na abertura sumiria com o
  tutorial em dev, porque o `StrictMode` roda o efeito duas vezes.
- **Cede a vez ao `CodigosLotacaoModal`.** Ele aparece exatamente no primeiro
  carregamento do editor de uma lotação recém-criada — o mesmo instante em que o
  tutorial quer abrir — e é o que não pode perder a disputa: scrim que não fecha
  e botão travado por checkbox, porque os códigos são exibidos uma única vez
  (D-8). A supressão é explícita (`podeAbrirAgora`), não por z-index nem por
  ordem de irmãos no JSX, que são contratos invisíveis.
- **Não se impõe em sessão de visualização** (D-19): o roteiro inteiro é sobre
  editar. Efeito colateral proposital — como a marca só é gravada ao fechar um
  modal aberto, a sessão de leitura nunca a grava, e quem entrar depois com o
  código de edição ainda ganha a abertura automática.
- **Sem `ModalShell` compartilhado.** Os nove modais do app divergem em coisas de
  verdade (o do checklist é impresso, o dos códigos tem scrim que não fecha), e
  este — bolinhas, três botões, corpo que troca — é o pior molde possível para
  extrair a abstração. Se a dedup vier, é commit próprio, e aí o tutorial já é o
  nono cliente.

**Junto veio uma correção no canvas:** `zoomOnDoubleClick={false}`. O duplo
clique passou a ter um efeito só — criar o localizador onde o cursor está —, que
é o gesto que o passo 3 ensina.

**O que precisaria mudar para evoluir.** Se o roteiro crescer muito, o modal vira
o lugar errado e o caminho é uma página de ajuda própria. Se a queixa for "vi os
slides mas travei na hora de fazer", o passo seguinte é o oposto do que foi
decidido aqui: um tour sobre a UI real, e aí vale medir antes. E se um dia
houver `@testing-library`, o `TutorialModal` ganha teste de render — hoje só a
lógica pura (`roteiro`, `navegacao`, `abertura`, a flag) é coberta.

---

## D-21 · Dobra da seta arrastável no modo Diagrama

**Decisão.** No modo Diagrama, o segmento central de cada seta é uma alça: o
usuário arrasta o cotovelo para onde quiser, e a posição vai para o plano em
`EdgeData.dobra`. Duplo clique na alça, ou o botão no painel da aresta,
restauram o automático. O modo Orgânico continua 100% calculado.

**Por que.**

- **A queixa é real e não tinha saída.** O `getSmoothStepPath` dobra sempre no
  meio geométrico; a própria biblioteca chama seu roteador de *"not as good as
  a real orthogonal edge routing, but good enough as a default"*. Em quadro
  cheio esse meio cai em cima de outro localizador, e a única correção
  disponível era mover os nós — ou seja, estragar o arranjo para consertar a
  seta.
- **Relativo, não coordenada absoluta.** Com absoluto, arrastar um localizador
  deixa a dobra parada no lugar antigo e a seta vira um zigue-zague; o usuário
  reajustaria a cada movimento. Guardando relativo, a dobra acompanha os nós, e
  o valor neutro é a ausência do campo — o que faz de "restaurar automático" um
  simples apagar, sem número mágico.
- **Duas unidades, uma por eixo, e é de propósito.** Qual eixo dobra depende de
  onde os nós estão: destino folgadamente à direita → segmento vertical, que
  anda no x; caso contrário → horizontal, que anda no y.
  - No **x** o campo é uma **fração** do vão entre as alças. O vão é
    estritamente positivo por construção (é a própria condição que escolhe esse
    ramo), a fração escala quando o usuário afasta os nós, e 0.5 coincide
    exatamente com o `getEdgeCenter` da lib.
  - No **y** é um **desvio** a partir da linha média. Fração aqui seria um bug:
    o caso que mais pede o ajuste é a seta que volta para trás entre dois nós
    **na mesma altura**, onde o vão de referência é zero e nenhuma fração
    significaria coisa alguma — arrastar não moveria nada.
  Os nomes dos campos (`fracaoX`, `desvioY`) dizem a unidade, porque um
  `{ x, y }` faria todo leitor futuro assumir a mesma nos dois e escrever o bug
  de novo.
- **O eixo ocioso é preservado**, não apagado: mover um localizador para o outro
  lado troca a orientação, e desfazer o movimento tem que trazer o ajuste
  antigo de volta.
- **`centerX`/`centerY` em vez de roteador próprio.** O `getSmoothStepPath` já
  aceita esses dois parâmetros; escrever um roteador ortogonal nosso (ou trazer
  `elkjs`/`dagre`, que são dependência nova e peso de bundle) seria pagar caro
  por algo que a lib entrega num argumento. Passamos **só o eixo ativo**: o
  `getPoints` devolve `centerX` e `centerY` como `labelX`/`labelY`
  independentemente do split que escolheu, então mandar o eixo ocioso não
  mudaria o caminho mas faria o rótulo pular.
- **Segmento, não waypoints livres.** Pontos arbitrários dão mais liberdade e
  muito mais superfície: criar/remover ponto, ordenar, migrar quando um handle
  muda de lado. O gesto do Miro — agarrar o cotovelo — resolve a queixa inteira
  com um número por eixo.
- **É conteúdo do plano, então respeita o D-19.** Ao contrário do `flowMode`,
  que é só como o plano é desenhado e continua livre em visualização, a dobra
  entra na guarda de somente leitura como qualquer outra mutação.
- **Sem bump de `SCHEMA_VERSION`.** O campo é opcional; `version: z.literal(1)`
  rejeitaria qualquer outro número e mandaria para o backup todo plano já
  gravado. Mesmo raciocínio do D-10.
- **Definir a dobra é gesto só de ponteiro, e isso é assumido.** O CLAUDE.md
  pede WCAG AA, e aqui a saída é que o ajuste é refinamento cosmético com um
  default sempre utilizável — nenhuma informação ou capacidade se perde sem
  ele —, enquanto **desfazer** tem caminho acessível: o botão no painel da
  aresta.

**Junto vieram duas limpezas.** `PjEdge` lia o modo de
`document.body.dataset.flowMode`, hack herdado do BETA_2 que o próprio
comentário do arquivo marcava para troca. Um atributo escrito fora do React não
dispara re-render, e a alça precisa aparecer no instante em que o modo muda —
agora o modo vem da store, e o `useEffect` que escrevia o dataset em `App.tsx`
saiu (nada mais o lia; o CSS nunca usou).

E o `onDoubleClick` do `FlowCanvas` passou a exigir que o alvo seja o próprio
pane. Ele mora no `<div>` wrapper, então recebia o duplo clique de qualquer
descendente: dar dois cliques num nó ou numa aresta **já criava um localizador
solto por baixo**. O bug é anterior a esta mudança, mas o reset da dobra por
duplo clique passaria por cima dele, então foi consertado na origem em vez de
contornado.

**O que precisaria mudar para evoluir.** Se o localizador ganhar handles nos
quatro lados, `features/canvas/dobra.ts` precisa ser revisto junto: ele replica
o `getPoints` do ReactFlow apenas para o caso de handles opostos, que é o único
que o app produz hoje — há teste de contrato com a lib exatamente para isso
aparecer como falha, e não como seta torta na tela. Se a queixa virar "quero
desviar de dois obstáculos na mesma seta", aí sim o caminho é waypoints livres,
e o campo `dobra` migra para uma lista de pontos. E quando houver undo/redo, o
arrasto já está preparado: ele commita uma vez, no soltar, não a cada
movimento.

---

## D-22 · Flags do localizador viram lista do plano, definida pelo usuário

**Decisão.** As quatro flags fixas em código (`T` Trabalhado, `E` Espera, `G`
Gatilho, `F` Fixo de fluxo) viram uma lista editável que mora **dentro do plano**
(`Plano.flags`), e o nó passa a guardar **ids** (`LocalizadorData.flags:
string[]`) em vez de um mapa de quatro booleanos. Cada item tem sigla, rótulo e
uma cor de uma paleta de oito. Plano novo nasce só com **Espera** e **Fixo de
fluxo**. Marcar um localizador passa a ter uma função além do enfeite: a barra
lateral realça no canvas o que aquela flag trabalha. `SCHEMA_VERSION` vai a
**2**, com migração v1→v2 embutida no `PlanoSchema`.

**Por que.**

- **A pergunta real é "quem trabalha isto".** As quatro flags eram decorativas —
  nada no app lia `flags`: nem o checklist, nem a sincronização, nem as
  estatísticas. O que o usuário automatizador precisa marcar é o recorte do
  trabalho da unidade, e esse recorte muda de vara para vara: umas separam por
  **setor** (Cálculo, Triagem, Expedição), outras, menores, por **servidor**
  nomeado. Uma tabela fixa em código não tem como acertar isso.
- **Setor e servidor são o mesmo tipo de marcador, numa lista plana.** A
  hierarquia "servidores dentro de um setor" foi considerada e descartada: cada
  unidade escolhe **um** dos dois eixos, não os dois ao mesmo tempo, então a
  hierarquia pagaria em UI e em regras de herança (mover alguém de setor, remover
  um setor com gente dentro) por um poder que ninguém pediu.
- **Dentro do plano, não numa chave global do navegador.** É a diferença para o
  catálogo do órgão (D-7), e a razão é a direção oposta: o catálogo é uma
  propriedade do usuário que deve valer para todos os planos, enquanto a lista de
  setores é vocabulário **daquele desenho**, e o plano é a unidade de
  compartilhamento — exportado em JSON ou publicado numa lotação. Global, o plano
  chegaria no colega cheio de chips órfãos apontando para ids que a máquina dele
  nunca viu. O custo aceito é a duplicação: dois planos da mesma vara mantêm
  listas independentes. Cabe, porque a lista tem uma dúzia de itens, não
  centenas como o catálogo.
- **O nó guarda id, não rótulo.** Renomear "Cálculo" para "Setor de Cálculo" ou
  trocar a cor não pode desfazer marcação nenhuma. Só remover o marcador faz
  isso — e aí a remoção limpa os nós na mesma ação, para não deixar id órfão que
  voltaria a valer se alguém recriasse uma flag com o mesmo id.
- **`Trabalhado` e `Gatilho` saem dos padrões, mas não dos planos que os usam.**
  "Trabalhado" ficou redundante — um localizador marcado com um setor **é** um
  localizador trabalhado —, e "Gatilho" colide com o gatilho da ATP, que é
  conceito de aresta e tem os 9 tipos de `selTipoControle` atrás. Mas apagá-los
  de planos existentes seria perder trabalho em silêncio, então a migração os
  recria como marcadores comuns **quando algum nó os usa**, prontos para o
  usuário remover.
- **A migração mora dentro do `PlanoSchema`, não nos chamadores.**
  `PlanoSchema.safeParse` é chamado em sete pontos, e um deles — `loadPlano` —
  manda para a quarentena tudo que não valida. Um schema que apenas rejeitasse a
  v1 não daria erro nenhum: daria todo plano já salvo sumindo da tela. Com
  `z.union([PlanoV2Schema, PlanoV1Schema.transform(migrar)])`, os sete pontos
  herdam a migração sem uma linha de mudança, `PlanoBundleSchema` inclusive.
- **Cor é índice, não valor.** O domínio guarda `1..8`; a cor real mora em
  `.flag-cor-N` no CSS. Assim o domínio continua sem saber de apresentação e o
  tema resolve claro/escuro num lugar só. As quatro primeiras são exatamente as
  cores históricas de T/E/G/F, para que um plano migrado não mude de aparência.
- **Realçar, não filtrar de verdade.** O que está fora do setor escolhido recua
  em opacidade, mas continua na tela e clicável: um fluxo com metade dos nós
  escondidos vira um grafo com arestas saindo para o nada. E `filtroFlags` **não
  é persistido** — é ajuste desta aba, como o zoom. Gravá-lo faria "olhar o
  trabalho do Setor de Cálculo" virar alteração no plano da unidade inteira, e o
  realce continua valendo em sessão de visualização (D-19) justamente porque
  olhar não é editar.

**O protótipo diverge a partir daqui.** O `PlanejoEproc__BETA_2.html.html` é
declarado fonte da verdade do domínio no CLAUDE.md e mantém a tabela de quatro
flags fixas. Neste ponto ele está congelado: não vale a pena retroportar, e quem
comparar os dois deve tratar o app como o corrente.

**O que precisaria mudar para evoluir.** Se aparecer o pedido de "checklist por
setor" — entregar a cada um a sua parte do que falta criar no Eproc —, o lugar é
`features/checklist/derive.ts`, que hoje ignora `flags` por completo e agrupa só
por categoria de subitem; a marcação já está lá, é trabalho de apresentação. Se
o pedido for contagem de pendências por setor no cabeçalho, o cálculo do `stats`
em `App.tsx` é o ponto. E se a duplicação entre planos da mesma vara incomodar
de verdade, o caminho **não** é mudar o escopo: é um botão de "copiar setores de
outro plano", mantendo a lista dentro de cada plano.

---

## D-23 · Localizadores de sistema entram marcados, em vez de filtrados

> **Emenda ao [D-7](#d-7--catálogo-do-órgão-é-global-por-navegador-fora-do-plano)**,
> e vale igualmente para o caminho do D-16.

**Decisão.** Os localizadores com `Localizador Sistema = Sim` **entram** nos dois
catálogos — o do XLS e o lido da unidade — e aparecem na autocomplete, marcados
como de sistema. Não há opt-in, checkbox nem filtro para escondê-los: o destaque
substitui o filtro. A marca viaja do catálogo até o nó do plano
(`LocalizadorData.sistema`) e é visível em quatro lugares — badge âmbar na lista
de sugestões, contagem no resumo das duas importações, linha explicativa no
painel do nó e faixa âmbar à esquerda no nó do canvas.

**Por que.** O D-7 filtrava porque "sugeri-los seria contraproducente" para um
app que existe para incentivar fluxos próprios. Medido contra um export real, o
custo do argumento aparece: **188 de 365** itens sumiam. E o argumento confundia
duas coisas — *criar* um localizador de sistema (o usuário não cria, e nem
deveria) e *desenhar um fluxo que passa por ele* (o que acontece o tempo todo:
os processos entram e saem dos localizadores padrão do Eproc). Quem desenhava
esse trecho digitava o nome à mão, sem sugestão, sem descrição e sem o app saber
que aquele localizador já existe no Eproc — exatamente o dado que o catálogo
existe para trazer.

Nenhum bump de versão acompanha a mudança. `LocalizadorOrgao.sistema` e
`LocalizadorData.sistema` são **opcionais** de propósito: catálogos e planos já
gravados não têm o campo, e exigi-lo os reprovaria no `safeParse` — que, nos dois
casos, significa mandar para a quarentena o dado do usuário. `CatalogoOrgao`
segue na v1 e `SCHEMA_VERSION` na v2, sem migração.

A marca no nó **não** é `ja_criado` de outro nome. `ja_criado` é um checkbox do
usuário e sobrevive à digitação livre; `sistema` é fato sobre o catálogo e é
apagado quando o nome é editado à mão, senão a faixa âmbar continuaria afirmando
algo sobre um nome que já não é o do catálogo.

**Localizador de sistema sai do eixo `ja_criado` por inteiro.** Não recebe a
marca ao ser escolhido do catálogo, não mostra borda verde nem o "certinho" no
canto, não expõe o checkbox "Já existe no Eproc" no painel, e **não entra no
checklist**. A razão é que as duas respostas daquele eixo são falsas para ele:
desmarcado afirma que falta criá-lo, marcado afirma que alguém o criou, e ele
simplesmente está lá em toda unidade. O efeito colateral que isso evita é o pior
dos dois: incluído, ele apareceria no checklist — que é a lista do que a
secretaria precisa configurar — como tarefa pendente, puxando a contagem de
progresso para baixo por algo que ninguém vai fazer. Ele continua nomeando as
pontas das arestas no checklist, porque ali é contexto do fluxo, não tarefa.

**Custo assumido.** A lista de sugestões praticamente dobra. A mitigação é a
ordenação — os da unidade primeiro, os de sistema depois, alfabéticos dentro de
cada grupo, a mesma forma que `useSugestoesSubitem` já usava para itens de outro
órgão. Quem digita filtra antes de chegar ao fim da lista; quem rola vê primeiro
o que a unidade criou.

**O que precisaria mudar para evoluir.** Se a lista incomodar mesmo assim, o
próximo passo é um filtro na autocomplete (mostrar/esconder os de sistema), não
voltar a filtrar na importação: o dado gravado passa a ser o conjunto completo, e
esconder na apresentação é reversível — não importar não é. Se o Eproc passar a
distinguir mais de duas categorias de localizador, `sistema: boolean` vira um
campo de categoria, e os quatro pontos de destaque leem dele.

---

## Como adicionar uma decisão nova

1. Atribuir ID sequencial (`D-N`).
2. Estrutura: **Decisão** (1 frase) → **Por que** → **O que precisaria mudar para evoluir**.
3. Mencionar `decisoes.md#D-N` no commit ou no comentário do código onde a decisão se manifesta, para o leitor futuro encontrar o porquê.
