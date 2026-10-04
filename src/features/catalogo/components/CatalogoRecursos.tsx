import { useMemo, useState } from 'react';
import { TIPOS_RECURSO, type TipoRecurso } from '@/domain';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';
import { cn } from '@/utils/cn';
import { useConsultasSalvas, useSugestoesLocalizador, useSugestoesSubitem } from '../sugestoes';
import { buscarAnotacao, useAnotacoesStore } from '../storeAnotacoes';
import { BadgeSistema } from './BadgeSistema';

/* ============================================================================
 * Navegador dos recursos mapeados (decisoes.md#D-25).
 *
 * Uma aba por tipo, e cada linha abre os dois campos de anotação. As listas são
 * exatamente as mesmas que alimentam a autocomplete — `useSugestoesLocalizador`
 * e `useSugestoesSubitem` —, então o que se vê aqui é o que vai ser sugerido
 * lá, sem uma segunda régua de união e ordenação para divergir da primeira.
 * ========================================================================== */

interface Linha {
  nome: string;
  /** Descrição vinda do catálogo (XLS ou coleta) — não é a anotação do usuário. */
  descricao?: string;
  /** Tipo de documento (modelos) ou sigla auto-texto (textos padrão). */
  detalhe?: string;
  sistema?: boolean;
  outroOrgao?: string;
  /**
   * Nome sob o qual a anotação é guardada, quando não é o próprio `nome`. A
   * consulta salva leva a tela junto: duas telas podem ter consultas de mesmo
   * nome, e são consultas diferentes.
   */
  chaveAnotacao?: string;
}

/** Aba vazia explica de onde o dado dela viria — o caminho não é o mesmo para os quatro. */
const ORIGEM: Record<TipoRecurso, string> = {
  Localizador:
    'Importe o XLS pelo botão abaixo, ou use "Sincronizar com a unidade", no menu Unidade do cabeçalho.',
  Preferência:
    'Vem de "Sincronizar com a unidade" — o XLS do órgão só traz localizadores.',
  Modelo: 'Vem de "Sincronizar com a unidade" — o XLS do órgão só traz localizadores.',
  'Texto padrão':
    'Vem de "Sincronizar com a unidade" — o XLS do órgão só traz localizadores.',
  'Consulta salva':
    'Vem de "Sincronizar com a unidade": as consultas salvas no Relatório Geral, na Lista de Processos por Localizador, na Área de Minutas e em Processos sem Movimentação. Só o nome vem — anote aqui o que cada uma filtra.',
};

const ROTULO_ABA: Record<TipoRecurso, string> = {
  Localizador: 'Localizadores',
  Preferência: 'Preferências',
  Modelo: 'Modelos',
  'Texto padrão': 'Textos padrão',
  'Consulta salva': 'Consultas salvas',
};

