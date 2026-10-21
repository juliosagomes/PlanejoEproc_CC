# Fixtures do Eproc

Capturadas em **27/08/2026** de `eproc1g.tjmg.jus.br/eproc/` (TJMG, 1º grau),
perfil *Gerente de Secretaria*, a partir da tela **Painel do Diretor de
Secretaria**.

## O que foi anonimizado

- Login do usuário → `x0000000`
- Nome do usuário → `FULANO DE TAL`
- Sigla/nome das demais unidades do perfil → mantidas só duas, genéricas

Nomes e descrições de localizadores, modelos e textos padrão foram **mantidos**:
são configuração de fluxo de trabalho da unidade, não dado pessoal, e é
exatamente a variedade deles (emoji, acento, ` - ` interno, travessão `–`) que dá
valor ao teste.

## Recortes

Cada arquivo é um **fragmento**, não a página inteira: só a `table.infraTable` (ou
o `<select>`) com uma amostra de linhas escolhida para cobrir os casos difíceis.
Os atributos `href`, `action`, `onclick` e `src` foram removidos — carregavam o
`hash` assinado da sessão.

O **cabeçalho** foi mantido com a estrutura real, incluindo a
`<table class="infraTableOrdenacao">` aninhada dentro de cada `<th>` — é a
armadilha que o parser precisa sobreviver (ver abaixo).

## Fatos estruturais que estas fixtures existem para travar

1. **Tabelas aninhadas no cabeçalho.** Cada `<th>` contém uma
   `table.infraTableOrdenacao` com 2 `<tr>`. Um `tabela.querySelectorAll('tr')`
   ingênuo conta 63 linhas onde há 51 (1 cabeçalho + 50 dados + 12 de widget).
   Só valem as linhas **filhas diretas** do `<tbody>`.

2. **Emoji vem como entidade numérica**, nunca literal: `&#128424;`, `&#9881;`,
   `&#65039;` (variation selector). 553 entidades só no bloco do `<select>`.
   `DOMParser` já decodifica no `textContent`; regex não.

3. **O texto do `<option>` é `sigla + " - " + nome`.** Quando sigla e nome
   coincidem, o texto duplica. Cortar no **primeiro** `" - "` erra, porque o
   próprio nome pode conter ` - `:

   ```
   🔵 Conclusos - Pedido Reconvencional - 🔵 Conclusos - Pedido Reconvencional
   ```

   A regra correta procura o separador que parte a string em **metades iguais**.
   Medido nos 431 localizadores reais: 359 colapsam por igualdade exata, 5 por
   igualdade após remover emoji/diacrítico, e 67 são `SIGLA - NOME` genuínos
   (`AlvEletr60Dias - Alvarás Eletr. Últimos 60 Dias`). Zero falso-colapso.

4. **`localizador_orgao_listar` é a verdade de referência** para o item 3: ela traz
   sigla e nome em **colunas separadas**, então o teste do parser do `<select>`
   pode conferir contra ela.

5. **`Localizador Sistema` é `"Sim"` / `"Não"`** — mesmo vocabulário do XLS, então
   o filtro do D-7 continua valendo sem tradução.

## Regras de ATP (21/10/2026, decisoes.md#D-46)

Capturadas no mesmo eproc1g, perfil *ULA 2ª V.FAM.SUC / Gerente*, só leitura,
já no formato que o coletor devolve:

- `automatizarLocalizadores.html` — a `#tableAutomatizacaoLocalizadores` com 13
  das 279 regras, escolhidas pelos casos difíceis: destino com " E " (1, 182),
  origem com OU (2) e com E (12), origem "Nenhum" (180, 182) e "Todos" (312),
  destino P (66), desativada (180), ação manual (132, 312), por data (7), por
  tempo (49), por documento (152). Opções não escolhidas, scripts, tooltips de
  histórico (traziam matrícula) e o `hash` dos links já saem no coletor.
- `automatizarLocalizadoresAlterar-N.html` — o formulário de 8 regras, recortado
  pelo coletor: só os controles, com a opção escolhida de cada `<select>`, em três
  blocos (`#formulario`, `#filtrosEscolhidos`, `#dadosGatilho`).

**Anonimizado:** o nome do servidor nos localizadores pessoais de erro virou
"Servidor", **inclusive dentro do base64 do `hdnATP_n`** — ali é PHP serializado
em Latin-1, e o comprimento `s:N:` de cada string alterada foi recalculado.
Fixture nova desta tela precisa do mesmo cuidado: o nome escapa do texto visível.
