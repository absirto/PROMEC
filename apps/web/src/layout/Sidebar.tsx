import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3, Building2, Calculator, CalendarClock, CalendarRange, ChevronDown, Cpu, Database, FileText, FlaskConical, Gauge, Hammer, Layers, LayoutDashboard,
  Package, PieChart, Receipt, Ruler, Settings2, ShoppingCart, Target, Timer, Users, Wallet, Wrench, X, type LucideIcon
} from 'lucide-react';
import { LogoProMEC } from '../components/Illustrations';

interface Item { rotulo: string; icone: LucideIcon; to?: string }
interface Grupo { titulo: string; itens: Item[] }

const GRUPOS: Grupo[] = [
  { titulo: 'Principal', itens: [{ rotulo: 'Painel', icone: LayoutDashboard, to: '/' }] },
  {
    titulo: 'Comercial',
    itens: [
      { rotulo: 'Orçamentos', icone: FileText, to: '/orcamentos' },
      { rotulo: 'Simulador rápido', icone: Calculator },
      { rotulo: 'Oportunidades', icone: Target },
      { rotulo: 'Clientes', icone: Building2, to: '/clientes' }
    ]
  },
  {
    titulo: 'Operação',
    itens: [
      { rotulo: 'Ordens de Serviço', icone: Wrench, to: '/ordens-servico' },
      { rotulo: 'Modo Operador', icone: Timer, to: '/operador' },
      { rotulo: 'Planejamento e Agenda', icone: CalendarRange, to: '/planejamento' },
      { rotulo: 'Agenda da oficina', icone: CalendarClock, to: '/agenda' },
      { rotulo: 'Qualidade', icone: Ruler }
    ]
  },
  {
    titulo: 'Custos',
    itens: [
      { rotulo: 'Tabela de Custos e versões', icone: Layers, to: '/tabelas-custos' },
      { rotulo: 'Custo fixo', icone: Receipt, to: '/custo-fixo' },
      { rotulo: 'Capacidade', icone: Gauge },
      { rotulo: 'Rateio', icone: PieChart },
      { rotulo: 'Simulador what-if', icone: FlaskConical }
    ]
  },
  { titulo: 'Suprimentos', itens: [{ rotulo: 'Estoque', icone: Package }, { rotulo: 'Compras', icone: ShoppingCart }] },
  {
    titulo: 'Financeiro',
    itens: [
      { rotulo: 'Contas a receber', icone: Wallet },
      { rotulo: 'Contas a pagar', icone: Wallet },
      { rotulo: 'Fluxo de caixa', icone: BarChart3 },
      { rotulo: 'Comissões', icone: Receipt },
      { rotulo: 'DRE gerencial', icone: BarChart3 }
    ]
  },
  {
    titulo: 'Ativos e Pessoas',
    itens: [
      { rotulo: 'Centros de trabalho', icone: Cpu, to: '/centros-trabalho' },
      { rotulo: 'Manutenção', icone: Hammer },
      { rotulo: 'Funcionários', icone: Users, to: '/colaboradores' }
    ]
  },
  {
    titulo: 'Cadastros',
    itens: [
      { rotulo: 'Fornecedores', icone: Building2 },
      { rotulo: 'Veículos e ativos do cliente', icone: Database },
      { rotulo: 'Itens', icone: Package },
      { rotulo: 'Catálogo de operações', icone: Wrench },
      { rotulo: 'Centros de custo', icone: Layers },
      { rotulo: 'Tabelas auxiliares', icone: Database }
    ]
  },
  { titulo: 'BI', itens: [{ rotulo: 'Painéis', icone: BarChart3 }] },
  { titulo: 'Configurações', itens: [{ rotulo: 'Empresa, usuários e parâmetros', icone: Settings2 }] }
];

const itemCls = 'flex items-center gap-3 h-10 px-3 rounded-[12px] text-[14px] transition duration-micro';

function EmBreve({ i }: { i: Item }) {
  const I = i.icone;
  return (
    <span className={`${itemCls} text-[#9FB5CB] cursor-not-allowed`} aria-disabled="true">
      <I className="size-[18px] flex-none" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 truncate">{i.rotulo}</span>
      <span className="text-[11px] rounded-full px-1.5 py-0.5 bg-white/10 text-[#C7D5E4]">em breve</span>
    </span>
  );
}

function GrupoNav({ g, onNavegar }: { g: Grupo; onNavegar?: () => void }) {
  const ativos = g.itens.some((i) => i.to);
  const [aberto, setAberto] = useState(false);
  if (!ativos) {
    return (
      <li>
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="w-full flex items-center justify-between px-3 h-8 text-[12.5px] font-semibold text-[#B8C9DA] hover:text-white rounded-md">
          <span>{g.titulo}</span>
          <span className="flex items-center gap-1 font-normal text-[11px]">
            em breve <ChevronDown className={`size-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </button>
        {aberto && (
          <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
            {g.itens.map((i) => <li key={i.rotulo}><EmBreve i={i} /></li>)}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-0.5">
      <span className="px-3 pt-2 pb-1 text-[12.5px] font-semibold text-[#B8C9DA]">{g.titulo}</span>
      <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
        {g.itens.map((i) =>
          i.to ? (
            <li key={i.rotulo}>
              <NavLink
                to={i.to}
                end={i.to === '/'}
                onClick={onNavegar}
                className={({ isActive }) =>
                  `${itemCls} no-underline ${isActive ? 'bg-white text-steel-3 font-semibold shadow-[0_4px_14px_rgba(0,0,0,.18)]' : 'text-[#E3ECF5] hover:bg-white/10'}`
                }
              >
                <i.icone className="size-[18px] flex-none" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{i.rotulo}</span>
              </NavLink>
            </li>
          ) : (
            <li key={i.rotulo}><EmBreve i={i} /></li>
          )
        )}
      </ul>
    </li>
  );
}

export function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  return (
    <>
      {aberta && <div className="lg:hidden fixed inset-0 z-30 bg-[rgba(20,16,10,.45)]" onClick={onFechar} aria-hidden />}
      <nav
        aria-label="Navegação principal"
        className={`glass-steel fixed z-40 top-3 bottom-3 left-3 w-[264px] rounded-[26px] flex flex-col transition-transform duration-panel ease-promec ${aberta ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]'} lg:translate-x-0`}
      >
        <div className="relative flex items-center gap-3 px-4 pt-4 pb-3">
          <LogoProMEC />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[22px] font-bold">ProMEC</span>
            <span className="text-[12px] text-[#B8C9DA]">custo real, preço justo</span>
          </span>
          <button type="button" onClick={onFechar} aria-label="Fechar menu" className="lg:hidden ml-auto size-10 grid place-items-center rounded-control hover:bg-white/10">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ul className="relative list-none m-0 px-2 pb-4 flex-1 overflow-y-auto flex flex-col gap-1 [scrollbar-width:thin]">
          {GRUPOS.map((g) => <GrupoNav key={g.titulo} g={g} onNavegar={onFechar} />)}
        </ul>
      </nav>
    </>
  );
}
