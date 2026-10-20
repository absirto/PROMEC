import { PrismaClient, StatusAgendamento } from '@prisma/client';
import { pd } from '../comum/decimal';
import { dataBanco, hojeLocal, segundaDa, somarDias } from '../planejamento/calendario';

const FERIADOS: [string, string][] = [
  ['2026-11-02', 'Finados'],
  ['2026-11-15', 'Proclamação da República'],
  ['2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
  ['2026-12-25', 'Natal']
];

/** Feriados, parada preventiva da Fresa na próxima semana e a agenda da semana no Box 3. */
export async function semearAgenda(db: PrismaClient, tenantId: string, id: (s: string) => string, r: { box3: string; jonas: string; fresa: string; cliente: string }) {
  for (const [data, descricao] of FERIADOS) {
    await db.feriado.upsert({
      where: { tenantId_data: { tenantId, data: dataBanco(data) } },
      create: { id: id(`feriado-${data}`), tenantId, data: dataBanco(data), descricao },
      update: { descricao }
    });
  }

  const segunda = segundaDa(hojeLocal());
  const parada = { centroId: r.fresa, inicio: dataBanco(somarDias(segunda, 8)), fim: dataBanco(somarDias(segunda, 9)), motivo: 'Manutenção preventiva: fuso de esferas e troca de óleo' };
  await db.paradaCentro.upsert({ where: { id: id('parada-fresa') }, create: { id: id('parada-fresa'), tenantId, ...parada }, update: parada });

  const agenda: [dia: number, hora: string, horas: string, status: StatusAgendamento, dados: { nomeCliente?: string; clienteId?: string; telefone: string; placa: string; veiculo: string; servico: string }][] = [
    [1, '08:30', '1.5', 'CONFIRMADO', { nomeCliente: 'Lucas Andrade', telefone: '47991234567', placa: 'ABC1D23', veiculo: 'Honda CG 160 2022', servico: 'Revisão dos 10.000 km e troca da relação' }],
    [2, '09:00', '3', 'MARCADO', { nomeCliente: 'Fernanda Rocha', telefone: '47988776655', placa: 'BRA2E19', veiculo: 'Fiat Toro 2021', servico: 'Troca de pastilhas e discos dianteiros' }],
    [3, '13:30', '2', 'MARCADO', { clienteId: r.cliente, telefone: '4733330000', placa: 'QHT4F56', veiculo: 'VW Saveiro 2019', servico: 'Diagnóstico de ruído na suspensão' }],
    [4, '08:00', '4', 'CONFIRMADO', { nomeCliente: 'Rogério Schmitt', telefone: '47999001122', placa: 'RLM7A31', veiculo: 'Chevrolet Onix 2020', servico: 'Troca do kit de embreagem' }]
  ];
  const ids: string[] = [];
  for (const [i, [dia, hora, horas, status, d]] of agenda.entries()) {
    const aid = id(`agenda-${i + 1}`);
    const dados = {
      nomeCliente: d.nomeCliente ?? null,
      clienteId: d.clienteId ?? null,
      telefone: d.telefone,
      placa: d.placa,
      veiculo: d.veiculo,
      servico: d.servico,
      centroId: r.box3,
      colaboradorId: r.jonas,
      inicio: new Date(`${somarDias(segunda, dia)}T${hora}:00-03:00`),
      duracaoHoras: pd(horas),
      status,
      osId: null
    };
    await db.agendamento.upsert({ where: { id: aid }, create: { id: aid, tenantId, ...dados }, update: dados });
    ids.push(aid);
  }
  return ids;
}
