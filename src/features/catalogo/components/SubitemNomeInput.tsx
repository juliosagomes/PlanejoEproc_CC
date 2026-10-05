import { useMemo } from 'react';
import type { SubitemCategoria, TipoRecurso } from '@/domain';
import { SugestoesInput } from '@/components/SugestoesInput';
import { useSugestoesSubitem } from '../sugestoes';
import { useAnotacao } from '../storeAnotacoes';

interface SubitemNomeInputProps {
  value: string;
  categoria: SubitemCategoria;
  /**
   * `existeNaUnidade` é `true` quando o texto bate exatamente com um item do
   * catálogo coletado — ou seja, o recurso já existe no Eproc.
   */
  onChange: (nome: string, existeNaUnidade: boolean) => void;
}

/**
 * Campo de nome do subitem, com sugestões do catálogo da unidade.
 *
 * Usa o `SugestoesInput` em vez do `react-select` do `LocalizadorNomeInput` por
 * causa da linha: o subitem vive numa faixa de 26px ao lado de checkbox, select
 * de categoria e botão de remover, e o controle do react-select ali dentro
 * brigaria com o layout. O `SugestoesInput` é um `<input>` comum com a lista
 * por cima, e mantém a digitação livre.
 *
 * Consequência: escolher da lista não é distinguível de digitar o mesmo texto.
 * Em vez de tentar detectar o clique, o componente informa se o texto **bate**
 * com o catálogo — o que é a informação que interessa de fato, e vale igual nos
 * dois caminhos.
 *
 * A orientação de uso anotada no catálogo (decisoes.md#D-25) aparece abaixo do
 * campo, e não dentro da lista: ela precisa continuar visível depois da escolha.
 */

/** As categorias que têm catálogo — e, portanto, podem ter anotação. */
const TIPO_DA_CATEGORIA: Partial<Record<SubitemCategoria, TipoRecurso>> = {
  Preferência: 'Preferência',
  Modelo: 'Modelo',
  'Texto padrão': 'Texto padrão',
};

export function SubitemNomeInput({ value, categoria, onChange }: SubitemNomeInputProps) {
  const sugestoes = useSugestoesSubitem(categoria);
  const tipo = TIPO_DA_CATEGORIA[categoria];
  const opcoes = useMemo(
    () =>
      sugestoes.map((s) => {
        const detalhe = [s.detalhe, s.outroOrgao && `de ${s.outroOrgao}`]
          .filter(Boolean)
          .join(' · ');
        return detalhe ? { valor: s.nome, detalhe } : { valor: s.nome };
      }),
    [sugestoes],
  );
  // Hook chamado sempre, com nome vazio quando a categoria não tem catálogo —
  // condicionar a chamada quebraria a ordem dos hooks.
  const anotacao = useAnotacao(tipo ?? 'Modelo', tipo ? value : '');
  const orientacoes = tipo ? anotacao?.orientacoes?.trim() : undefined;

  const alterar = (nome: string) => {
    const alvo = nome.trim().toLocaleLowerCase('pt-BR');
    const achou =
      alvo.length > 0 &&
      sugestoes.some((s) => s.nome.trim().toLocaleLowerCase('pt-BR') === alvo);
    onChange(nome, achou);
  };

  return (
    <>
      <SugestoesInput
        className="input"
        style={{ height: 26, padding: '2px 6px', fontSize: 12 }}
        placeholder={sugestoes.length > 0 ? 'Nome do recurso (há sugestões)' : 'Nome do recurso'}
        aria-label="Nome do recurso"
        value={value}
        onValueChange={alterar}
        sugestoes={opcoes}
      />
      {orientacoes && (
        <div
          className="text-[10.5px] text-texto-3 leading-snug"
          title="Orientação anotada no catálogo do órgão"
        >
          {orientacoes}
        </div>
      )}
    </>
  );
}
