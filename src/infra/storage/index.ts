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
  // Debounced
  criarSavePlanoDebounced,
  type DebouncedSaver,
  type PlanIndexEntry,
  type PlansIndex,
} from './storage';
export {
  CATALOGO_KEY,
  loadCatalogoOrgao,
  saveCatalogoOrgao,
  clearCatalogoOrgao,
} from './catalogo';
export {
  PlanoSchema,
  PlanoBundleSchema,
  PLANO_BUNDLE_VERSION,
  PlanIndexEntrySchema,
  PlansIndexSchema,
  CatalogoOrgaoSchema,
  type PlanoBundle,
} from './schema';
