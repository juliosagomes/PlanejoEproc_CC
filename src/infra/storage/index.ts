export {
  // Chaves
  LEGACY_KEY,
  INDEX_KEY,
  ACTIVE_KEY,
  PLAN_KEY_PREFIX,
  BACKUP_KEY_PREFIX,
  // Helpers
  getPlanKey,
  getActivePlanKey,
  planoVazio,
  // Leitura
  loadPlano,
  listPlanos,
  getAtivoId,
  // Escrita
  savePlano,
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
