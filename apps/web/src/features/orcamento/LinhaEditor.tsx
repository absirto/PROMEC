import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { LinhaApi } from '../../lib/types';
import { brl, hhmm, toNum } from '../../lib/format';
import { DecimalInput, Select } from '../../components/Field';
import { IconButton } from '../../components/Button';

export type LinhaForm = LinhaApi & { _id: string };
type Valor = string | number | undefined;

function Mini({ label, children, className = '', dica }: { label: string; children: ReactNode; className?: string; dica?: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {dica && <span className="mono text-[11px] text-ink-3 text-right -mt-0.5">{dica}</span>}
    </label>
  );
}

function Num({ label, value, onChange, prefixo, sufixo, percentual, className = 'flex-[1_1_110px]', dica, disabled }: { label: string; value: Valor; onChange: (v: string) => void; prefixo?: string; sufixo?: string; percentual?: boolean; className?: string; dica?: ReactNode; disabled?: boolean }) {
  return (
    <Mini label={label} className={className} dica={dica}>
      <span className="campo !min-h-[40px] !px-3 !rounded-control">
        {prefixo && <span className="un">{prefixo}</span>}
        <DecimalInput value={value ?? ''} onChange={onChange} percentual={percentual} className="text-right !h-9" disabled={disabled} />
        {(sufixo || percentual) && <span className="un">{sufixo ?? '%'}</span>}
      </span>
    </Mini>
  );
}

function Base({ value, onChange, disabled }: { value: 'peca' | 'lote' | undefined; onChange: (v: 'peca' | 'lote') => void; disabled?: boolean }) {
  return (
    <Mini label="Conta" className="flex-[0_0_auto]">
      <span role="radiogroup" aria-label="Cobrança por peça ou por lote" className="flex p-1 rounded-full bg-surface-3 gap-0.5 h-10">
        {(['peca', 'lote'] as const).map((b) => (
          <button key={b} type="button" role="radio" aria-checked={value === b} disabled={disabled} onClick={() => onChange(b)} className={`px-3 rounded-full text-[13px] font-medium ${value === b ? 'bg-ink-1 text-surface-1' : 'text-ink-2'}`}>
            {b === 'peca' ? 'por peça' : 'por lote'}
          </button>
        ))}
      </span>
    </Mini>
  );
}

export interface OpcaoCentro { valor: string; rotulo: string; cheioHora?: string }

