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
