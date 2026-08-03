/**
 * PlanejoEproc — backend de sincronização de planos.
 *
 * Um "workspace" aqui é o que a UI chama de LOTAÇÃO: o conjunto de planos de
 * uma unidade (vara, cartório, gabinete), com nome próprio e dois códigos de
 * acesso.
 *
 * Roda como Google Apps Script Web App vinculado a uma planilha Google.
 * A planilha guarda só o ÍNDICE (workspaces e metadados de cada plano); o
 * conteúdo de cada plano (o JSON completo) vira um arquivo no Drive, numa
 * pasta por workspace. Isso evita o limite de ~50.000 caracteres por célula
 * do Sheets, que planos reais (com texto livre longo em `condicoes`,
 * `minutaConteudo` etc. — ver decisoes.md D-3/D-4) podem ultrapassar.
 *
 * Não há login: o "código" (leitura ou edição) É o segredo de acesso.
 * `codigoLeitura` só permite sincronizar (GET); `codigoEdicao` também
 * permite publicar (POST). Nenhum dos dois códigos aparece na resposta de
 * `sincronizar` — só o cliente que já os possui os conhece.
 *
 * Deploy: ver README.md nesta pasta.
 */

const SHEET_WORKSPACES = 'Workspaces';
const SHEET_PLANOS = 'Planos';
const DRIVE_ROOT_FOLDER_NAME = 'PlanejoEproc - planos sincronizados';

// `nome` (da lotação) entra no FIM do array de propósito: `appendRow` e
// `updateCell` posicionam por índice, então acrescentar no meio desalinharia
// as linhas de planilhas criadas antes desta versão. `garantirHeaders` cuida
// de acrescentar a coluna que falta na linha 1 dessas planilhas.
const WORKSPACES_HEADERS = ['workspaceId', 'codigoLeitura', 'codigoEdicao', 'driveFolderId', 'criadoEm', 'nome'];
const PLANOS_HEADERS = ['workspaceId', 'remotoId', 'nome', 'driveFileId', 'atualizadoEm'];

/* ============================================================================
 * Entradas HTTP
 * ========================================================================== */

function doGet(e) {
  return handle(() => {
    const action = e.parameter.action;
    if (action === 'sincronizar') {
      return actionSincronizar(e.parameter.codigo);
    }
    return erro('Ação GET desconhecida: ' + action);
  });
}

function doPost(e) {
  return handle(() => {
    const body = parseBody(e);
    const action = body.action;
    if (action === 'criarWorkspace') {
      return actionCriarWorkspace(body.nome, body.planos || []);
    }
    if (action === 'publicar') {
      return actionPublicar(body.codigo, body.planos || [], body.remover || []);
    }
    return erro('Ação POST desconhecida: ' + action);
  });
}

