import type { Subitem } from '@/domain';
import { useCanvasStore } from '../store';
import { AtpModal } from './detalhe/AtpModal';
import { PrefModal } from './detalhe/PrefModal';

/* ============================================================================
 * Modal de detalhamento de ATP / Preferência.
 *
 * Recebe o recurso da aresta que carrega a regra e devolve patches sobre ele
 * via `onChange`. Este arquivo só escolhe qual modal abrir; cada um mora em
 * `./detalhe/`.
 * ========================================================================== */

interface EdgeDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** O recurso em edição — dele saem o nome e a regra. */
  subitem: Subitem;
  /** Resumo da aresta, usado como título quando o recurso ainda não tem nome. */
  resumo: string;
  /** Nomes dos localizadores nas pontas da aresta — origem e destino da regra de ATP. */
  origem: string;
  destino: string;
  /** Recursos comuns da mesma aresta (nem ATP, nem Preferência). */
  recursosComuns: number;
  /** Outras regras da mesma aresta — mudam como o checklist agrupa. */
  outrasRegras: number;
  onChange: (patch: Partial<Subitem>) => void;
  /** Regra pendurada num localizador (D-38); só vale para ATP. */
  pendurada?: boolean;
}

/**
 * Modal de detalhamento de um recurso do tipo ATP ou Preferência.
 *
 * Uma aresta pode ter vários (decisoes.md#D-24), então o modal recebe **o
 * recurso**, e não a aresta: quem decide qual abrir é o `EdgePanel`.
 */
export function EdgeDetailModal({
  open,
  onClose,
  subitem,
  resumo,
  origem,
  destino,
  recursosComuns,
  outrasRegras,
  onChange,
  pendurada,
}: EdgeDetailModalProps) {
  // Numa sessão de visualização o modal continua abrindo: o detalhamento é
  // conteúdo do plano, e esconder é pior do que mostrar travado. O que muda é
  // que os campos vêm desabilitados (ver `ModalShell`).
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);

  if (!open) return null;

  const comuns = {
    nome: subitem.nome,
    jaCriado: subitem.ja_criado,
    resumo,
    recursosComuns,
    outrasRegras,
    somenteLeitura,
    onClose,
    onChange,
  };

  if (subitem.categoria === 'Regra de ATP') {
    return (
      <AtpModal {...comuns} rule={subitem.atp} origem={origem} destino={destino} pendurada={pendurada} />
    );
  }
  if (subitem.categoria === 'Preferência') {
    return <PrefModal {...comuns} rule={subitem.pref} />;
  }
  return null;
}
