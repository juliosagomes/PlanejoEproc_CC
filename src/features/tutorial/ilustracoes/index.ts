import type { ComponentType } from 'react';
import { Passo1Sincronizar } from './Passo1Sincronizar';
import { Passo2Localizador } from './Passo2Localizador';
import { Passo3SegundoNo } from './Passo3SegundoNo';
import { Passo4Conectar } from './Passo4Conectar';
import { Passo5ResumoAtp } from './Passo5ResumoAtp';
import { Passo6Recurso } from './Passo6Recurso';
import { Passo7Balao } from './Passo7Balao';
import { Passo8Checklist } from './Passo8Checklist';

/**
 * Mapa `id do passo` → cena.
 *
 * Existe separado de `roteiro.ts` para que o texto continue testável sem React.
 * O teste do roteiro confere que todo id daqui tem entrada — é o que pega o
 * "escrevi o passo 9 e esqueci de desenhar".
 */
export const ILUSTRACOES: Readonly<Record<number, ComponentType>> = {
  1: Passo1Sincronizar,
  2: Passo2Localizador,
  3: Passo3SegundoNo,
  4: Passo4Conectar,
  5: Passo5ResumoAtp,
  6: Passo6Recurso,
  7: Passo7Balao,
  8: Passo8Checklist,
};