function parseBody(e) {
  // Enviado como text/plain de propósito (contorna o preflight CORS que o
  // Apps Script não trata bem para application/json vindo de outra origem).
  if (!e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function handle(fn) {
  try {
    return fn();
  } catch (err) {
    return erro('Erro interno: ' + (err && err.message ? err.message : String(err)));
  }
}

function ok(payload) {
  const corpo = Object.assign({ ok: true }, payload);
  return ContentService.createTextOutput(JSON.stringify(corpo)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function erro(mensagem) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: false, erro: mensagem }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================================
 * Ações
 * ========================================================================== */

function actionCriarWorkspace(nome, planos) {
  return comLock(() => {
    const nomeFinal = (nome || '').toString().trim() || 'Lotação sem nome';
    const workspaceId = Utilities.getUuid();
    const codigoLeitura = Utilities.getUuid();
    const codigoEdicao = Utilities.getUuid();
    const driveFolderId = criarPastaWorkspace(workspaceId);
    const criadoEm = new Date().toISOString();

    appendRow(getSheet(SHEET_WORKSPACES, WORKSPACES_HEADERS), WORKSPACES_HEADERS, {
      workspaceId,
      codigoLeitura,
      codigoEdicao,
      driveFolderId,
      criadoEm,
      nome: nomeFinal,
    });

    publicarPlanosNoWorkspace(workspaceId, driveFolderId, planos);

    return ok({ workspaceId, codigoLeitura, codigoEdicao });
  });
}

function actionPublicar(codigo, planos, remover) {
  return comLock(() => {
    const workspace = encontrarWorkspacePorCodigo(codigo);
    if (!workspace) return erro('Código não encontrado.');
    if (workspace.permissao !== 'edicao') {
      return erro('Este código é somente leitura — não pode publicar.');
    }
    const publicados = publicarPlanosNoWorkspace(
      workspace.workspaceId,
      workspace.driveFolderId,
      planos,
    );
    const removidos = removerPlanosDoWorkspace(workspace.workspaceId, remover);
    return ok({ publicados, removidos });
  });
}

function actionSincronizar(codigo) {
  const workspace = encontrarWorkspacePorCodigo(codigo);
  if (!workspace) return erro('Código não encontrado.');

  const linhas = readRows(getSheet(SHEET_PLANOS, PLANOS_HEADERS)).filter(
    (r) => r.workspaceId === workspace.workspaceId,
  );

  const planos = linhas.map((linha) => ({
    remotoId: linha.remotoId,
    nome: linha.nome,
    atualizadoEm: linha.atualizadoEm,
    plano: JSON.parse(lerArquivoPlano(linha.driveFileId)),
  }));

  // `workspaceId` identifica a lotação no cliente (é o que nomeia o silo
  // local de planos). Não é credencial — os dois códigos são UUIDs à parte.
  return ok({
    workspaceId: workspace.workspaceId,
    nome: workspace.nome,
    planos,
    permissao: workspace.permissao,
  });
}

/**
 * Remove do workspace os planos cujos `remotoId` o cliente marcou como
 * excluídos. Apaga o arquivo no Drive e a linha na aba Planos. Ignora ids
 * desconhecidos — reenviar um tombstone já aplicado é inofensivo.
 *
 * As linhas são apagadas de baixo para cima: `deleteRow` reindexa tudo que
 * está abaixo, então remover em ordem crescente invalidaria os índices
 * seguintes.
 */
function removerPlanosDoWorkspace(workspaceId, remover) {
  if (!remover || !remover.length) return [];
  const sheet = getSheet(SHEET_PLANOS, PLANOS_HEADERS);
  const alvos = readRows(sheet).filter(
    (r) => r.workspaceId === workspaceId && remover.indexOf(r.remotoId) !== -1,
  );

  const removidos = [];
  alvos
    .sort((a, b) => b.__row - a.__row)
    .forEach((linha) => {
      try {
        DriveApp.getFileById(linha.driveFileId).setTrashed(true);
      } catch (err) {
        // Arquivo já removido do Drive à mão: seguimos e limpamos o índice.
      }
      sheet.deleteRow(linha.__row);
      removidos.push(linha.remotoId);
    });

  return removidos;
}

/**
 * Upsert por `remotoId`: o cliente gera o `remotoId` (UUID) na primeira
 * publicação de um plano local e reenvia o mesmo valor nas publicações
 * seguintes, para que o servidor atualize no lugar em vez de duplicar.
 */
function publicarPlanosNoWorkspace(workspaceId, driveFolderId, planos) {
  const sheet = getSheet(SHEET_PLANOS, PLANOS_HEADERS);
  const linhas = readRows(sheet);
  const atualizadoEm = new Date().toISOString();
  const resultado = [];

  planos.forEach((item) => {
    if (!item || !item.remotoId || !item.plano) return;
    const nome = (item.plano.planoNome || 'Plano sem título').toString();
    const conteudo = JSON.stringify(item.plano);
    const existente = linhas.find(
      (r) => r.workspaceId === workspaceId && r.remotoId === item.remotoId,
    );

    if (existente) {
      salvarArquivoPlano(driveFolderId, item.remotoId, conteudo, existente.driveFileId);
      updateCell(sheet, existente.__row, PLANOS_HEADERS, 'nome', nome);
      updateCell(sheet, existente.__row, PLANOS_HEADERS, 'atualizadoEm', atualizadoEm);
    } else {
      const driveFileId = salvarArquivoPlano(driveFolderId, item.remotoId, conteudo, null);
      appendRow(sheet, PLANOS_HEADERS, {
        workspaceId,
        remotoId: item.remotoId,
        nome,
        driveFileId,
        atualizadoEm,
      });
    }
    resultado.push({ remotoId: item.remotoId, atualizadoEm });
  });

  return resultado;
}

function encontrarWorkspacePorCodigo(codigo) {
  if (!codigo) return null;
  const linhas = readRows(getSheet(SHEET_WORKSPACES, WORKSPACES_HEADERS));
  const linha = linhas.find(
    (r) => r.codigoLeitura === codigo || r.codigoEdicao === codigo,
  );
  if (!linha) return null;
  return {
    workspaceId: linha.workspaceId,
    driveFolderId: linha.driveFolderId,
    // Workspaces criados antes da coluna `nome` existir não têm rótulo.
    nome: (linha.nome || '').toString() || 'Lotação sem nome',
    permissao: linha.codigoEdicao === codigo ? 'edicao' : 'leitura',
  };
}

/* ============================================================================
 * Planilha — helpers genéricos (linhas como objetos, por cabeçalho)
 * ========================================================================== */

function getSheet(nome, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(headers);
    return sh;
  }
  garantirHeaders(sh, headers);
  return sh;
}

/**
 * Acrescenta à linha 1 as colunas que a planilha ainda não tem. Necessário
 * porque `getSheet` só escreve os cabeçalhos ao criar a aba: uma planilha
 * implantada antes de `nome` existir ficaria sem a coluna, e `appendRow`
 * gravaria o valor numa célula sem cabeçalho (que `readRows` ignoraria).
 */
function garantirHeaders(sheet, headers) {
  const ultimaColuna = sheet.getLastColumn();
  if (ultimaColuna === 0) {
    sheet.appendRow(headers);
    return;
  }
  const atuais = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
  const faltantes = headers.filter((h) => atuais.indexOf(h) === -1);
  if (!faltantes.length) return;
  sheet.getRange(1, ultimaColuna + 1, 1, faltantes.length).setValues([faltantes]);
}

function readRows(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = data[i][idx];
    });
    obj.__row = i + 1; // número de linha 1-based na planilha, para updateCell
    rows.push(obj);
  }
  return rows;
}

