import { useMemo } from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import type { ItemCatalogo } from '@/data';

/**
 * Multi-select com busca para catálogos do Eproc (decisoes.md#D-5).
 *
 * Substitui o `<select multiple>` nativo por react-select, oferecendo typeahead
 * e seleção por teclado para listas grandes (Eventos ≈ 700, Classes ≈ 500).
 *
 * Renderiza o menu via portal no `document.body` com posição `fixed`: caso
 * contrário a lista seria recortada pelo `overflow:auto` do modal hospedeiro.
 */

interface CatalogMultiProps {
  values: string[];
  options: ItemCatalogo[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function CatalogMulti({
  values,
  options,
  onChange,
  placeholder = 'Selecione…',
  ariaLabel,
}: CatalogMultiProps) {
  const byValue = useMemo(() => {
    const m = new Map<string, ItemCatalogo>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const selected = useMemo(
    () => values.map((v) => byValue.get(v)).filter((x): x is ItemCatalogo => Boolean(x)),
    [values, byValue],
  );

  return (
    <Select<ItemCatalogo, true>
      isMulti
      options={options}
      value={selected}
      onChange={(next: MultiValue<ItemCatalogo>) => onChange(next.map((n) => n.value))}
      placeholder={placeholder}
      noOptionsMessage={() => 'Sem resultados'}
      aria-label={ariaLabel}
      classNamePrefix="rs"
      styles={styles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      closeMenuOnSelect={false}
    />
  );
}

const styles: StylesConfig<ItemCatalogo, true> = {
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
  multiValue: (base) => ({
    ...base,
    background: 'var(--destaque-suave)',
    border: '1px solid var(--destaque-borda)',
    borderRadius: 4,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'var(--texto)',
    fontSize: 11.5,
    padding: '1px 4px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--texto-2)',
    ':hover': { background: 'var(--destaque)', color: 'var(--superficie)' },
  }),
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
  }),
  indicatorSeparator: (base) => ({ ...base, background: 'var(--borda)' }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--texto-3)', padding: 4 }),
  clearIndicator: (base) => ({ ...base, color: 'var(--texto-3)', padding: 4 }),
};
