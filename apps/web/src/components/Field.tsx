import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { paraCampo, parseBR } from '../lib/format';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  className?: string;
  children: (p: { id: string; describedBy?: string; invalido: boolean }) => ReactNode;
}

export function Field({ label, hint, erro, obrigatorio, className = '', children }: FieldProps) {
  const id = useId();
  const dica = `${id}-dica`;
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <label htmlFor={id} className="text-[13.5px] font-medium text-ink-2">
        {label}
        {obrigatorio && <span className="text-bad" aria-hidden> *</span>}
      </label>
      {children({ id, describedBy: erro || hint ? dica : undefined, invalido: !!erro })}
      {(erro || hint) && (
        <span id={dica} className={`text-caption ${erro ? 'text-bad font-medium' : 'text-ink-3'}`} role={erro ? 'alert' : undefined}>
          {erro || hint}
        </span>
      )}
    </div>
  );
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  erro?: string | null;
  prefixo?: ReactNode;
  sufixo?: ReactNode;
  mono?: boolean;
};

export function TextField({ label, value, onChange, hint, erro, prefixo, sufixo, mono, className, required, ...rest }: TextProps) {
  return (
    <Field label={label} hint={hint} erro={erro} obrigatorio={required} className={className}>
      {({ id, describedBy, invalido }) => (
        <div className="campo" data-erro={invalido}>
          {prefixo && <span className="un">{prefixo}</span>}
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalido || undefined}
            aria-describedby={describedBy}
            required={required}
            className={mono ? 'mono' : ''}
            {...rest}
          />
          {sufixo && <span className="un">{sufixo}</span>}
        </div>
      )}
    </Field>
  );
}

/** Campo numérico em pt-BR que emite texto decimal ("1234.5"). Com `percentual`, mostra 0–100 e emite fração 0–1. */
export function DecimalInput({
  value,
  onChange,
  percentual,
  id,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string | number | null | undefined; onChange: (v: string) => void; percentual?: boolean }) {
  const exibir = (v: typeof value) => {
    if (v === null || v === undefined || v === '') return '';
    return percentual ? paraCampo(Number((Number(v) * 100).toFixed(6))) : paraCampo(v);
  };
  const [texto, setTexto] = useState(() => exibir(value));
  useEffect(() => {
    const atual = parseBR(texto);
    const emitido = atual === '' ? '' : percentual ? String(Number((Number(atual) / 100).toFixed(8))) : atual;
    const alvo = value === null || value === undefined ? '' : String(value);
    if (alvo === '' ? emitido !== '' : Number(alvo) !== Number(emitido)) setTexto(exibir(value));
  }, [value]);
  return (
    <input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      className={`mono ${className}`}
      value={texto}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.-]/g, '');
        setTexto(t);
        const d = parseBR(t);
        onChange(d === '' ? '' : percentual ? String(Number((Number(d) / 100).toFixed(8))) : d);
      }}
      {...rest}
    />
  );
}

type NumProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  prefixo?: ReactNode;
  sufixo?: ReactNode;
  percentual?: boolean;
  hint?: ReactNode;
  erro?: string | null;
  className?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export function NumberField({ label, value, onChange, prefixo, sufixo, percentual, hint, erro, className, required, placeholder, disabled }: NumProps) {
  return (
    <Field label={label} hint={hint} erro={erro} obrigatorio={required} className={className}>
      {({ id, describedBy, invalido }) => (
        <div className="campo" data-erro={invalido}>
          {prefixo && <span className="un">{prefixo}</span>}
          <DecimalInput
            id={id}
            value={value}
            onChange={onChange}
            percentual={percentual}
            aria-invalid={invalido || undefined}
            aria-describedby={describedBy}
            placeholder={placeholder}
            disabled={disabled}
            className="text-right"
          />
          {(sufixo || percentual) && <span className="un">{sufixo ?? '%'}</span>}
        </div>
      )}
    </Field>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: { valor: string; rotulo: string }[];
  hint?: ReactNode;
  erro?: string | null;
  vazio?: string;
};

export function SelectField({ label, value, onChange, opcoes, hint, erro, vazio, className, required, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} erro={erro} obrigatorio={required} className={className}>
      {({ id, describedBy, invalido }) => <Select id={id} value={value} onChange={onChange} opcoes={opcoes} vazio={vazio} aria-invalid={invalido || undefined} aria-describedby={describedBy} invalido={invalido} {...rest} />}
    </Field>
  );
}

export function Select({
  value,
  onChange,
  opcoes,
  vazio,
  invalido,
  className = '',
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { value: string; onChange: (v: string) => void; opcoes: { valor: string; rotulo: string }[]; vazio?: string; invalido?: boolean }) {
  return (
    <div className={`campo relative min-w-0 max-w-full ${className}`} data-erro={invalido}>
      <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <ChevronDown className="size-4 text-ink-3 pointer-events-none absolute right-3" aria-hidden />
    </div>
  );
}

export function TextArea({ label, value, onChange, hint, rows = 3, className }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; rows?: number; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <div className="campo">
          <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
        </div>
      )}
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  opcoes,
  ocultarRotulo,
  tamanho = 'md',
  disabled
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; rotulo: ReactNode; aria?: string }[];
  ocultarRotulo?: boolean;
  tamanho?: 'sm' | 'md';
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {!ocultarRotulo && <span className="text-[13.5px] font-medium text-ink-2">{label}</span>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const on = o.valor === value;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.aria}
              disabled={disabled}
              onClick={() => onChange(o.valor)}
              onKeyDown={(e) => {
                const i = opcoes.findIndex((x) => x.valor === value);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(opcoes[(i + 1) % opcoes.length]!.valor); }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(opcoes[(i - 1 + opcoes.length) % opcoes.length]!.valor); }
              }}
              tabIndex={on ? 0 : -1}
              className={`rounded-full border font-medium transition duration-micro ${tamanho === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm'} ${
                on ? 'bg-ink-1 text-surface-1 border-ink-1' : 'bg-surface-2 text-ink-2 border-border-strong hover:border-ink-3'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({ label, descricao, value, onChange }: { label: string; descricao?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3.5 p-3 rounded-field bg-surface-2 border border-border">
      <span className="flex-1 flex flex-col">
        <span className="font-medium">{label}</span>
        {descricao && <span className="text-caption text-ink-3">{descricao}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative w-[52px] h-8 rounded-full transition duration-micro ${value ? 'bg-ok' : 'bg-border-strong'}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all duration-micro ease-promec ${value ? 'left-[24px]' : 'left-1'}`} />
      </button>
    </div>
  );
}
