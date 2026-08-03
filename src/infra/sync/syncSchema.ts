import { z } from 'zod';
import { PlanoSchema } from '@/infra/storage';

/**
 * Schemas Zod da API de sincronização (Google Apps Script — ver
 * `apps-script/Code.gs`). Mesma disciplina de `infra/storage/schema.ts`:
 * toda resposta de rede é dado não confiável e passa por aqui antes de
 * qualquer uso. Reaproveita `PlanoSchema` para validar o conteúdo de cada
 * plano recebido — é o mesmo shape do plano exportado/importado.
 */

const ErroResponseSchema = z.object({
  ok: z.literal(false),
  erro: z.string(),
});

const PermissaoSchema = z.enum(['leitura', 'edicao']);

const SincronizarPlanoItemSchema = z.object({
  remotoId: z.string(),
  nome: z.string(),
  atualizadoEm: z.string(),
  plano: PlanoSchema,
});

export type SincronizarPlanoItem = z.infer<typeof SincronizarPlanoItemSchema>;

export const SincronizarResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    workspaceId: z.string(),
    nome: z.string(),
    planos: z.array(SincronizarPlanoItemSchema),
    permissao: PermissaoSchema,
    /**
     * Só vem quando o código usado foi o de edição. `optional()` de propósito:
     * uma implantação antiga do Apps Script não o devolve, e nesse caso a UI
     * apenas deixa de oferecer o código de leitura — não é motivo para falhar
     * a entrada na lotação inteira (decisoes.md#D-10).
     */
    codigoLeitura: z.string().optional(),
  }),
  ErroResponseSchema,
]);

const PublicarItemResultSchema = z.object({
  remotoId: z.string(),
  atualizadoEm: z.string(),
});

export const PublicarResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    publicados: z.array(PublicarItemResultSchema),
    /** `remotoId`s efetivamente removidos do servidor nesta chamada. */
    removidos: z.array(z.string()).default([]),
  }),
  ErroResponseSchema,
]);

export const CriarWorkspaceResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    workspaceId: z.string(),
    codigoLeitura: z.string(),
    codigoEdicao: z.string(),
  }),
  ErroResponseSchema,
]);
