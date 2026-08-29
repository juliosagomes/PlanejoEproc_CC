/* ============================================================================
 * O ROTEIRO — só texto, sem JSX
 *
 * Os passos vivem separados das ilustrações (`ilustracoes/`) por um motivo
 * prático: aqui dá para testar "são 8, nenhum vazio, todo id tem desenho" sem
 * arrastar React nem DOM para o teste. Se este arquivo carregasse `ReactNode`,
 * viraria `.tsx` e o teste passaria a montar a árvore de componentes junto.
 *
 * O texto é escrito contra o comportamento REAL do editor. Cada `nota` abaixo
 * existe porque o app faz alguma coisa que surpreenderia quem seguisse o slide
 * ao pé da letra — não são curiosidades, são armadilhas verificadas no código.
 * ========================================================================== */

export interface Passo {
  /** 1..8, na ordem em que são apresentados. Também é a chave da ilustração. */
  id: number;
  titulo: string;
  paragrafos: readonly string[];
  /** Ressalva de comportamento, destacada abaixo do texto. */
  nota?: string;
  /** Marca a ficção do "ag. contestação" — vira um aviso no rodapé do slide. */
  ilustrativo?: boolean;
}

export const PASSOS: readonly Passo[] = [
  {
    id: 1,
    titulo: 'Comece trazendo os localizadores da sua vara',
    paragrafos: [
      'O botão "Sincronizar com a unidade", no cabeçalho, lê os localizadores, modelos e textos padrão direto do Eproc — na aba em que você já está logado. Ele só lê: nada é escrito no Eproc, nunca.',
      'Se preferir não depender do Eproc aberto, "Catálogo órgão" importa a mesma lista a partir do XLS exportado.',
    ],
    ilustrativo: true,
  },
  {
    id: 2,
    titulo: 'Crie o primeiro localizador',
    paragrafos: [
      'Com o catálogo sincronizado, o campo de nome sugere os localizadores que a sua unidade já tem. Digite parte do nome e escolha na lista.',
      'Escolher um do catálogo já marca o nó como "já existe no Eproc": a borda deixa de ser tracejada e ele ganha o sinal verde.',
    ],
    nota: 'Nome que não está no catálogo também vale — o campo aceita texto livre.',
    ilustrativo: true,
  },
  {
    id: 3,
    titulo: 'Adicione o próximo localizador',
    paragrafos: [
      'Dê dois cliques no canvas, no ponto onde o localizador deve aparecer. Arraste o nó para posicioná-lo — aqui, à direita de "ag. contestação".',
      'Enquanto o localizador ainda não existe no Eproc, ele fica com a borda tracejada. É assim que você vê, de relance, o que falta criar.',
    ],
  },
  {
    id: 4,
    titulo: 'Ligue um localizador ao outro',
    paragrafos: [
      'Arraste da alça direita de um nó até a alça esquerda do outro. A ligação representa a transição do processo entre as duas filas.',
      'Toda conexão nasce como Manual. O tipo — ATP, Preferência ou Manual — se escolhe no painel que abre à direita.',
    ],
  },
  {
    id: 5,
    titulo: 'Diga o que a transição faz, e como',
    paragrafos: [
      'No painel da direita, escreva o Resumo em uma frase: "Quando apresentada contestação".',
      'Depois escolha o tipo. Marcada como ATP, a ligação vira azul e animada — é a automatização de tramitação processual.',
    ],
    nota: 'Voltar o tipo para Manual apaga os recursos atrelados da transição.',
  },
  {
    id: 6,
    titulo: 'Liste o que precisa ser criado no Eproc',
    paragrafos: [
      'Em "Recursos atrelados", clique em Adicionar e nomeie o que a transição depende — aqui, o modelo "Vista para réplica".',
      'A categoria já vem como Modelo; troque para Texto padrão, Preferência ou Regra de ATP conforme o caso. Marque o ✓ conforme for criando cada um no Eproc.',
    ],
    nota: 'O bloco só aparece em transições ATP ou Preferência.',
  },
  {
    id: 7,
    titulo: 'Consulte sem abrir o painel',
    paragrafos: [
      'Passe o mouse por cima de uma ligação e o Resumo aparece num balão. Serve para ler o fluxo inteiro sem clicar em nada.',
    ],
    nota: 'O balão só aparece se o Resumo tiver sido preenchido.',
  },
  {
    id: 8,
    titulo: 'Gere o checklist e vá para o Eproc',
    paragrafos: [
      '"Gerar Checklist", no cabeçalho, transforma o desenho na lista do que criar — localizadores, modelos, textos padrão, regras — agrupada por categoria.',
      'Dá para imprimir ou copiar como texto, e as marcações voltam para o quadro. Pronto: é este o caminho inteiro.',
    ],
  },
] as const;

export const TOTAL_PASSOS = PASSOS.length;
