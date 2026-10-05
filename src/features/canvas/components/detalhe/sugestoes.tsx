import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SugestaoId } from '@/domain';
import { EVENTOS } from '@/data';
import { useSugestoesLocalizador, useSugestoesSubitem } from '@/features/catalogo/sugestoes';
import { useCanvasStore } from '../../store';

/**
 * Sugestões para os campos da regra de ATP que, no Eproc, listam coisas **da
 * unidade** — localizadores, modelos, preferências. Não são embutidas no build
 * (decisoes.md#D-27): saem do plano aberto e do catálogo sincronizado, e o
 * campo aceita texto livre quando nenhum dos dois ajuda.
 *
 * Contexto em vez de hook por campo: o modal tem dezenas de campos, e cada um
 * assinar três stores para montar a mesma lista seria desperdício.
 */
type Sugestoes = Record<SugestaoId, string[]>;

const VAZIO: Sugestoes = { localizador: [], modelo: [], preferencia: [], evento: [] };

const SugestoesContext = createContext<Sugestoes>(VAZIO);

function unicos(nomes: string[]): string[] {
  return [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
}

export function SugestoesProvider({ children }: { children: ReactNode }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const doCatalogo = useSugestoesLocalizador();
  const modelos = useSugestoesSubitem('Modelo');
  const preferencias = useSugestoesSubitem('Preferência');

  const valor = useMemo<Sugestoes>(
    () => ({
      // Os do plano primeiro: é o fluxo que está sendo desenhado, e pode
      // incluir localizador que ainda nem existe no Eproc.
      localizador: unicos([...nodes.map((n) => n.data.nome), ...doCatalogo.map((l) => l.nome)]),
      modelo: unicos(modelos.map((m) => m.nome)),
      preferencia: unicos(preferencias.map((p) => p.nome)),
      evento: EVENTOS.map((e) => e.label),
    }),
    [nodes, doCatalogo, modelos, preferencias],
  );

  return <SugestoesContext.Provider value={valor}>{children}</SugestoesContext.Provider>;
}

export function useSugestoes(id: SugestaoId | undefined): string[] {
  const todas = useContext(SugestoesContext);
  return id ? todas[id] : [];
}
