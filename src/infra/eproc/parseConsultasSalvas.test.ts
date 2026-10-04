import { describe, expect, it } from 'vitest';
import { montarConsultasSalvas, parseConsultasJson, parseConsultasXml } from './parseConsultasSalvas';

/*
 * Fixtures sintéticas: mesma forma das respostas levantadas no eproc1g/TJMG em
 * 03/10/2026 (somente leitura), com nomes inventados. Os nomes reais de
 * consultas podem trazer nome de servidor, e não entram no repositório.
 */

// O autocompletar escapa as entidades duas vezes (ver parsePreferencias.ts).
const XML = `<?xml version="1.0" encoding="iso-8859-1"?>
<itens>
  <item id="1001|x|y" descricao="&amp;#128309; Conclusos para sentença" complemento="S;N;N;N;N"/>
  <item id="1002|x|y" descricao="Aguardando prazo  — cível" complemento="N;N;N;N;N"/>
  <item id="1003" descricao="   " complemento="N;N;N;N;N"/>
</itens>`;

const JSON_RG = JSON.stringify([
  { Descricao: 'Sem movimentação 30 dias', IdFormularioPersonalizacao: '77', IdUsuarioPrefUsr: '9', SinPreferenciaIndividual: 'S' },
  { Descricao: 'Execuções fiscais', IdFormularioPersonalizacao: '78', IdUsuarioPrefUsr: '9', SinPreferenciaIndividual: 'N' },
  { Descricao: '', IdFormularioPersonalizacao: '79' },
]);

describe('consultas salvas', () => {
  it('XML do autocompletar: nome limpo, id estável, sem itens vazios', () => {
    expect(parseConsultasXml(XML, 'processosPorLocalizador')).toEqual([
      { tela: 'processosPorLocalizador', nome: '🔵 Conclusos para sentença', eprocId: '1001' },
      { tela: 'processosPorLocalizador', nome: 'Aguardando prazo — cível', eprocId: '1002' },
    ]);
  });

  it('JSON do Relatório Geral: individual ou compartilhada', () => {
    expect(parseConsultasJson(JSON_RG, 'relatorioGeral')).toEqual([
      { tela: 'relatorioGeral', nome: 'Sem movimentação 30 dias', eprocId: '77', individual: true },
      { tela: 'relatorioGeral', nome: 'Execuções fiscais', eprocId: '78', individual: false },
    ]);
  });

  it('JSON inválido ou fora do formato vira lista vazia', () => {
    expect(parseConsultasJson('<html>erro</html>', 'relatorioGeral')).toEqual([]);
    expect(parseConsultasJson('{"geral":{"geral0":"Erro"}}', 'relatorioGeral')).toEqual([]);
  });

  it('monta as quatro telas pelo rótulo, decide o formato pelo conteúdo e deduplica por tela', () => {
    const r = montarConsultasSalvas(
      [XML, JSON_RG, XML, XML],
      ['processosPorLocalizador', 'relatorioGeral', 'areaMinutas', 'processosPorLocalizador'],
    );
    expect(r.map((c) => `${c.tela}:${c.nome}`)).toEqual([
      'processosPorLocalizador:🔵 Conclusos para sentença',
      'processosPorLocalizador:Aguardando prazo — cível',
      'relatorioGeral:Sem movimentação 30 dias',
      'relatorioGeral:Execuções fiscais',
      'areaMinutas:🔵 Conclusos para sentença',
      'areaMinutas:Aguardando prazo — cível',
    ]);
  });

  it('fragmento sem tela reconhecida é ignorado', () => {
    expect(montarConsultasSalvas([XML], ['outraCoisa'])).toEqual([]);
  });
});
