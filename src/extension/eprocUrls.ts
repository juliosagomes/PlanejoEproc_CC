/**
 * Padrões de URL das instalações do Eproc.
 *
 * Fonte única: o `manifest.config.ts` os usa como `host_permissions` e
 * `src/extension/unidade.ts` como filtro do `chrome.tabs.query`. Se as duas
 * listas divergirem, o sintoma é péssimo — o app acha a aba e a injeção falha
 * por falta de permissão, sem explicação óbvia.
 *
 * O Eproc é distribuído em variantes de caminho, não de host: o mesmo tribunal
 * pode servir `/eproc1g/` e `/eproc2g/`, e tribunais diferentes usam nomes
 * diferentes para a mesma coisa. Daí a lista por caminho em vez de um
 * `https://*.jus.br/*` — que cobriria todo o Judiciário brasileiro por um ganho
 * que não existe.
 */
export const VARIANTES_EPROC = [
  'eproc',
  'eproc1g',
  'eproc2g',
  'eprocV2_prod_1grau',
  'eprocV2_prod_2grau',
  'eproc_1g_prod',
  'eproc_2g_prod',
  'eproc2trf4',
] as const;

export const PADROES_EPROC: string[] = VARIANTES_EPROC.map(
  (v) => `https://*.jus.br/${v}/*`,
);
