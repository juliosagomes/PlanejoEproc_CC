import { useId } from 'react';
import type { SubitemCategoria } from '@/domain';
import { useSugestoesSubitem } from '../sugestoes';

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
 * Usa `<datalist>` em vez do `react-select` do `LocalizadorNomeInput` por causa
 * da linha: o subitem vive numa faixa de 26px ao lado de checkbox, select de
 * categoria e botão de remover, e um combobox com portal ali dentro brigaria com
 * o layout. O `<datalist>` mantém a digitação livre, é nativo, acessível por
 * teclado, e não custa nada em bundle.
 *
 * Consequência do `<datalist>`: escolher da lista não é distinguível de digitar
 * o mesmo texto. Em vez de tentar detectar o clique, o componente informa se o
 * texto **bate** com o catálogo — o que é a informação que interessa de fato, e
 * vale igual nos dois caminhos.
 */
export function SubitemNomeInput({ value, categoria, onChange }: SubitemNomeInputProps) {
  const sugestoes = useSugestoesSubitem(categoria);
  const listId = useId();

  const alterar = (nome: string) => {
    const alvo = nome.trim().toLocaleLowerCase('pt-BR');
    const achou =
      alvo.length > 0 &&
      sugestoes.some((s) => s.nome.trim().toLocaleLowerCase('pt-BR') === alvo);
    onChange(nome, achou);
  };

  return (
    <>
      <input
        className="input"
        style={{ height: 26, padding: '2px 6px', fontSize: 12 }}
        placeholder={sugestoes.length > 0 ? 'Nome do recurso (há sugestões)' : 'Nome do recurso'}
        value={value}
        list={sugestoes.length > 0 ? listId : undefined}
        onChange={(e) => alterar(e.target.value)}
      />
      {sugestoes.length > 0 && (
        <datalist id={listId}>
          {sugestoes.map((s) => (
            <option key={`${s.nome}-${s.detalhe ?? ''}-${s.outroOrgao ?? ''}`} value={s.nome}>
              {[s.detalhe, s.outroOrgao && `de ${s.outroOrgao}`].filter(Boolean).join(' · ')}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}
