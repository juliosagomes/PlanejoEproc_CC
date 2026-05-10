#!/usr/bin/env node
/**
 * Empacotador da distribuição.
 *
 * Lê `dist-singlefile/index.html` (saída do `vite build --mode singlefile`)
 * e produz `dist-pack/PlanejoEproc/` com a estrutura final que o usuário
 * recebe:
 *
 *   PlanejoEproc/
 *     index.html          ← singlefile (tudo inline — JS, CSS, fontes)
 *     planos/
 *       README.txt
 *     localizadores/
 *       README.txt
 *     LEIA-ME.txt
 *
 * O index.html é autossuficiente; as subpastas existem só para o usuário
 * guardar/consultar arquivos de apoio: `planos/` para JSONs de plano, e
 * `localizadores/` para o XLS de "Localizadores do Órgão" exportado do
 * Eproc. Modelo híbrido escolhido porque Chromium bloqueia ES modules
 * carregados via file:// — singlefile contorna o problema inlinando tudo, e
 * a pasta resolve a necessidade de espaço para arquivos auxiliares. Pelo
 * mesmo motivo de CORS, o app não consegue ler `./localizadores/*.xls`
 * sozinho — a pasta é só local de armazenamento; a importação é via botão
 * "Catálogo órgão" no header.
 *
 * Sem dependências externas: usa só `node:fs/promises` e `node:path`. O
 * usuário pode compactar `PlanejoEproc/` manualmente (clique direito →
 * Enviar para → Pasta compactada) ou copiar por rede.
 */

import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_HTML = join(ROOT, 'dist-singlefile', 'index.html');
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

4. CATÁLOGO DO ÓRGÃO (sugestões de localizador)
   No Eproc, exporte os "Localizadores do Órgão" em XLS e guarde o arquivo
   em ./localizadores/ (ao lado de index.html). No app, use o botão
   "Catálogo órgão" no header para importá-lo. A partir daí, ao digitar o
   nome de um localizador no canvas, os do seu órgão aparecem como
   sugestões — escolher uma sugestão já marca o nó como existente no Eproc.
   Apenas localizadores que NÃO são do sistema entram no catálogo.

5. NAVEGADORES SUPORTADOS
   Recomendado: Microsoft Edge ou Google Chrome (versão recente).
   Firefox também funciona.

6. PROBLEMAS COMUNS
   - Plano "sumiu" ao mover a pasta? O localStorage está vinculado ao
     navegador e ao caminho onde está o index.html. Reabra do mesmo local
     ou use "Abrir arquivo" para recuperar a partir de um JSON salvo.
   - Catálogo do órgão também fica no localStorage do navegador. Para usar
     em outra máquina, copie o XLS para a pasta ./localizadores/ de lá e
     reimporte pelo botão do header.

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

const LOCALIZADORES_README = `Esta pasta guarda o arquivo de "Localizadores do Órgão" exportado do Eproc.

COMO EXPORTAR DO EPROC
  No Eproc, vá em Localizadores → Localizadores do Órgão → exportar/imprimir.
  O sistema gera um arquivo .xls (ex.: LocalizadoresOrgao-2026-5-10-4-49-24.xls).
  Salve esse arquivo aqui dentro.

COMO IMPORTAR NO APP
  Abra o app (../index.html) e clique em "Catálogo órgão" no header.
  Use "Importar XLS" e escolha o arquivo desta pasta. O navegador NÃO
  consegue ler arquivos desta pasta sozinho — a pasta é só um lugar
  conveniente para o XLS ficar. A importação acontece sempre por clique.

O QUE O APP USA
  Apenas localizadores que NÃO são "do sistema" entram no catálogo de
  sugestões. Os de sistema são padrões fixos do Eproc; o objetivo do
  PlanejoEproc é incentivar a criação de fluxos próprios.

ATUALIZAR
  Sempre que o seu órgão criar/renomear localizadores, exporte um XLS
  novo e reimporte pelo mesmo botão. A reimportação substitui o catálogo
  anterior (a confirmação avisa).
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

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  if (!(await exists(SRC_HTML))) {
    console.error(
      `[pack] Não encontrei ${relative(ROOT, SRC_HTML)}. Rode "npm run build:singlefile" antes.`,
    );
    process.exit(1);
  }

  console.log(`[pack] Limpando ${relative(ROOT, OUT_BASE)}...`);
  await rm(OUT_BASE, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  console.log(`[pack] Copiando singlefile → ${relative(ROOT, OUT)}/index.html`);
  await copyFile(SRC_HTML, join(OUT, 'index.html'));

  console.log(`[pack] Criando planos/, localizadores/ e LEIA-ME.txt`);
  await mkdir(join(OUT, 'planos'), { recursive: true });
  await writeFile(join(OUT, 'planos', 'README.txt'), PLANOS_README, 'utf8');
  await mkdir(join(OUT, 'localizadores'), { recursive: true });
  await writeFile(
    join(OUT, 'localizadores', 'README.txt'),
    LOCALIZADORES_README,
    'utf8',
  );
  await writeFile(join(OUT, 'LEIA-ME.txt'), LEIA_ME, 'utf8');

  const htmlSize = (await stat(join(OUT, 'index.html'))).size;
  const version = await getPkgVersion();

  console.log('');
  console.log(`[pack] Pronto. Versão ${version}, index.html ${fmtBytes(htmlSize)}`);
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
