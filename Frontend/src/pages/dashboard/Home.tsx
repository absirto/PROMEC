import React, { useEffect, useState, useRef } from 'react';
import {
  Users, Package, Wrench,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  TrendingUp, Wallet, Activity, Percent
} from 'lucide-react';
import api from '../../services/api';
import styles from './Home.module.css';

declare global {
  interface Window {
    ApexCharts: any;
  }
}

const Home: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const [dashboardData, setDashboardData] = useState<any>({
    stats: { totalRevenue: 0, people: 0, activeOrders: 0, lowStock: 0, totalOrders: 0 },
    activities: [],
    financialPerformance: [],
    distribution: []
  });

  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    personId: '',
    startDate: '',
    endDate: ''
  });
  const [people, setPeople] = useState<any[]>([]);

  useEffect(() => {
    // Carregar lista de clientes para o filtro
    api.get('/people').then(setPeople).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.personId) params.append('personId', filters.personId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    api.get(`/dashboard/stats?${params.toString()}`)
      .then((data: any) => {
        setDashboardData(data);
        if (window.ApexCharts) {
          initCharts(data.financialPerformance, data.distribution);
        }
      })
      .catch((err: any) => console.error('Error loading dashboard stats', err))
      .finally(() => setLoading(false));
  };

  const initCharts = (financialPerformance: any[], distribution: any[]) => {
    const options = {
      series: [{
        name: 'Recebimentos',
        data: financialPerformance.map(d => d.revenue)
      }, {
        name: 'Custos Estimados',
        data: financialPerformance.map(d => d.costs)
      }],
      chart: {
        height: 350,
        type: 'area',
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'Inter, sans-serif',
        locales: [{
          "name": "pt-br",
          "options": {
            "months": ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
            "shortMonths": ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
            "days": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
            "shortDays": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
            "toolbar": {
              "exportToSVG": "Baixar SVG",
              "exportToPNG": "Baixar PNG",
              "menu": "Menu",
              "selection": "Seleção",
              "selectionZoom": "Zoom de Seleção",
              "zoomIn": "Aumentar Zoom",
              "zoomOut": "Diminuir Zoom",
              "pan": "Pan",
              "reset": "Resetar Zoom"
            }
          }
        }],
        defaultLocale: "pt-br"
      },
      theme: { mode: 'dark' },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [20, 100]
        }
      },
      colors: ['#10b981', '#ef4444'],
      xaxis: {
        categories: financialPerformance.map(d => d.name),
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
      tooltip: {
        y: {
          formatter: (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        }
      }
    };

    if (chartRef.current) {
      new window.ApexCharts(chartRef.current, options).render();
    }

    const pieOptions = {
      series: distribution.map(d => d.value),
      chart: {
        width: '100%',
        type: 'donut',
      },
      labels: distribution.map(d => d.label),
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
      legend: { position: 'bottom', fontSize: '14px' },
      theme: { mode: 'dark' },
      stroke: { show: false },
      plotOptions: {
        pie: {
          donut: { size: '75%', background: 'transparent' }
        }
      }
    };

    if (pieRef.current) {
      new window.ApexCharts(pieRef.current, pieOptions).render();
    }
  };

  const cards = [
    { title: 'Faturamento Total', value: `R$ ${(dashboardData.stats.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Wallet, color: '#10b981', trend: '+12.5%' },
    { title: 'Peças e Materiais', value: `R$ ${(dashboardData.stats.totalMaterials || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Package, color: '#3b82f6', trend: 'Receita' },
    { title: 'Mão de Obra', value: `R$ ${(dashboardData.stats.totalServices || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Wrench, color: '#8b5cf6', trend: 'Receita' },
    { title: 'Lucro Líquido Est.', value: `R$ ${(dashboardData.stats.totalProfit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: '#f59e0b', trend: 'Margem' },
    { title: 'Impostos Totais', value: `R$ ${(dashboardData.stats.totalTaxes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Percent, color: '#ef4444', trend: 'Encargos' },
  ];

  if (loading) {
    return <div className={styles.dashboardContainer}>Carregando painel de controle...</div>;
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.welcomeHeader} style={{ marginBottom: 20 }}>
        <div>
          <h1 className={styles.welcomeTitle}>Inteligência Operacional</h1>
          <p className={styles.welcomeSubtitle}>Visão em tempo real da performance de sua oficina.</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
           <div className={styles.dateBadge}>
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      {/* BARRA DE FILTROS */}
      <section style={{ 
        background: 'rgba(255,255,255,0.03)', 
        padding: '20px 30px', 
        borderRadius: 24, 
        marginBottom: 40,
        display: 'flex',
        gap: 24,
        alignItems: 'flex-end',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 8, display: 'block' }}>Filtrar por Cliente</label>
          <select 
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 15px', color: '#fff', outline: 'none' }}
            value={filters.personId}
            onChange={e => setFilters({...filters, personId: e.target.value})}
          >
            <option value="">Todos os Clientes</option>
            {people.map(p => (
              <option key={p.id} value={p.id.toString()}>
                {p.naturalPerson?.name || p.legalPerson?.corporateName || `Cliente #${p.id}`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 180 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 8, display: 'block' }}>Data Inicial</label>
          <input 
            type="date" 
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 15px', color: '#fff', outline: 'none' }}
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
          />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 8, display: 'block' }}>Data Final</label>
          <input 
            type="date" 
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 15px', color: '#fff', outline: 'none' }}
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
          />
        </div>
        <button 
          onClick={() => setFilters({ personId: '', startDate: '', endDate: '' })}
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '11px 20px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Limpar
        </button>
      </section>

      <section className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {cards.map((card, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.cardTrend} style={{ color: card.trend.includes('+') ? '#10b981' : card.trend.includes('-') ? '#ef4444' : '#94a3b8' }}>
              {card.trend.includes('+') ? <ArrowUpRight size={14} /> : card.trend.includes('-') ? <ArrowDownRight size={14} /> : null}
              {card.trend}
            </div>
            <div className={styles.cardIconBox} style={{ background: `${card.color}15`, color: card.color }}>
              <card.icon size={28} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className={styles.cardValue} style={{ fontSize: card.value.length > 15 ? '1.2rem' : '1.5rem' }}>{card.value}</div>
              <div className={styles.cardLabel}>{card.title}</div>
            </div>
          </div>
        ))}
      </section>

      {/* KPIs Secundários */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
         <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{dashboardData.stats.people}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>Clientes Ativos</div>
         </div>
         <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{dashboardData.stats.activeOrders}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>OS em Aberto</div>
         </div>
         <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{dashboardData.stats.lowStock}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>Itens em Baixa</div>
         </div>
         <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{dashboardData.stats.totalOrders}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>Total de OS</div>
         </div>
      </section>

      <section className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>
            <TrendingUp size={22} color="#10b981" /> Performance Financeira (Últimos 7 Dias)
          </h3>
          <div ref={chartRef}></div>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>
            <Activity size={22} color="#3b82f6" /> Distribuição Operacional
          </h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div ref={pieRef}></div>
          </div>
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>
            <Clock size={22} color="#10b981" /> Atividades Recentes
          </h3>
          <div className={styles.activityList}>
            {(dashboardData.activities || []).length > 0 ? (
              dashboardData.activities.map((act: any, i: number) => (
                <div key={i} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ 
                    background: act.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                    color: act.type === 'success' ? '#10b981' : '#3b82f6' 
                  }}>
                    {act.type === 'success' ? <CheckCircle2 size={20} /> : <Wrench size={20} />}
                  </div>
                  <div>
                    <div className={styles.activityTitle}>{act.title}</div>
                    <div className={styles.activityMeta}>
                      {act.description} • {new Date(act.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#94a3b8' }}>Nenhuma atividade detectada nas últimas 24 horas.</p>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>
            <CheckCircle2 size={22} color="#10b981" /> Eficiência Operacional
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span style={{ color: '#94a3b8' }}>Conclusão de Ordens</span>
                <span style={{ color: '#10b981', fontWeight: 800 }}>
                  {dashboardData.stats.totalOrders > 0 
                   ? Math.round(((dashboardData.stats.totalOrders - dashboardData.stats.activeOrders) / dashboardData.stats.totalOrders) * 100) 
                   : 0}%
                </span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ 
                  width: `${dashboardData.stats.totalOrders > 0 ? ((dashboardData.stats.totalOrders - dashboardData.stats.activeOrders) / dashboardData.stats.totalOrders) * 100 : 0}%`, 
                  background: 'linear-gradient(to right, #10b981, #34d399)',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
                }} />
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span style={{ color: '#94a3b8' }}>Taxa de Retorno (Garantia)</span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>4.2%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ 
                  width: '4.2%', 
                  background: '#ef4444',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
                }} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
