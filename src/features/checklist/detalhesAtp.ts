import {
  COMPORTAMENTOS_ORIGEM,
  DIAS_SEMANA,
  TIPOS_DATA_CONTROLE,
  acaoProgramadaDef,
  campoVisivel,
  filtroDef,
  parametrosVazios,
  valorVazio,
  type AcaoProgramada,
  type AtpRule,
  type AtpTrigger,
  type CampoDef,
  type OpcaoCampo,
  type Parametros,
  type ValorCampo,
} from '@/domain';
import {
  CATALOGOS,
  POLOS_PETICAO,
  STATUS_PROCESSO,
  TIPOS_CONTROLE,
  TIPOS_PETICAO,
  buscarLabel,
} from '@/data';
import { frasePorResumo, resumirEventos, rotuloEvento } from '@/features/eventos/conjuntos';

/**
 * Linhas de detalhe de uma regra de ATP no checklist, na ordem dos três blocos
 * da tela de cadastro do Eproc — é com ela aberta que a secretaria vai ler
 * isto (decisoes.md#D-27).
 *
 * Tudo sai dos descritores do domínio: campo novo numa ação ou filtro novo
 * aparece aqui sem tocar neste arquivo.
 */

export interface DetalheRegra {
  label: string;
  valor: string;
}

function opcoesDe(campo: CampoDef): ReadonlyArray<OpcaoCampo> {
  if (campo.tipo !== 'select' && campo.tipo !== 'multi' && campo.tipo !== 'texto') return [];
  if ('catalogo' in campo && campo.catalogo) return CATALOGOS[campo.catalogo];
  return campo.opcoes ?? [];
}

/** Código sem rótulo conhecido aparece como veio — melhor que sumir. */
function rotular(opcoes: ReadonlyArray<OpcaoCampo>, codigo: string): string {
  return buscarLabel(opcoes, codigo) ?? codigo;
}

/**
 * Eventos pelo resumo dos conjuntos (decisoes.md#D-29), mas sem esconder o que
 * se marca no Eproc: a segunda linha é a lista que a secretaria precisa
 * conferir — os marcados, ou, quando é "todos menos alguns", os que ficam de
 * fora. Seleção pequena e sem conjunto sai como sempre saiu, em uma linha.
 */
export function fmtEventos(ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0) return '';
  const r = resumirEventos(ids);
  if (r.modo === 'vazio') return '';
  if (r.modo === 'inclusao' && r.conjuntos.length === 0) return ids.map(rotuloEvento).join(', ');
  const frase = frasePorResumo(r);
  if (r.modo === 'todos') return `${frase}
Marcar todos.`;
  if (r.modo === 'exclusao') {
    const sel = new Set(ids);
    const fora = CATALOGOS.eventos.filter((e) => !sel.has(e.value)).map((e) => e.label);
    return `${frase}
Marcar todos e desmarcar: ${fora.join(', ')}`;
  }
  return `${frase}
Marcar: ${ids.map(rotuloEvento).join(', ')}`;
}

/** O valor de um campo como a secretaria o leria na tela. */
export function fmtValorCampo(campo: CampoDef, v: ValorCampo): string {
  if (campo.tipo === 'lista') {
    if (!Array.isArray(v)) return '';
    return (v as unknown[])
      .filter(
        (item): item is Parametros =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
      )
      .map((item) => fmtParametros(campo.subcampos, item).join('; '))
      .filter(Boolean)
      .join('\n');
  }
  if (campo.tipo === 'simNao') return v === true ? 'Sim' : 'Não';
  if (Array.isArray(v) && campo.tipo === 'multi' && campo.catalogo === 'eventos') {
    return fmtEventos(v.filter((x): x is string => typeof x === 'string'));
  }
  if (Array.isArray(v)) {
    const opcoes = opcoesDe(campo);
    return v.map((x) => (typeof x === 'string' ? rotular(opcoes, x) : '')).join(', ');
  }
  if (campo.tipo === 'select') return rotular(opcoesDe(campo), String(v));
  return String(v).trim();
}

/** `"Rótulo: valor"` de cada campo preenchido, na ordem do descritor. */
export function fmtParametros(
  campos: ReadonlyArray<CampoDef>,
  parametros: Parametros | undefined,
): string[] {
  if (!parametros) return [];
  const linhas: string[] = [];
  for (const campo of campos) {
    if (!campoVisivel(campo, parametros)) continue;
    const v = parametros[campo.chave];
    if (valorVazio(v) || v === undefined) continue;
    const texto = fmtValorCampo(campo, v);
    if (!texto) continue;
    linhas.push(campo.tipo === 'lista' ? texto : `${campo.rotulo}: ${texto}`);
  }
  return linhas;
}

function dias(n: number | undefined, uteis: boolean | undefined): string {
  if (n == null) return uteis ? 'contar apenas dias úteis' : '';
  return `${n} dia${n === 1 ? '' : 's'}${uteis ? ' (contar apenas dias úteis)' : ''}`;
}