export function LinhaEditor({ linha, onChange, onRemover, custoLote, centros, editavel }: { linha: LinhaForm; onChange: (l: LinhaForm) => void; onRemover: () => void; custoLote?: string; centros: OpcaoCentro[]; editavel: boolean }) {
  const l = linha as LinhaForm & Record<string, Valor>;
  const set = (k: string, v: unknown) => onChange({ ...linha, [k]: v } as LinhaForm);
  const d = !editavel;
  const centro = 'centroId' in linha ? centros.find((c) => c.valor === linha.centroId) : undefined;

  const campos = (() => {
    switch (linha.tipo) {
      case 'material':
        return (
          <>
            <Base value={linha.base ?? 'peca'} onChange={(v) => set('base', v)} disabled={d} />
            <Num label="Quantidade" value={l.quantidade} onChange={(v) => set('quantidade', v)} disabled={d} />
            <Num label="Custo unitário" prefixo="R$" value={l.custoUnitario} onChange={(v) => set('custoUnitario', v)} disabled={d} />
          </>
        );
      case 'materialCorte':
        return (
          <>
            <Num label="Comprimento" sufixo="mm" value={l.comprimentoMm} onChange={(v) => set('comprimentoMm', v)} disabled={d} />
            <Num label="Sobra de corte" sufixo="mm" value={l.sobraMm} onChange={(v) => set('sobraMm', v)} disabled={d} />
            <Num label="Peso por metro" sufixo="kg/m" value={l.pesoPorMetroKg} onChange={(v) => set('pesoPorMetroKg', v)} disabled={d} />
            <Num label="Preço do kg" prefixo="R$" value={l.precoKg} onChange={(v) => set('precoKg', v)} disabled={d} />
          </>
        );
      case 'ferramental':
        return <Num label="Custo" prefixo="R$" value={l.custo} onChange={(v) => set('custo', v)} disabled={d} />;
      case 'operacao':
      case 'maoDeObra':
        return (
          <>
            <Mini label={linha.tipo === 'operacao' ? 'Máquina' : 'Centro'} className="flex-[2_1_220px]">
              <Select value={linha.centroId ?? ''} onChange={(v) => set('centroId', v)} opcoes={centros} vazio="Escolha o centro" disabled={d} className="!min-h-[40px] !rounded-control" invalido={!linha.centroId} />
            </Mini>
            {linha.tipo === 'operacao' ? (
              <>
                <Num label="Ciclo por peça" sufixo="h" value={l.cicloHorasPorPeca} onChange={(v) => set('cicloHorasPorPeca', v)} dica={hhmm(l.cicloHorasPorPeca)} disabled={d} />
                <Num label="Setup por lote" sufixo="h" value={l.setupHorasPorLote} onChange={(v) => set('setupHorasPorLote', v)} dica={hhmm(l.setupHorasPorLote)} disabled={d} />
              </>
            ) : (
              <>
                <Base value={linha.base ?? 'lote'} onChange={(v) => set('base', v)} disabled={d} />
                <Num label="Tempo padrão" sufixo="h" value={l.tempoPadraoHoras} onChange={(v) => set('tempoPadraoHoras', v)} dica={hhmm(l.tempoPadraoHoras)} disabled={d} />
                <Num label="Dificuldade" sufixo="×" value={l.fatorDificuldade} onChange={(v) => set('fatorDificuldade', v)} disabled={d} />
              </>
            )}
            <Mini label="R$/h" className="flex-[0_0_96px]">
              <span className="mono h-10 flex items-center justify-end font-semibold text-primary-text" title="Custo-hora cheio da Tabela de Custos">
                {centro?.cheioHora ? brl(centro.cheioHora).replace('R$ ', '') : l.custoHora ? brl(l.custoHora).replace('R$ ', '') : '—'}
              </span>
            </Mini>
          </>
        );
      case 'terceiro':
        return (
          <>
            <Base value={linha.base ?? 'lote'} onChange={(v) => set('base', v)} disabled={d} />
            <Num label="Custo" prefixo="R$" value={l.custo} onChange={(v) => set('custo', v)} disabled={d} />
            <Num label="Acréscimo" percentual value={l.markup} onChange={(v) => set('markup', v)} disabled={d} />
          </>
        );
      case 'frete':
        return (
          <>
            <Num label="Valor fechado" prefixo="R$" value={l.valor} onChange={(v) => set('valor', v)} disabled={d} />
            <Num label="ou distância" sufixo="km" value={l.km} onChange={(v) => set('km', v)} disabled={d || toNum(l.valor) > 0} />
            <Num label="R$ por km" prefixo="R$" value={l.valorKm} onChange={(v) => set('valorKm', v)} disabled={d || toNum(l.valor) > 0} />
          </>
        );
    }
  })();

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-4 py-3 border-t border-border">
      <Mini label="Descrição" className="flex-[3_1_220px]">
        <span className="campo !min-h-[40px] !px-3 !rounded-control">
          <input value={linha.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} disabled={d} className="!h-9" placeholder={PLACEHOLDER[linha.tipo]} />
        </span>
      </Mini>
      {campos}
      <Mini label="No lote" className="flex-[0_0_112px]">
        <span className="mono h-10 flex items-center justify-end font-semibold text-[14.5px]">{brl(custoLote ?? 0)}</span>
      </Mini>
      {editavel && <IconButton icone={Trash2} rotulo={`Remover ${linha.descricao || 'linha'}`} onClick={onRemover} className="size-10 hover:text-bad" />}
    </div>
  );
}

const PLACEHOLDER: Record<LinhaApi['tipo'], string> = {
  material: 'Barra de latão C360 Ø25',
  materialCorte: 'Barra redonda SAE 1045 Ø50',
  ferramental: 'Alargador H7 Ø20',
  operacao: 'Tornear completo + furo H7',
  maoDeObra: 'Montagem e ajuste na bancada',
  terceiro: 'Tratamento térmico',
  frete: 'Entrega em Blumenau'
};

let seq = 0;
export const novaLinha = (tipo: LinhaApi['tipo']): LinhaForm => {
  const _id = `n${++seq}`;
  switch (tipo) {
    case 'material': return { _id, tipo, descricao: '', base: 'peca', quantidade: '1', custoUnitario: '' };
    case 'materialCorte': return { _id, tipo, descricao: '', comprimentoMm: '', sobraMm: '3', pesoPorMetroKg: '', precoKg: '' };
    case 'ferramental': return { _id, tipo, descricao: '', custo: '' };
    case 'operacao': return { _id, tipo, descricao: '', centroId: '', cicloHorasPorPeca: '', setupHorasPorLote: '' };
    case 'maoDeObra': return { _id, tipo, descricao: '', centroId: '', base: 'lote', tempoPadraoHoras: '', fatorDificuldade: '1' };
    case 'terceiro': return { _id, tipo, descricao: '', base: 'lote', custo: '', markup: '' };
    case 'frete': return { _id, tipo, descricao: '', valor: '' };
  }
};
export const comId = (l: LinhaApi): LinhaForm => ({ ...l, _id: `s${++seq}` }) as LinhaForm;
