import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save, ShieldCheck, ShieldPlus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { data, pct, toNum } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Aviso } from '../../components/EmptyState';
import { Pill } from '../../components/Pill';
import {
  ESTADO_CELULA, SITUACAO_HAB, TIPO_AUSENCIA, TIPOS_AUSENCIA, duracaoDias, erroRh, estadoCelula, hojeISO, somarDias,
  type Ausencia, type CelulaMatriz, type EstadoCelula, type Habilitacao, type MesProdutividade, type SituacaoHab, type TipoAusencia
} from './rh';
import { INVALIDA_RH } from './queries';

type Opcao = { id: string; nome: string };

/** Mutação do RH: erro fica dentro do formulário (não em toast), sucesso vira toast. */
function useMutacaoRh<V>(fn: (v: V) => Promise<unknown>, sucesso: string, onOk: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      INVALIDA_RH.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast(sucesso, 'ok');
      onOk();
    }
  });
}

export function ErroForm({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const e = erroRh(erro);
  return <Aviso tom="bad" titulo={e.titulo}>{e.texto}</Aviso>;
}

/* ---------- Ausências ---------- */

export function LegendaAusencias({ className = '' }: { className?: string }) {
  return (
    <ul className={`m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-ink-2 ${className}`} aria-label="Legenda dos tipos de ausência">
      {TIPOS_AUSENCIA.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${TIPO_AUSENCIA[t].ponto}`} aria-hidden />
          {TIPO_AUSENCIA[t].rotulo}
        </li>
      ))}
    </ul>
  );
}

export function TipoAusenciaPill({ tipo }: { tipo: TipoAusencia }) {
  const t = TIPO_AUSENCIA[tipo];
  return (
    <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-caption font-semibold whitespace-nowrap bg-surface-3 text-ink-1">
      <span className={`size-2 rounded-full ${t?.ponto ?? 'bg-neutral'}`} aria-hidden />
      {t?.rotulo ?? tipo}
    </span>
  );
}

export interface AusenciaInicial { colaboradorId?: string; inicio?: string; fim?: string; tipo?: TipoAusencia }

/** Criar, editar ou remover uma ausência. Sobreposição (409) aparece dentro do formulário. */
export function AusenciaModal({ ausencia, inicial, colaboradores, onFechar }: { ausencia?: Ausencia | null; inicial?: AusenciaInicial; colaboradores: Opcao[]; onFechar: () => void }) {
  const hoje = hojeISO();
  const [f, setF] = useState({
    colaboradorId: ausencia?.colaboradorId ?? inicial?.colaboradorId ?? '',
    tipo: ausencia?.tipo ?? inicial?.tipo ?? ('FERIAS' as TipoAusencia),
    inicio: ausencia?.inicio ?? inicial?.inicio ?? hoje,
    fim: ausencia?.fim ?? inicial?.fim ?? inicial?.inicio ?? hoje,
    observacao: ausencia?.observacao ?? ''
  });
  const [tentou, setTentou] = useState(false);
  const [remover, setRemover] = useState(false);
  const nome = colaboradores.find((c) => c.id === f.colaboradorId)?.nome ?? ausencia?.colaborador?.nome ?? '';
  const salvar = useMutacaoRh(
    () =>
      ausencia
        ? api(`/rh/ausencias/${ausencia.id}`, { method: 'PATCH', body: { tipo: f.tipo, inicio: f.inicio, fim: f.fim, observacao: f.observacao.trim() } })
        : api('/rh/ausencias', { method: 'POST', body: { colaboradorId: f.colaboradorId, tipo: f.tipo, inicio: f.inicio, fim: f.fim, ...(f.observacao.trim() ? { observacao: f.observacao.trim() } : {}) } }),
    ausencia ? 'Ausência atualizada. A capacidade dos centros já considera as novas datas.' : `Ausência registrada. ${nome.split(' ')[0] || 'A pessoa'} sai da escala nesses dias.`,
    onFechar
  );
  const del = useMutacaoRh(() => api(`/rh/ausencias/${ausencia!.id}`, { method: 'DELETE' }), 'Ausência removida. Os dias voltam para a capacidade.', onFechar);

  const erroColab = tentou && !f.colaboradorId ? 'Escolha quem vai ficar fora.' : null;
  const erroDatas = !f.inicio || !f.fim ? 'Informe o início e o fim.' : f.fim < f.inicio ? 'O fim precisa ser no mesmo dia ou depois do início.' : null;
  const enviar = () => {
    setTentou(true);
    if (!f.colaboradorId || erroDatas) return;
    salvar.mutate(undefined);
  };
  const dias = !erroDatas ? duracaoDias(f) : 0;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={ausencia ? 'Editar ausência' : 'Nova ausência'}
      rodape={
        remover ? (
          <>
            <span className="mr-auto self-center text-[14px] text-ink-2">Remover essa ausência?</span>
            <Button onClick={() => setRemover(false)}>Manter</Button>
            <Button variante="perigo" icone={Trash2} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Remover</Button>
          </>
        ) : (
          <>
            {ausencia && <Button variante="terciario" icone={Trash2} className="mr-auto text-bad" onClick={() => setRemover(true)}>Remover</Button>}
            <Button onClick={onFechar}>Cancelar</Button>
            <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>{ausencia ? 'Salvar' : 'Registrar'}</Button>
          </>
        )
      }
    >
      <form className="flex flex-col gap-3" noValidate onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        {ausencia ? (
          <p className="m-0 text-[14px] text-ink-2">Ausência de <strong className="text-ink-1">{ausencia.colaborador?.nome ?? nome}</strong></p>
        ) : (
          <SelectField label="Quem" required value={f.colaboradorId} onChange={(v) => setF({ ...f, colaboradorId: v })} vazio="Escolha o colaborador" opcoes={colaboradores.map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={erroColab} />
        )}
        <SelectField label="Tipo" value={f.tipo} onChange={(v) => setF({ ...f, tipo: v as TipoAusencia })} opcoes={TIPOS_AUSENCIA.map((t) => ({ valor: t, rotulo: TIPO_AUSENCIA[t].rotulo }))} />
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
          <TextField label="Início" type="date" required value={f.inicio} onChange={(v) => setF({ ...f, inicio: v, fim: f.fim < v ? v : f.fim })} />
          <TextField label="Fim" type="date" required value={f.fim} min={f.inicio} onChange={(v) => setF({ ...f, fim: v })} erro={tentou ? erroDatas : null} hint={dias ? `${dias} ${dias === 1 ? 'dia' : 'dias'} corridos` : undefined} />
        </div>
        <TextArea label="Observação" value={f.observacao} onChange={(v) => setF({ ...f, observacao: v })} rows={2} hint="Opcional. Ex.: curso de NR-12 no SENAI." />
        <p className="m-0 text-caption text-ink-3">Nos dias úteis fora, os centros onde a pessoa trabalha perdem capacidade, e a agenda e o apontamento recusam a escala.</p>
        <ErroForm erro={salvar.error ?? del.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ---------- Habilitações ---------- */

export function SituacaoHabPill({ situacao }: { situacao: SituacaoHab }) {
  const s = SITUACAO_HAB[situacao] ?? { rotulo: situacao, tom: 'neutral' as const };
  return <Pill tom={s.tom} icone={ShieldCheck}>{s.rotulo}</Pill>;
}

export function EstadoCelulaPill({ estado }: { estado: EstadoCelula }) {
  const e = ESTADO_CELULA[estado];
  return <Pill tom={e.tom} titulo={e.dica}>{e.rotulo}</Pill>;
}

export function LegendaMatriz() {
  const estados: EstadoCelula[] = ['ok', 'vencendo', 'vencida', 'sem_habilitacao', 'nenhum'];
  return (
    <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-ink-2" aria-label="Legenda da matriz">
      {estados.map((e) => (
        <li key={e} className="inline-flex items-center gap-1.5">
          <span className={`size-3.5 rounded-[5px] border ${ESTADO_CELULA[e].classe}`} aria-hidden />
          {ESTADO_CELULA[e].rotulo}
          {e === 'sem_habilitacao' && <span className="text-ink-3">(alocado)</span>}
        </li>
      ))}
    </ul>
  );
}

const umAno = (d: string) => somarDias(d, 365);

/** Cadastrar ou renovar (PATCH de emissão/validade) uma habilitação. */
export function HabilitacaoModal({
  habilitacao, renovar, colaboradorId, centroId, colaboradores, centros, onFechar
}: {
  habilitacao?: Habilitacao | null;
  renovar?: boolean;
  colaboradorId?: string;
  centroId?: string;
  colaboradores: Opcao[];
  centros: Opcao[];
  onFechar: () => void;
}) {
  const hoje = hojeISO();
  const [f, setF] = useState({
    colaboradorId: habilitacao?.colaboradorId ?? colaboradorId ?? '',
    centroId: habilitacao?.centroId ?? centroId ?? '',
    descricao: habilitacao?.descricao ?? '',
    emissao: renovar ? hoje : habilitacao?.emissao ?? hoje,
    validade: renovar ? umAno(hoje) : habilitacao?.validade ?? umAno(hoje),
    documento: habilitacao?.documento ?? ''
  });
  const [tentou, setTentou] = useState(false);
  const [remover, setRemover] = useState(false);
  const editando = !!habilitacao;
  const salvar = useMutacaoRh(
    () =>
      editando
        ? api(`/rh/habilitacoes/${habilitacao!.id}`, { method: 'PATCH', body: { descricao: f.descricao.trim(), emissao: f.emissao, validade: f.validade, ...(f.documento.trim() ? { documento: f.documento.trim() } : {}) } })
        : api('/rh/habilitacoes', { method: 'POST', body: { colaboradorId: f.colaboradorId, centroId: f.centroId, descricao: f.descricao.trim(), emissao: f.emissao, validade: f.validade, ...(f.documento.trim() ? { documento: f.documento.trim() } : {}) } }),
    renovar ? `Habilitação renovada até ${data(f.validade)}.` : editando ? 'Habilitação atualizada.' : 'Habilitação cadastrada. A pessoa já pode ser alocada e escalada nesse centro.',
    onFechar
  );
  const del = useMutacaoRh(() => api(`/rh/habilitacoes/${habilitacao!.id}`, { method: 'DELETE' }), 'Habilitação removida.', onFechar);
  const erros = {
    colaboradorId: !f.colaboradorId ? 'Escolha o colaborador.' : null,
    centroId: !f.centroId ? 'Escolha o centro de trabalho.' : null,
    descricao: !f.descricao.trim() ? 'Dê um nome, como "Certificação NR-12".' : null,
    validade: !f.emissao || !f.validade ? 'Informe emissão e validade.' : f.validade < f.emissao ? 'A validade precisa ser depois da emissão.' : null
  };
  const enviar = () => {
    setTentou(true);
    if (Object.values(erros).some(Boolean)) return;
    salvar.mutate(undefined);
  };
  const e = (k: keyof typeof erros) => (tentou ? erros[k] : null);
  const nomeColab = colaboradores.find((c) => c.id === f.colaboradorId)?.nome ?? habilitacao?.colaborador?.nome;
  const nomeCentro = centros.find((c) => c.id === f.centroId)?.nome ?? habilitacao?.centroNome;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={renovar ? 'Renovar habilitação' : editando ? 'Editar habilitação' : 'Nova habilitação'}
      rodape={
        remover ? (
          <>
            <span className="mr-auto self-center text-[14px] text-ink-2">Remover essa habilitação?</span>
            <Button onClick={() => setRemover(false)}>Manter</Button>
            <Button variante="perigo" icone={Trash2} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Remover</Button>
          </>
        ) : (
          <>
            {editando && !renovar && <Button variante="terciario" icone={Trash2} className="mr-auto text-bad" onClick={() => setRemover(true)}>Remover</Button>}
            <Button onClick={onFechar}>Cancelar</Button>
            <Button variante="primario" icone={renovar ? RefreshCw : Save} carregando={salvar.isPending} onClick={enviar}>{renovar ? 'Renovar' : editando ? 'Salvar' : 'Cadastrar'}</Button>
          </>
        )
      }
    >
      <form className="flex flex-col gap-3" noValidate onSubmit={(ev) => { ev.preventDefault(); enviar(); }}>
        {editando || (colaboradorId && centroId) ? (
          <p className="m-0 text-[14px] text-ink-2"><strong className="text-ink-1">{nomeColab}</strong> em <strong className="text-ink-1">{nomeCentro}</strong></p>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            {colaboradorId ? (
              <p className="m-0 self-end text-[14px] text-ink-2">Colaborador: <strong className="text-ink-1">{nomeColab}</strong></p>
            ) : (
              <SelectField label="Colaborador" required value={f.colaboradorId} onChange={(v) => setF({ ...f, colaboradorId: v })} vazio="Escolha" opcoes={colaboradores.map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={e('colaboradorId')} />
            )}
            <SelectField label="Centro de trabalho" required value={f.centroId} onChange={(v) => setF({ ...f, centroId: v })} vazio="Escolha" opcoes={centros.map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={e('centroId')} />
          </div>
        )}
        <TextField label="Habilitação" required value={f.descricao} onChange={(v) => setF({ ...f, descricao: v })} placeholder="Certificação de solda MIG" erro={e('descricao')} />
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
          <TextField label="Emissão" type="date" required value={f.emissao} onChange={(v) => setF({ ...f, emissao: v })} />
          <TextField label="Validade" type="date" required value={f.validade} min={f.emissao} onChange={(v) => setF({ ...f, validade: v })} erro={e('validade')} />
        </div>
        <TextField label="Documento" value={f.documento} onChange={(v) => setF({ ...f, documento: v })} placeholder="Nº do certificado ou link" hint="Opcional." />
        {renovar && habilitacao && <p className="m-0 text-caption text-ink-3">A validade anterior era {data(habilitacao.validade)}. Ao renovar, a pessoa volta a poder ser escalada.</p>}
        <ErroForm erro={salvar.error ?? del.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Detalhe da célula da matriz: habilitações do par e ações de adicionar/renovar. */
export function CelulaModal({
  celula, colaborador, centro, habilitacoes, carregando, podeGerir, onFechar, onNova, onRenovar, onEditar
}: {
  celula: CelulaMatriz | null;
  colaborador: Opcao;
  centro: Opcao;
  habilitacoes: Habilitacao[];
  carregando?: boolean;
  podeGerir: boolean;
  onFechar: () => void;
  onNova: () => void;
  onRenovar: (h: Habilitacao) => void;
  onEditar: (h: Habilitacao) => void;
}) {
  const { estado, alocado } = estadoCelula(celula);
  return (
    <Modal aberto onFechar={onFechar} titulo={`${colaborador.nome.split(' ')[0]} no ${centro.nome}`} rodape={<><Button onClick={onFechar}>Fechar</Button>{podeGerir && <Button variante="primario" icone={ShieldPlus} onClick={onNova}>Adicionar habilitação</Button>}</>}>
      <div className="flex flex-wrap items-center gap-2">
        <EstadoCelulaPill estado={estado} />
        <Pill tom={alocado ? 'steel' : 'neutral'}>{alocado ? `Alocado ${pct(celula?.alocacao, 0)}` : 'Não alocado'}</Pill>
      </div>
      {estado === 'sem_habilitacao' && <Aviso tom="bad" titulo="Alocado sem habilitação">{colaborador.nome.split(' ')[0]} está alocado aqui, mas não tem habilitação cadastrada. A agenda e o apontamento vão recusar a escala.</Aviso>}
      {estado === 'vencida' && alocado && <Aviso tom="bad" titulo="Habilitação vencida">Renove para a pessoa voltar a ser escalada nesse centro.</Aviso>}
      {carregando ? (
        <p className="m-0 text-ink-2">Carregando habilitações…</p>
      ) : habilitacoes.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-2">Nenhuma habilitação para esse centro ainda.</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {habilitacoes.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-[14px] bg-surface-2">
              <span className="flex-[1_1_180px] min-w-0 flex flex-col">
                <span className="font-medium break-words">{h.descricao}</span>
                <span className="text-caption text-ink-3">emitida <span className="mono">{data(h.emissao)}</span> · vale até <span className="mono">{data(h.validade)}</span></span>
              </span>
              <SituacaoHabPill situacao={h.situacao} />
              {podeGerir && (
                <span className="flex gap-1">
                  <Button tamanho="sm" variante="terciario" onClick={() => onEditar(h)}>Editar</Button>
                  <Button tamanho="sm" icone={RefreshCw} onClick={() => onRenovar(h)}>Renovar</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------- Gráficos pequenos ---------- */

/** Barrinhas da produtividade por mês, com linha da eficiência da tabela. */
export function BarrasMeses({ meses, eficiencia, rotulo }: { meses: MesProdutividade[]; eficiencia?: string | number; rotulo: string }) {
  const teto = Math.max(1, ...meses.map((m) => toNum(m.produtividade)), toNum(eficiencia));
  const ALT = 40;
  const ef = eficiencia !== undefined ? toNum(eficiencia) : null;
  return (
    <div className="relative flex items-end gap-1 h-10 flex-none" role="img" aria-label={`${rotulo}: ${meses.map((m) => `${m.competencia.slice(5)}/${m.competencia.slice(2, 4)} ${pct(m.produtividade, 0)}`).join(', ')}`}>
      {meses.map((m) => {
        const v = toNum(m.produtividade);
        const abaixo = ef !== null && v < ef;
        return <span key={m.competencia} title={`${m.competencia.slice(5)}/${m.competencia.slice(0, 4)}: ${pct(v, 0)}`} className={`w-3 rounded-t-[3px] ${abaixo ? 'bg-warn' : 'bg-chart-real'}`} style={{ height: Math.max(2, (v / teto) * ALT) }} />;
      })}
      {ef !== null && <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: (ef / teto) * ALT }} aria-hidden />}
    </div>
  );
}

