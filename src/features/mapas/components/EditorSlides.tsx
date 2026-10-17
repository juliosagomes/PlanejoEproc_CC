import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '@/components/Icon';
import {
  SLIDE_ALTURA,
  SLIDE_LARGURA,
  type BlocoFluxo,
  type ElementoSlide,
  type MapaPaisagem,
  type Slide,
} from '@/domain';
import { useSetoresStore } from '@/features/setores/store';
import { uid } from '@/utils/uid';
import { blocoDesatualizado, desenharBloco } from '../fluxoPapel';
import { elementoTexto, htmlTitulo } from '../gerar';
import { escolherImagem } from '../imagem';
import { htmlDetalhe, lerRef, type CatalogoMencoes } from '../mencoes';
import { planoPorId } from '../planos';
import { useMapasStore } from '../store';
import type { AlvoNoFluxo } from '../verNoFluxo';
import { BarraMapa } from './BarraMapa';
import { DialogoInserirFluxo } from './DialogoInserirFluxo';
import { ElementoSlideView, type Gesto } from './ElementoSlideView';
import { Miniatura } from './Miniatura';
import { useCartaoMencao } from './useCartaoMencao';
import { useMencoes } from './useMencoes';

/* ============================================================================
 * EDITOR DO MAPA EM PAISAGEM (decisoes.md#D-39)
 *
 * Slides A4 deitados, com peças soltas: texto, nota, imagem e desenho do
 * fluxo. As coordenadas são do slide (1122 × 793 px); a tela só escala. O
 * gesto de mover e redimensionar vai à store a cada passo — os slides têm
 * poucas peças, e a gravação já espera o fim da digitação.
 * ========================================================================== */

const MIN_W = 80;
const MIN_H = 36;

interface Props {
  mapa: MapaPaisagem;
  catalogo: CatalogoMencoes;
  somenteLeitura: boolean;
  onVerNoFluxo: (alvo: AlvoNoFluxo) => void;
}

function clonarSlide(s: Slide): Slide {
  return { id: uid('slide'), elementos: s.elementos.map((e) => ({ ...e, id: uid('el') })) };
}