export function CatalogoRecursos() {
  const [aba, setAba] = useState<TipoRecurso>('Localizador');
  const [busca, setBusca] = useState('');

  const localizadores = useSugestoesLocalizador();
  const preferencias = useSugestoesSubitem('Preferência');
  const modelos = useSugestoesSubitem('Modelo');
  const textosPadrao = useSugestoesSubitem('Texto padrão');
  const consultas = useConsultasSalvas();

  const porTipo: Record<TipoRecurso, Linha[]> = useMemo(
    () => ({
      Localizador: localizadores.map((l) => ({
        nome: l.nome,
        ...(l.descricao ? { descricao: l.descricao } : {}),
        ...(l.sistema ? { sistema: true } : {}),
      })),
      Preferência: preferencias,
      Modelo: modelos,
      'Texto padrão': textosPadrao,
      'Consulta salva': consultas.map((c) => ({
        nome: c.nome,
        detalhe: c.individual ? `${c.tela} · individual` : c.tela,
        chaveAnotacao: `${c.tela} · ${c.nome}`,
      })),
    }),
    [localizadores, preferencias, modelos, textosPadrao, consultas],
  );

  const linhas = porTipo[aba];
  const filtradas = useMemo(() => {
    const alvo = semDecoracao(busca);
    if (!alvo) return linhas;
    // Canonizar os dois lados: quem digita "citacao" precisa achar
    // "🔔 Citação", que é como o Eproc escreve.
    return linhas.filter((l) => semDecoracao(l.nome).includes(alvo));
  }, [linhas, busca]);

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        {TIPOS_RECURSO.map((t) => (
          <button
            key={t}
            type="button"
            className={cn('btn btn-sm', aba === t && 'btn-primary')}
            onClick={() => {
              setAba(t);
              setBusca('');
            }}
            aria-pressed={aba === t}
          >
            {ROTULO_ABA[t]}
            <span className="mono ml-1 text-[10.5px] opacity-70">{porTipo[t].length}</span>
          </button>
        ))}
      </div>

      <input
        className="input"
        type="search"
        placeholder="Buscar pelo nome…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label={`Buscar entre os recursos do tipo ${aba}`}
      />

      <div
        className="overflow-auto scroll"
        style={{
          maxHeight: '38vh',
          minHeight: 120,
          border: '1px solid var(--borda)',
          borderRadius: 8,
        }}
      >
        {linhas.length === 0 ? (
          <div className="p-4 text-[12px] text-texto-3 leading-snug">{ORIGEM[aba]}</div>
        ) : filtradas.length === 0 ? (
          <div className="p-4 text-[12px] text-texto-3">
            Nenhum recurso com esse nome.
          </div>
        ) : (
          filtradas.map((l) => (
            <LinhaRecurso key={`${aba}-${l.chaveAnotacao ?? l.nome}`} tipo={aba} linha={l} />
          ))
        )}
      </div>
    </div>
  );
}

interface LinhaRecursoProps {
  tipo: TipoRecurso;
  linha: Linha;
}

function LinhaRecurso({ tipo, linha }: LinhaRecursoProps) {
  const [aberto, setAberto] = useState(false);
  const anotacoes = useAnotacoesStore((s) => s.anotacoes);
  const definir = useAnotacoesStore((s) => s.definir);
  const chave = linha.chaveAnotacao ?? linha.nome;
  const anotacao = buscarAnotacao(anotacoes, tipo, chave);

  // A anotação do usuário ganha da descrição do catálogo: ela foi escrita
  // depois, sabendo o que a outra dizia.
  const descricaoVisivel = anotacao?.descricao?.trim() || linha.descricao;

  return (
    <div style={{ borderBottom: '1px solid var(--borda)' }}>
      <button
        type="button"
        className="w-full text-left flex items-start gap-2"
        style={{ padding: '7px 10px', background: 'transparent' }}
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[12.5px]">{linha.nome || '(sem nome)'}</span>
            {linha.sistema && <BadgeSistema />}
            {linha.outroOrgao && (
              <span
                className="mono text-[10px] text-texto-3"
                title="Pertence a outra unidade"
              >
                {linha.outroOrgao}
              </span>
            )}
            {linha.detalhe && (
              <span className="text-[10.5px] text-texto-3">{linha.detalhe}</span>
            )}
          </div>
          {descricaoVisivel && (
            <div className="text-[11px] text-texto-3 leading-snug mt-0.5">
              {descricaoVisivel}
            </div>
          )}
        </div>
        <span
          className="text-[10.5px] flex-shrink-0"
          style={{ color: anotacao ? 'var(--ok)' : 'var(--texto-3)' }}
        >
          {anotacao ? 'anotado' : 'anotar'}
        </span>
      </button>

      {aberto && (
        <div
          className="flex flex-col gap-2"
          style={{ padding: '4px 10px 10px', background: 'var(--superficie-2)' }}
        >
          <div>
            <label className="label">Descrição</label>
            <input
              className="input"
              placeholder={linha.descricao ?? 'O que este recurso é…'}
              value={anotacao?.descricao ?? ''}
              onChange={(e) => definir(tipo, chave, { descricao: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Orientações de uso</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Quando usar, o que preencher, com o que não confundir…"
              value={anotacao?.orientacoes ?? ''}
              onChange={(e) => definir(tipo, chave, { orientacoes: e.target.value })}
            />
          </div>
          <div className="text-[10.5px] text-texto-3 leading-snug">
            A anotação é sua e fica neste navegador — atravessa reimportar o XLS e
            ressincronizar a unidade.
          </div>
        </div>
      )}
    </div>
  );
}
