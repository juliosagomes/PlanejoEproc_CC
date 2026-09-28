import type { TipoRecurso } from '@/domain';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';

/**
 * Chave de uma anotação: tipo do recurso + forma canônica do nome.
 *
 * Para **localizador**, a canonização é `semDecoracao` — a mesma que
 * `unirSugestoes` usa para deduplicar os dois catálogos e que
 * `useAcoesPreferenciaisDoLocalizador` usa para casar sigla com localizador. Se
 * a anotação usasse outra régua, o app discordaria de si mesmo sobre o que é "o
 * mesmo localizador": a sugestão colapsaria `📝 Minutar` com `Minutar`, e a
 * anotação não.
 *
 * Para os outros três, `semDecoracao` seria agressiva demais — nomes de modelo
 * e texto padrão se distinguem por pontuação e acento com frequência ("Despacho
 * - citação" × "Despacho citação"). Basta normalizar caixa e espaço em branco.
 */
export function chaveAnotacao(tipo: TipoRecurso, nome: string): string {
  const canon =
    tipo === 'Localizador'
      ? semDecoracao(nome)
      : nome.replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
  return `${tipo}|${canon}`;
}
