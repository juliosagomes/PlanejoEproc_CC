/**
 * Marca dos localizadores que são padrão do Eproc (decisoes.md#D-23).
 *
 * Âmbar e não azul: `--destaque` é a cor do estado focado do combobox de nome,
 * e um badge azul na lista se confundiria com "esta é a opção sob o cursor".
 */
export function BadgeSistema() {
  return (
    <span
      style={{
        fontSize: 10,
        lineHeight: 1.4,
        padding: '0 5px',
        borderRadius: 4,
        flexShrink: 0,
        color: 'var(--aviso)',
        background: 'var(--aviso-suave)',
        border: '1px solid var(--aviso)',
      }}
      title="Localizador padrão do Eproc, não criado pela unidade"
    >
      Sistema
    </span>
  );
}