export function EditorSlides({ mapa, catalogo, somenteLeitura, onVerNoFluxo }: Props) {
  const mudar = useMapasStore((s) => s.mudar);
  const setores = useSetoresStore((s) => s.setores);
  const [indice, setIndice] = useState(0);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [escala, setEscala] = useState(0.6);
  const [inserindoFluxo, setInserindoFluxo] = useState(false);
  const palcoRef = useRef<HTMLDivElement>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  const atual = Math.min(indice, mapa.slides.length - 1);
  const slide = mapa.slides[atual];

  useEffect(() => {
    setIndice(0);
    setSelecionado(null);
  }, [mapa.id]);

  useLayoutEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;
    const medir = () => {
      const r = palco.getBoundingClientRect();
      setEscala(Math.max(0.2, Math.min((r.width - 56) / SLIDE_LARGURA, (r.height - 56) / SLIDE_ALTURA)));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(palco);
    return () => obs.disconnect();
  }, []);

  const mudarSlides = useCallback(
    (fn: (slides: Slide[]) => Slide[]) => mudar((m) => (m.formato === 'paisagem' ? { ...m, slides: fn(m.slides) } : m)),
    [mudar],
  );
  const mudarElementos = useCallback(
    (fn: (els: ElementoSlide[]) => ElementoSlide[]) =>
      mudarSlides((slides) => slides.map((s, i) => (i === atual ? { ...s, elementos: fn(s.elementos) } : s))),
    [mudarSlides, atual],
  );
  const mudarElemento = useCallback(
    (id: string, fn: (e: ElementoSlide) => ElementoSlide) => mudarElementos((els) => els.map((e) => (e.id === id ? fn(e) : e))),
    [mudarElementos],
  );

  const adicionar = (e: ElementoSlide) => {
    mudarElementos((els) => [...els, e]);
    setSelecionado(e.id);
  };

  const excluirSelecionado = useCallback(() => {
    if (!selecionado) return;
    mudarElementos((els) => els.filter((e) => e.id !== selecionado));
    setSelecionado(null);
  }, [selecionado, mudarElementos]);

  // Delete apaga a peça selecionada — menos quando o cursor está num texto.
  useEffect(() => {
    if (somenteLeitura) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || !selecionado) return;
      const alvo = e.target as HTMLElement;
      if (alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA') return;
      e.preventDefault();
      excluirSelecionado();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [selecionado, excluirSelecionado, somenteLeitura]);

  const iniciarGesto = (ev: ReactPointerEvent, e: ElementoSlide, gesto: Gesto) => {
    ev.preventDefault();
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    const o = { x: e.x, y: e.y, w: e.w, h: e.h };
    const mover = (m: PointerEvent) => {
      const dx = (m.clientX - x0) / escala;
      const dy = (m.clientY - y0) / escala;
      mudarElemento(e.id, (el) =>
        gesto === 'mover'
          ? { ...el, x: Math.round(o.x + dx), y: Math.round(o.y + dy) }
          : { ...el, w: Math.round(Math.max(MIN_W, o.w + dx)), h: Math.round(Math.max(MIN_H, o.h + dy)) },
      );
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  const salvarTexto = useCallback(
    (editavel: HTMLElement) => {
      const id = editavel.closest('.el')?.getAttribute('data-id');
      if (id) mudarElemento(id, (e) => (e.tipo === 'texto' || e.tipo === 'nota' ? { ...e, html: editavel.innerHTML } : e));
    },
    [mudarElemento],
  );

  const { menu, iniciar } = useMencoes(raizRef, catalogo, salvarTexto);

  const cartao = useCartaoMencao(raizRef, catalogo, {
    podeEditar: !somenteLeitura,
    onVerNoFluxo,
    onInserirDetalhe: (chip) => {
      const ref = lerRef(chip);
      const dono = slide?.elementos.find((e) => e.id === chip.closest('.el')?.getAttribute('data-id'));
      if (!ref || !dono) return;
      const y = Math.min(dono.y + dono.h + 16, SLIDE_ALTURA - 200);
      adicionar(elementoTexto(dono.x, y, Math.max(dono.w, 420), 180, htmlDetalhe(ref, catalogo)));
    },
  });

  const desatualizado = useMemo(() => {
    const m = new Map<string, 'nao' | 'mudou' | 'sumiu'>();
    for (const e of slide?.elementos ?? []) {
      if (e.tipo !== 'fluxo') continue;
      const plano = planoPorId(e.fluxo.planoId);
      m.set(e.id, plano === null ? 'sumiu' : blocoDesatualizado(e.fluxo, plano) ? 'mudou' : 'nao');
    }
    return m;
    // O catálogo muda junto com os planos; serve de gatilho.
  }, [slide, catalogo]);

  const atualizarFluxo = (e: ElementoSlide) => {
    if (e.tipo !== 'fluxo') return;
    const plano = planoPorId(e.fluxo.planoId);
    if (!plano) return;
    const fluxo = desenharBloco(plano, e.fluxo.planoId, e.fluxo.nos, e.fluxo.fora, setores, new Date().toISOString());
    mudarElemento(e.id, (el) => (el.tipo === 'fluxo' ? { ...el, fluxo } : el));
  };

  const inserirImagem = async () => {
    try {
      const img = await escolherImagem();
      if (!img) return;
      const w = Math.min(460, img.largura);
      const h = Math.min(560, Math.round((w * img.altura) / Math.max(1, img.largura)));
      adicionar({ id: uid('el'), tipo: 'imagem', x: 300, y: 160, w, h, src: img.src });
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const novoSlide = () => {
    mudarSlides((slides) => [
      ...slides.slice(0, atual + 1),
      { id: uid('slide'), elementos: [elementoTexto(48, 36, 1026, 80, htmlTitulo('Título do slide'))] },
      ...slides.slice(atual + 1),
    ]);
    setIndice(atual + 1);
    setSelecionado(null);
  };

  const excluirSlide = (i: number) => {
    if (mapa.slides.length <= 1) return;
    if (!window.confirm(`Excluir o slide ${i + 1}?`)) return;
    mudarSlides((slides) => slides.filter((_, j) => j !== i));
    setIndice((k) => Math.max(0, k > i ? k - 1 : Math.min(k, mapa.slides.length - 2)));
    setSelecionado(null);
  };

  const mencionar = () => {
    const sel = selecionado && raizRef.current?.querySelector<HTMLElement>(`.el[data-id="${selecionado}"] [data-mencoes]`);
    if (sel) {
      iniciar(sel);
      return;
    }
    const e = elementoTexto(120, 120, 520, 100, '');
    adicionar(e);
    requestAnimationFrame(() => {
      const novo = raizRef.current?.querySelector<HTMLElement>(`.el[data-id="${e.id}"] [data-mencoes]`);
      if (novo) iniciar(novo);
    });
  };

  const ferramentas = (
    <>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => adicionar(elementoTexto(120, 120, 520, 120, 'Digite aqui. Use @ para mencionar.'))}>
        Texto
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => adicionar(elementoTexto(160, 160, 340, 150, 'Nota', 'nota'))}>
        Nota
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => void inserirImagem()}>
        Imagem
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setInserindoFluxo(true)}>
        Fluxo do plano
      </button>
      <span className="mapa-barra-sep" aria-hidden />
      <button type="button" className="btn btn-sm btn-ghost" onClick={novoSlide}>
        <Icon.Plus /> Slide
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => slide && mudarSlides((s) => [...s.slice(0, atual + 1), clonarSlide(slide), ...s.slice(atual + 1)])}>
        <Icon.Copy /> Duplicar
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-icon"
        onClick={excluirSelecionado}
        disabled={!selecionado}
        title="Excluir a peça selecionada (Delete)"
        aria-label="Excluir a peça selecionada"
      >
        <Icon.Trash />
      </button>
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0" ref={raizRef}>
      <BarraMapa mapa={mapa} catalogo={catalogo} somenteLeitura={somenteLeitura} ferramentas={ferramentas} onMencionar={mencionar} />
      <div
        className="mapa-palco"
        ref={palcoRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelecionado(null);
        }}
      >
        <div className="mapa-escala" style={{ width: SLIDE_LARGURA * escala, height: SLIDE_ALTURA * escala }}>
          {slide && (
            <div
              className={`slide papel${somenteLeitura ? '' : ' editavel'}`}
              style={{ transform: `scale(${escala})` }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelecionado(null);
              }}
            >
              {slide.elementos.map((e) => (
                <ElementoSlideView
                  key={e.id}
                  elemento={e}
                  selecionado={selecionado === e.id}
                  editavel={!somenteLeitura}
                  catalogo={catalogo}
                  desatualizado={desatualizado.get(e.id) ?? 'nao'}
                  onSelecionar={() => setSelecionado(e.id)}
                  onGesto={(ev, g) => iniciarGesto(ev, e, g)}
                  onTexto={(html) => mudarElemento(e.id, (el) => (el.tipo === 'texto' || el.tipo === 'nota' ? { ...el, html } : el))}
                  onAtualizarFluxo={() => atualizarFluxo(e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mapa-filme" role="list" aria-label="Slides">
        {mapa.slides.map((s, i) => (
          <Miniatura
            key={s.id}
            slide={s}
            numero={i + 1}
            ativa={i === atual}
            catalogo={catalogo}
            podeExcluir={!somenteLeitura && mapa.slides.length > 1}
            onAbrir={() => {
              setIndice(i);
              setSelecionado(null);
            }}
            onExcluir={() => excluirSlide(i)}
          />
        ))}
        {!somenteLeitura && (
          <button type="button" className="mapa-miniatura nova" onClick={novoSlide} aria-label="Novo slide">
            <Icon.Plus />
          </button>
        )}
      </div>
      {menu}
      {cartao}
      {inserindoFluxo && (
        <DialogoInserirFluxo
          onFechar={() => setInserindoFluxo(false)}
          onInserir={(fluxo: BlocoFluxo) => {
            setInserindoFluxo(false);
            adicionar({ id: uid('el'), tipo: 'fluxo', x: 60, y: 100, w: 1000, h: 640, fluxo });
          }}
        />
      )}
    </div>
  );
}
