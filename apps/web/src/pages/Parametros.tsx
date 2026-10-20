import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAcao, useParametros } from '../lib/queries';
import { brl, pct, toNum } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { NumberField } from '../components/Field';
import { Button } from '../components/Button';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { useTitulo } from '../layout/titulo';
import { ENCARGOS_PADRAO, VINCULOS, fracaoParaPercentual, percentualParaFracao } from '../features/parametros/encargos';

const EXEMPLO = 5000;

/** Empresa e parâmetros: por enquanto, os encargos por vínculo usados no custo do colaborador. */
export default function Parametros() {
  useTitulo('Empresa e parâmetros');
  const { pode } = useAuth();
  const gerencia = pode('configuracoes.gerenciar');
  const q = useParametros();
  const qc = useQueryClient();
  const atuais = (q.data as { encargosPorVinculo?: Record<string, string> } | undefined)?.encargosPorVinculo;
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setF(Object.fromEntries(VINCULOS.map(([v]) => [v, fracaoParaPercentual(atuais?.[v] ?? ENCARGOS_PADRAO[v])])));
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidos = f ? VINCULOS.filter(([v]) => { const n = toNum(f[v]); return f[v] === '' || n < 0 || n > 100; }).map(([v]) => v) : [];
  const salvar = useAcao(
    () => api('/parametros', { method: 'PATCH', body: { encargosPorVinculo: Object.fromEntries(VINCULOS.map(([v]) => [v, percentualParaFracao(f![v]!)])) } }),
    {
      invalida: [['parametros'], ['colaboradores']],
      sucesso: 'Encargos salvos. Quem tem encargos em % passa a usar o novo valor no próximo cálculo.',
      onSuccess: () => { setErro(null); qc.invalidateQueries({ queryKey: ['parametros'] }); }
    }
  );
  const enviar = () => {
    if (invalidos.length) { setErro('Use valores entre 0% e 100%.'); return; }
    salvar.mutate(undefined, { onError: (e) => setErro(e instanceof ApiError && e.codigo === 'ENCARGOS_INVALIDOS' ? 'Os encargos precisam ficar entre 0% e 100% para cada vínculo.' : msgErro(e)) });
  };

  return (
    <div className="flex flex-col gap-5">
      <HeroBand ilustracao="engrenagens" sobretitulo="Configurações" titulo="Empresa e parâmetros" texto="As regras da casa que entram nos cálculos. Mexa com calma: elas mudam o custo de todo mundo." />
      {q.isLoading || !f ? (
        q.isError ? <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card> : <Card><Carregando linhas={4} /></Card>
      ) : (
        <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-encargos">
          <CardHeader id="h-encargos" titulo="Encargos por vínculo" sub="Percentual sobre o salário, usado quando o cadastro do funcionário não informa os encargos em reais." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {VINCULOS.map(([v, rotulo]) => (
              <NumberField
                key={v}
                label={rotulo}
                sufixo="%"
                value={f[v] ?? ''}
                onChange={(x) => setF({ ...f, [v]: x })}
                disabled={!gerencia}
                erro={invalidos.includes(v) ? 'Entre 0% e 100%.' : undefined}
                hint={invalidos.includes(v) ? undefined : `Salário de ${brl(EXEMPLO)} → ${brl(EXEMPLO * toNum(f[v]) / 100)} de encargos`}
              />
            ))}
          </div>
          <p className="m-0 text-[13.5px] text-ink-2">Padrão do ProMEC: CLT e horista {pct(ENCARGOS_PADRAO.CLT, 0)} (INSS, FGTS, férias e 13º provisionados); PJ e sócio sem encargos.</p>
          {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
          {gerencia ? (
            <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar} className="self-start">Salvar encargos</Button>
          ) : (
            <Aviso tom="info">Só quem gerencia as configurações pode mudar estes valores.</Aviso>
          )}
        </Card>
      )}
    </div>
  );
}
