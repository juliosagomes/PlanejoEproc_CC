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

**Decisão.** O catálogo de localizadores do órgão é importado a partir do XLS exportado pelo Eproc, lido em runtime no browser via `xlsx` (SheetJS). A biblioteca é embutida no singlefile (~700 KB minificada).

**Por que.** O export oficial do Eproc é XLS binário (OLE2/BIFF8) — não HTML disfarçado nem CSV. As alternativas eram (a) pedir ao usuário converter para CSV no Excel antes de importar (atrito desnecessário num app que já promete ser "abrir e usar"), (b) ter uma página HTML companion só de conversão (UX de duas etapas), ou (c) embutir um parser XLS. Embutir é o caminho mais limpo: a importação acontece num clique. O custo de bundle é amortizado sobre uma feature que o usuário usa frequentemente. SheetJS é a única lib madura que lê BIFF8 em JS puro (sem WASM), é totalmente bundlável pelo Vite, e funciona em `file://`.

**Risco aceito.** SheetJS 0.18.5 (versão pública do npm) tem alertas de prototype pollution / ReDoS. Mitigação: o XLS importado é exclusivamente do próprio órgão do usuário, processado localmente, sem trânsito por servidor. Sem superfície de ataque externa em beta. Atualizar para 0.20.x (CDN oficial) quando a feature exigir.

**O que precisaria mudar para evoluir.** Para outros formatos (XLSX, ODS), o mesmo `XLSX.read()` já cobre — basta o parser não fixar `.xls`. Para suporte a outros sistemas (PJe, etc.), parser específico por origem; estrutura atual de `infra/catalogo/` acomoda.

---

## D-7 · Catálogo do órgão é global por navegador, fora do plano

**Decisão.** O catálogo de localizadores do órgão é persistido em chave própria do `localStorage` (`planejoeproc:catalogo:orgao`), independente dos planos. **Não** entra no JSON exportado de plano. Itens com `Localizador Sistema = Sim` são filtrados no parser e nunca chegam ao storage.

**Por que.** O catálogo é uma propriedade do **usuário/órgão**, não do plano específico. Carregar uma vez deve valer para todos os planos. Se viajasse junto do JSON, planos antigos ficariam com catálogos desatualizados ao abrir noutra máquina, e duplicaríamos centenas de KB no payload de cada export. Filtrar Sistema=Sim no parser é alinhado ao propósito do app: incentivar o usuário a desenhar fluxos próprios; localizadores de sistema do Eproc são padrão e sugeri-los seria contraproducente.

**O que precisaria mudar para evoluir.** Se virar requisito "compartilhar plano + catálogo de uma máquina para outra", adicionar export/import específico do catálogo (botão dedicado), nunca incluí-lo no JSON do plano. Se um dia o usuário quiser ver localizadores de sistema como referência, expor uma toggle no parser (mas continuar sugerindo só os customizados na autocomplete).

---

## Como adicionar uma decisão nova

1. Atribuir ID sequencial (`D-N`).
2. Estrutura: **Decisão** (1 frase) → **Por que** → **O que precisaria mudar para evoluir**.
3. Mencionar `decisoes.md#D-N` no commit ou no comentário do código onde a decisão se manifesta, para o leitor futuro encontrar o porquê.