function appendRow(sheet, headers, obj) {
  sheet.appendRow(headers.map((h) => (obj[h] !== undefined ? obj[h] : '')));
}

function updateCell(sheet, rowIndex, headers, campo, valor) {
  const col = headers.indexOf(campo) + 1;
  sheet.getRange(rowIndex, col).setValue(valor);
}

/* ============================================================================
 * Drive — um arquivo JSON por plano, dentro da pasta do workspace
 * ========================================================================== */

function getRootFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function criarPastaWorkspace(workspaceId) {
  return getRootFolder().createFolder(workspaceId).getId();
}

function salvarArquivoPlano(driveFolderId, remotoId, conteudoJson, driveFileIdConhecido) {
  if (driveFileIdConhecido) {
    const arquivo = DriveApp.getFileById(driveFileIdConhecido);
    arquivo.setContent(conteudoJson);
    return arquivo.getId();
  }
  const pasta = DriveApp.getFolderById(driveFolderId);
  const nomeArquivo = remotoId + '.json';
  const existentes = pasta.getFilesByName(nomeArquivo);
  if (existentes.hasNext()) {
    const arquivo = existentes.next();
    arquivo.setContent(conteudoJson);
    return arquivo.getId();
  }
  return pasta.createFile(nomeArquivo, conteudoJson, MimeType.PLAIN_TEXT).getId();
}

function lerArquivoPlano(driveFileId) {
  return DriveApp.getFileById(driveFileId).getBlob().getDataAsString('UTF-8');
}

/* ============================================================================
 * Concorrência
 * ========================================================================== */

function comLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
