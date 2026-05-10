#!/usr/bin/env node
/**
 * Empacotador da distribuição em pasta.
 *
 * Lê `dist/` (saída do `vite build`) e produz `dist-pack/PlanejoEproc/` com
 * a estrutura final que o usuário recebe:
 *
 *   PlanejoEproc/
 *     index.html
 *     assets/
 *     planos/
 *       README.txt
 *     LEIA-ME.txt
 *
 * Não zipa — o usuário pode compactar manualmente (clique direito → Enviar
 * para → Pasta compactada) ou copiar a pasta por rede compartilhada. Manter
 * fora do script evita uma dependência (archiver/jszip) só para isso.
 *
 * Sem dependências externas: usa só `node:fs/promises` e `node:path`.
 */

import { readFile, rm, mkdir, cp, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = join(ROOT, 'dist');
const OUT_BASE = join(ROOT, 'dist-pack');
const OUT = join(OUT_BASE, 'PlanejoEproc');

const LEIA_ME = `PlanejoEproc — instruções de uso
=================================

1. ABRIR
   Dê duplo clique em index.html. O navegador padrão (Edge, Chrome ou Firefox)
   abrirá o app. Não é preciso instalar nada nem ter internet.

2. SEUS PLANOS
   Os planos que você criar ficam salvos automaticamente no navegador
   (localStorage) e aparecem no switcher do canto superior esquerdo do app.
   Para guardar uma cópia em arquivo (backup, compartilhar, mover de máquina),
   use "Salvar cópia" no header e escolha a pasta ./planos/ que vem junto.

3. ABRIR UM PLANO SALVO
   Use "Abrir arquivo" no header e selecione o JSON da pasta ./planos/. O
   plano vira uma entrada nova no switcher.

4. NAVEGADORES SUPORTADOS
   Recomendado: Microsoft Edge ou Google Chrome (versão recente).
   Firefox também funciona.

5. PROBLEMAS COMUNS
   - Página em branco ao abrir? Tente outro navegador. Algumas configurações
     restritivas bloqueiam módulos JavaScript carregados de file://.
   - Plano "sumiu" ao mover a pasta? O localStorage está vinculado ao
     navegador e ao caminho onde está o index.html. Reabra do mesmo local
     ou use "Abrir arquivo" para recuperar a partir de um JSON salvo.

PlanejoEproc é uma ferramenta para planejar fluxos do Eproc (TJMG e similares)
antes de configurá-los no sistema real.
`;

const PLANOS_README = `Esta pasta guarda os planos exportados manualmente do PlanejoEproc.

Para salvar aqui: no app, clique em "Salvar cópia" e escolha esta pasta no
diálogo do navegador.

Para abrir um plano daqui: no app, clique em "Abrir arquivo" e selecione o
JSON correspondente. O plano vira uma entrada nova no switcher do header.

Os planos também ficam salvos automaticamente no navegador. Esta pasta serve
como backup em arquivo e como forma de compartilhar planos entre máquinas.
`;

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function getPkgVersion() {
  const raw = await readFile(join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  return pkg.version ?? '0.0.0';
}

async function dirSizeBytes(dir) {
  const { readdir } = await import('node:fs/promises');
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSizeBytes(full);
    } else if (entry.isFile()) {
      const s = await stat(full);
      total += s.size;
    }
  }
  return total;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  if (!(await exists(DIST))) {
    console.error(
      `[pack] Não encontrei ${relative(ROOT, DIST)}. Rode "npm run build" antes.`,
    );
    process.exit(1);
  }

  console.log(`[pack] Limpando ${relative(ROOT, OUT_BASE)}...`);
  await rm(OUT_BASE, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  console.log(`[pack] Copiando dist/ → ${relative(ROOT, OUT)}/`);
  await cp(DIST, OUT, { recursive: true });

  console.log(`[pack] Criando planos/README.txt e LEIA-ME.txt`);
  await mkdir(join(OUT, 'planos'), { recursive: true });
  await writeFile(join(OUT, 'planos', 'README.txt'), PLANOS_README, 'utf8');
  await writeFile(join(OUT, 'LEIA-ME.txt'), LEIA_ME, 'utf8');

  const totalSize = await dirSizeBytes(OUT);
  const version = await getPkgVersion();

  console.log('');
  console.log(`[pack] Pronto. Versão ${version}, tamanho ${fmtBytes(totalSize)}`);
  console.log(`[pack] Pasta: ${OUT}`);
  console.log('');
  console.log('Próximos passos:');
  console.log(
    '  - Para distribuir: clique direito na pasta PlanejoEproc → Enviar para → Pasta compactada',
  );
  console.log('  - Para testar: abra index.html dentro dela com duplo clique');
}

main().catch((err) => {
  console.error('[pack] Falhou:', err);
  process.exit(1);
});
