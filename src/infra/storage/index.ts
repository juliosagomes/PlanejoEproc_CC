export {
  // Escopo (silo de armazenamento por sessão)
  getEscopo,
  setEscopo,
  prefixo,
  indexKey,
  activeKey,
  planKey,
  comEscopo,
  isEscopoLocal,
  getWorkspaceId,
  type Escopo,
} from './escopo';
export {
  // Chaves
  LEGACY_KEY,
  BACKUP_KEY_PREFIX,
  // Helpers
  getActivePlanKey,
  planoVazio,
  // Leitura
  loadPlano,
  listPlanos,
  getAtivoId,
  // Escrita
  savePlano,
  sobrescreverPlano,
  setAtivo,
  criarPlano,
  importarPlano,
  importarPlanos,
  duplicarPlano,
  renomearPlano,
  excluirPlano,
  excluirTodosPlanos,
  // Debounced
  criarSavePlanoDebounced,
  type DebouncedSaver,
  type PlanIndexEntry,
  type PlansIndex,
} from './storage';
export {
  SETORES_KEY_SUFIXO,
  setoresKey,
  loadSetores,
  saveSetores,
  clearSetores,
} from './setores';
export { consolidarSetores } from './consolidarSetores';
export { loadCamera, saveCamera, type Camera } from './cameras';
export { loadConjuntosEvento, saveConjuntosEvento } from './conjuntosEvento';
export { PAINEL_KEY_SUFIXO, painelKey, loadPainel, savePainel } from './painel';
export {
  ORDENS_PLANOS,
  getOrdemPlanos,
  setOrdemPlanos,
  type OrdemPlanos,
} from './ordemPlanos';
export {
  CATALOGO_KEY,
  loadCatalogoOrgao,
  saveCatalogoOrgao,
  clearCatalogoOrgao,
} from './catalogo';
export {
  ANOTACOES_KEY,
  loadAnotacoesCatalogo,
  saveAnotacoesCatalogo,
  clearAnotacoesCatalogo,
} from './anotacoesCatalogo';
export {
  CATALOGO_UNIDADE_PREFIXO,
  catalogoUnidadeKey,
  getUnidadeAtiva,
  loadCatalogoUnidade,
  loadCatalogoUnidadeAtiva,
  saveCatalogoUnidade,
  clearCatalogoUnidade,
} from './catalogoUnidade';
export {
  PlanoSchema,
  PlanoBundleSchema,
  PLANO_BUNDLE_VERSION,
  PlanIndexEntrySchema,
  PlansIndexSchema,
  CatalogoOrgaoSchema,
  CatalogoUnidadeSchema,
  AnotacoesCatalogoSchema,
  SetoresUnidadeSchema,
  type PlanoBundle,
} from './schema';