/** O complemento curto que a listagem do Eproc mostra depois da barra. */
function resumoGatilho(t: AtpTrigger): string {
  switch (t.tipo) {
    case 'D': {
      if (!t.tipoData) return '';
      const tipo = rotular(TIPOS_DATA_CONTROLE, t.tipoData);
      if (t.tipoData === 'D' && t.data) return `${tipo}: ${t.data}`;
      if (t.tipoData === 'M' && t.diaMes != null) return `${tipo}: dia ${t.diaMes}`;
      if (t.tipoData === 'S' && t.diaSemana) {
        return `${tipo}: ${rotular(DIAS_SEMANA, t.diaSemana)}`;
      }
      return tipo;
    }
    case 'L':
      return dias(t.dias, t.diasUteis);
    case 'S':
      return [t.statusId ? rotular(STATUS_PROCESSO, t.statusId) : '', dias(t.dias, t.diasUteis)]
        .filter(Boolean)
        .join(' — ');
    case 'V':
      return dias(t.dias, false);
    default:
      return '';
  }
}

function lista(catalogo: ReadonlyArray<OpcaoCampo>, ids: string[] | undefined): string {
  return (ids ?? []).map((id) => rotular(catalogo, id)).join(', ');
}

function detalhesGatilho(t: AtpTrigger): DetalheRegra[] {
  const tipo = rotular(TIPOS_CONTROLE, t.tipo);
  const resumo = resumoGatilho(t);
  const out: DetalheRegra[] = [
    { label: 'Tipo de controle', valor: resumo ? `${tipo} / ${resumo}` : tipo },
  ];
  const linha = (label: string, valor: string | undefined) => {
    if (valor?.trim()) out.push({ label, valor: valor.trim() });
  };

  if (t.tipo === 'A' || t.tipo === 'E') linha('Evento', fmtEventos(t.eventoIds));
  if (t.tipo === 'A' || t.tipo === 'P') {
    linha('Tipo de Petição', lista(TIPOS_PETICAO, t.peticaoTipoIds));
  }
  if (t.tipo === 'A') linha('Documento', (t.documentos ?? []).join(', '));
  if (t.tipo === 'O') linha('Tipo Documento', t.documento);
  if (t.tipo === 'A' || t.tipo === 'P') {
    // "QUALQUER PARTE" é o padrão da tela: dito ou não dito, a regra é a mesma.
    if (t.restringirA && t.restringirA !== 'Q') {
      linha(
        t.tipo === 'A' ? 'Restringir petições ou documentos de' : 'Restringir petições de',
        rotular(POLOS_PETICAO, t.restringirA),
      );
    }
    linha('Entidade', t.entidade);
  }
  if (t.tipo === 'M') {
    linha('Descrição da Regra', t.descricao);
    if (t.acaoPreferencialNaCapa) {
      linha('Mostrar como ação preferencial na capa do processo', 'Sim');
    }
    if (t.umClique) linha('Execução em um único clique', 'Sim');
  }
  return out;
}

function detalheAcao(acao: AcaoProgramada, rotulo: string): DetalheRegra | undefined {
  const def = acaoProgramadaDef(acao.tipo);
  const linhas = [
    acao.tipo ? (def?.rotulo ?? acao.tipo) : '',
    ...(acao.descricao?.trim() ? [`Descrição: ${acao.descricao.trim()}`] : []),
    ...fmtParametros(def?.campos ?? [], acao.parametros),
    ...(acao.localizadorErro?.trim()
      ? [`Localizador de Erro: ${acao.localizadorErro.trim()}`]
      : []),
  ].filter(Boolean);
  return linhas.length > 0 ? { label: rotulo, valor: linhas.join('\n') } : undefined;
}

export function detalhesAtp(rule: AtpRule): DetalheRegra[] {
  const out: DetalheRegra[] = [];

  if (rule.comportamentoOrigem) {
    out.push({
      label: 'Comportamento do Localizador ORIGEM',
      valor: rotular(COMPORTAMENTOS_ORIGEM, rule.comportamentoOrigem),
    });
  }
  if (rule.trigger) out.push(...detalhesGatilho(rule.trigger));

  const acoes = rule.acoes ?? [];
  acoes.forEach((acao, i) => {
    const d = detalheAcao(
      acao,
      acoes.length > 1 ? `Ação programada #${i + 1}` : 'Ação programada',
    );
    if (d) out.push(d);
  });

  for (const [chave, parametros] of Object.entries(rule.filtros ?? {})) {
    if (parametrosVazios(parametros)) continue;
    const def = filtroDef(chave);
    // Filtro que este build não conhece (plano de versão mais nova): mostra o
    // que der, em vez de esconder modelagem do usuário.
    if (!def) {
      out.push({ label: chave, valor: JSON.stringify(parametros) });
      continue;
    }
    const linhas = fmtParametros(def.campos, parametros);
    const unico = def.campos.length === 1 && def.campos[0]?.tipo !== 'lista';
    out.push({
      label: def.rotulo,
      // Com um campo só, o rótulo do campo repete o do filtro.
      valor: unico ? linhas.map((l) => l.slice(l.indexOf(': ') + 2)).join('\n') : linhas.join('\n'),
    });
  }

  if (rule.observacoes?.trim()) {
    out.push({ label: 'Observações', valor: rule.observacoes.trim() });
  }
  return out;
}
