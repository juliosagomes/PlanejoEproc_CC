import { useEffect, useMemo, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import type { ActionMeta, InputActionMeta, StylesConfig } from 'react-select';
import type { LocalizadorOrgao } from '@/domain';

/**
 * Combobox para o campo "nome do localizador" no NodePanel.
 *
 * Funciona como um input normal — o usuário pode digitar livremente — mas
 * mostra sugestões do catálogo do órgão conforme a digitação. Quando o
 * usuário escolhe uma sugestão (clique ou Enter no item da lista), o nó é
 * marcado como já criado no Eproc; quando o usuário só digita texto livre,
 * `ja_criado` fica como estava.
 *
 * Atalhos preservados:
 *  - Delete com input vazio cancela o nó (replica o comportamento do <input>
 *    simples original — autoFocus rouba o Delete global do ReactFlow).
 */

interface Option {
  value: string;
  label: string;
  descricao?: string;
  /** Presente apenas em opções vindas do catálogo. Texto livre não tem id. */
  localizadorId?: string;
}

interface LocalizadorNomeInputProps {
  value: string;
  itens: LocalizadorOrgao[];
  autoFocus?: boolean;
  /** Texto livre digitado a cada keystroke. Não toca em ja_criado. */
  onChangeNome: (nome: string) => void;
  /** Item escolhido da lista de sugestões. Marca ja_criado=true. */
  onPickFromCatalogo: (item: LocalizadorOrgao) => void;
  /** Delete pressionado com input vazio. */
  onDeleteEmpty: () => void;
  placeholder?: string;
}

export function LocalizadorNomeInput({
  value,
  itens,
  autoFocus,
  onChangeNome,
  onPickFromCatalogo,
  onDeleteEmpty,
  placeholder = 'Ex: Aguardando despacho',
}: LocalizadorNomeInputProps) {
  // O react-select Creatable controla o `inputValue` separado do `value` —
  // espelhamos para o estado externo sincronizar a cada keystroke.
  const [inputValue, setInputValue] = useState(value);

  // Quando o `value` é alterado externamente (carregar plano, undo futuro),
  // realinha o input. Não dispara onChangeNome — só sincroniza espelho local.
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const options = useMemo<Option[]>(
    () =>
      itens
        .map<Option>((it) => ({
          value: it.nome,
          label: it.nome,
          ...(it.descricao ? { descricao: it.descricao } : {}),
          localizadorId: it.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [itens],
  );

  // Renderiza o `value` como uma Option fictícia para o Creatable mostrar
  // o texto atual no chip. Se o nome bate com um item do catálogo, usa a
  // option de verdade (mantém metadados); senão, fabrica uma efêmera.
  const currentOption: Option | null = useMemo(() => {
    if (!value) return null;
    return options.find((o) => o.value === value) ?? { value, label: value };
  }, [options, value]);

  const handleInputChange = (newInput: string, meta: InputActionMeta) => {
    // Outras actions ('menu-close', 'set-value', 'input-blur') são internas
    // do react-select; só nos interessa digitação real.
    if (meta.action === 'input-change') {
      setInputValue(newInput);
      onChangeNome(newInput);
    }
  };

  const handleChange = (option: Option | null, meta: ActionMeta<Option>) => {
    if (meta.action === 'select-option' && option?.localizadorId) {
      const item = itens.find((it) => it.id === option.localizadorId);
      if (item) {
        onPickFromCatalogo(item);
        setInputValue(item.nome);
      }
      return;
    }
    if (meta.action === 'create-option' && option) {
      // "Criar opção" do Creatable = aceitar o texto livre via Enter.
      onChangeNome(option.value);
      setInputValue(option.value);
      return;
    }
    if (meta.action === 'clear') {
      onChangeNome('');
      setInputValue('');
    }
  };

  return (
    <CreatableSelect<Option, false>
      autoFocus={autoFocus}
      isClearable
      value={currentOption}
      inputValue={inputValue}
      onChange={handleChange}
      onInputChange={handleInputChange}
      options={options}
      placeholder={placeholder}
      noOptionsMessage={() =>
        itens.length === 0
          ? 'Nenhum localizador conhecido ainda. Use "Sincronizar com a unidade" ' +
            '(com o Eproc aberto) ou "Catálogo órgão" (XLS), no header.'
          : 'Sem sugestões — Enter para usar como nome livre.'
      }
      formatCreateLabel={(input) => `Usar "${input}" como nome livre`}
      formatOptionLabel={(opt, fmt) =>
        // Quando exibido no chip do value, só o nome importa.
        fmt.context === 'value' ? (
          <span>{opt.label}</span>
        ) : (
          <div>
            <div>{opt.label}</div>
            {opt.descricao && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--texto-3)',
                  whiteSpace: 'normal',
                  marginTop: 1,
                }}
              >
                {opt.descricao.length > 140
                  ? `${opt.descricao.slice(0, 140)}…`
                  : opt.descricao}
              </div>
            )}
          </div>
        )
      }
      onKeyDown={(e) => {
        if (e.key === 'Delete' && inputValue.length === 0) {
          e.preventDefault();
          onDeleteEmpty();
        }
      }}
      classNamePrefix="rs"
      styles={styles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
    />
  );
}

const styles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 32,
    backgroundColor: 'var(--superficie)',
    borderColor: state.isFocused ? 'var(--destaque)' : 'var(--borda-forte)',
    boxShadow: state.isFocused ? '0 0 0 3px oklch(0.55 0.15 265 / 0.12)' : 'none',
    borderRadius: 6,
    fontSize: 13,
    ':hover': { borderColor: state.isFocused ? 'var(--destaque)' : 'var(--borda-forte)' },
  }),
  valueContainer: (base) => ({ ...base, padding: '2px 6px' }),
  placeholder: (base) => ({ ...base, color: 'var(--texto-3)' }),
  input: (base) => ({ ...base, color: 'var(--texto)', margin: 0, padding: 0 }),
  singleValue: (base) => ({ ...base, color: 'var(--texto)' }),
  menu: (base) => ({
    ...base,
    background: 'var(--superficie)',
    border: '1px solid var(--borda)',
    boxShadow: '0 4px 14px -6px rgba(20,22,28,0.18)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 60 }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused
      ? 'var(--superficie-2)'
      : state.isSelected
        ? 'var(--destaque-suave)'
        : 'var(--superficie)',
    color: 'var(--texto)',
    fontSize: 12.5,
    cursor: 'pointer',
    paddingTop: 6,
    paddingBottom: 6,
  }),
  indicatorSeparator: (base) => ({ ...base, background: 'var(--borda)' }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--texto-3)', padding: 4 }),
  clearIndicator: (base) => ({ ...base, color: 'var(--texto-3)', padding: 4 }),
};
