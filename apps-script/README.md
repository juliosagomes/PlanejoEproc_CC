# Backend de sincronização (Google Apps Script)

Este código **não faz parte do build do Vite** — é implantado manualmente,
uma única vez, numa conta Google (a mesma que vai "hospedar" a sincronização
de todos os usuários que forem sincronizar planos entre si).

## Por que existe

O PlanejoEproc é offline por padrão. A sincronização de planos é uma
funcionalidade **opcional**: quem escolher "Abrir modo local" na tela de
entrada continua 100% sem rede. Quem entra numa lotação publica/recebe
planos através deste backend.

Arquitetura: uma planilha Google guarda só o **índice** (workspaces e
metadados de cada plano); o **conteúdo** de cada plano fica em arquivos JSON
no Drive, um por plano, numa pasta por workspace. Isso evita o limite de
~50.000 caracteres por célula do Sheets — campos de texto livre do plano
(`condicoes`, `minutaConteudo`, decisoes.md D-3/D-4) não têm limite de
tamanho e podem passar disso.

## Deploy

1. Crie uma planilha Google nova (pode ficar vazia — o script cria as abas
   `Workspaces` e `Planos` sozinho, na primeira chamada).
2. **Extensões → Apps Script**.
3. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo de
   [`Code.gs`](./Code.gs) deste repositório.
4. **Implantar → Nova implantação**.
   - Tipo: **App da Web**.
   - Executar como: **Eu** (sua conta — o script precisa de acesso ao Drive
     e à planilha).
   - Quem pode acessar: **Qualquer pessoa**. (É isso que permite a extensão,
     rodando no navegador de outra pessoa, chamar o endpoint sem OAuth — o
     acesso é controlado pelos códigos de lotação, não pela conta Google.)
5. Autorize as permissões pedidas (Drive + Planilhas) — o Google vai avisar
   que é um script não verificado; é o seu próprio script, pode confirmar.
6. Copie a **URL do app da Web** (termina em `/exec`).
7. Cole essa URL em `src/infra/sync/config.ts`, na constante
   `SYNC_API_URL`, e rode `npm run build` de novo.

## Reimplantar após editar o `Code.gs`

Toda alteração no script exige uma **nova versão** de implantação
(**Implantar → Gerenciar implantações → editar (ícone de lápis) → Nova
versão**). Só salvar o arquivo no editor do Apps Script não atualiza a URL
`/exec` já publicada. A URL **não muda** ao criar nova versão, então não é
preciso mexer em `src/infra/sync/config.ts`.

> ⚠️ **A versão atual do `Code.gs` é obrigatória.** O app espera que
> `sincronizar` devolva `workspaceId` e `nome`, e que `publicar` aceite
> `remover[]`. Contra uma implantação antiga, entrar numa lotação falha com
> "Resposta inesperada ao sincronizar". Se você já tinha o backend no ar,
> cole o `Code.gs` novo e republique **antes** de distribuir o app novo.
>
> Já a devolução do `codigoLeitura` a quem usa o código de edição
> (decisoes.md#D-10) degrada de forma suave: contra uma implantação antiga,
> "Ver códigos de acesso" mostra só um aviso no lugar do código de
> visualização — o resto da lotação funciona normalmente.
>
> A planilha existente é aproveitada: `garantirHeaders` acrescenta sozinho a
> coluna `nome` na aba `Workspaces`. Lotações criadas antes disso aparecem
> como "Lotação sem nome" até alguém recriá-las.

## Vocabulário

O que o código chama de **workspace** é o que a interface chama de
**lotação**: o conjunto de planos de uma unidade (vara, cartório, gabinete),
com nome próprio e dois códigos de acesso.

## Segurança — leia antes de divulgar um código

Não há login. `codigoLeitura` e `codigoEdicao` são segredos do tipo
"bearer token": quem tiver a string, tem o acesso correspondente. Não existe
hoje um jeito de revogar ou trocar um código depois de criado (fora de
escopo da v1 — ver `decisoes.md#D-8`). Trate o `codigoEdicao` como uma senha:
só compartilhe com quem deve poder **alterar** os planos daquele workspace.

## Limites do plano gratuito (conta Google pessoal)

Generosos para uso interno esporádico (ex.: uma vara, uma equipe): cota
diária de execução de script e de chamadas via Web App é da ordem de
milhares/dia. Se o uso crescer muito (centenas de sincronizações por hora),
reavalie — não há alerta automático de quota aqui.
