import React, { useEffect, useState, useMemo } from 'react';
import {
  Users, Package, Wrench,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  TrendingUp, Wallet, Activity, Percent, Filter, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import Skeleton from '../../components/Skeleton';
import api from '../../services/api';
import styles from './Home.module.css';

const Home: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>({
    stats: { totalRevenue: 0, people: 0, activeOrders: 0, lowStock: 0, totalOrders: 0 },
    activities: [],
    financialPerformance: [],
    distribution: [],
    operationsKpi: { workedHours: 0, downtimeMinutes: 0, efficiencyPercent: 0, logsCount: 0 },
    efficiencyByCenter: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    personId: '',
    startDate: '',
    endDate: ''
  });
  const [people, setPeople] = useState<any[]>([]);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filters.personId) params.append('personId', filters.personId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const data = await api.get(`/dashboard/stats?${params.toString()}`);
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard stats', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    api.get('/people')
      .then((res: any) => setPeople((Array.isArray(res) ? res : res?.data) || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [filters]);

  const cards = useMemo(() => [
    { title: 'Faturamento Total', value: dashboardData.stats.totalRevenue || 0, icon: Wallet, color: '#10b981', trend: '+12.5%' },
    { title: 'Peças e Materiais', value: dashboardData.stats.totalMaterials || 0, icon: Package, color: '#3b82f6', trend: 'Insumos' },
    { title: 'Mão de Obra', value: dashboardData.stats.totalServices || 0, icon: Wrench, color: '#8b5cf6', trend: 'Mão de Obra' },
    { title: 'Lucro Estimado', value: dashboardData.stats.totalProfit || 0, icon: TrendingUp, color: '#f59e0b', trend: 'Margem Bruta' },
  ], [dashboardData]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.welcomeHeader}>
          <Skeleton width="400px" height="60px" />
          <Skeleton width="180px" height="40px" borderRadius="16px" />
        </div>
        <div className={styles.statsGrid}>
          {[1,2,3,4].map(i => <Skeleton key={i} height="180px" borderRadius="32px" />)}
        </div>
        <div className={styles.chartsGrid}>
           <Skeleton height="400px" borderRadius="32px" />
           <Skeleton height="400px" borderRadius="32px" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.welcomeHeader}>
        <div>
          <h1 className={styles.welcomeTitle}>Comando Operacional</h1>
          <p className={styles.welcomeSubtitle}>
            Visão estratégica e monitoramento de eficiência da ProMEC em tempo real.
          </p>
        </div>
        <button onClick={() => void fetchData()} className={styles.refreshBtn} disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'Atualizando...' : 'Sincronizar Dados'}
        </button>
      </header>

      {/* Barra de Filtros Inteligente */}
      <section className={styles.filterSection}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}><Filter size={12} /> Cliente</label>
          <select 
            className="formSelect"
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '12px 16px', color: '#fff', outline: 'none' }}
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
        <div className={styles.filterGroup} style={{ width: 180 }}>
          <label className={styles.filterLabel}>Início</label>
          <input 
            type="date" 
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '12px 16px', color: '#fff', outline: 'none' }}
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
          />
        </div>
        <div className={styles.filterGroup} style={{ width: 180 }}>
          <label className={styles.filterLabel}>Término</label>
          <input 
            type="date" 
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '12px 16px', color: '#fff', outline: 'none' }}
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
          />
        </div>
        <button 
          onClick={() => setFilters({ personId: '', startDate: '', endDate: '' })}
          style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: 'none', padding: '14px 24px', borderRadius: 16, fontWeight: 800, cursor: 'pointer' }}
        >
          Limpar
        </button>
      </section>

      {/* Cards de Métricas */}
      <section className={styles.statsGrid}>
        {cards.map((card, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.cardTrend} style={{ color: card.trend.includes('+') ? 'var(--success)' : 'var(--text-muted)' }}>
              {card.trend.includes('+') ? <ArrowUpRight size={14} /> : null}
              {card.trend}
            </div>
            <div className={styles.cardIconBox} style={{ background: `${card.color}15`, color: card.color }}>
              <card.icon size={32} />
            </div>
            <div className={styles.cardValue}>{formatCurrency(card.value)}</div>
            <div className={styles.cardLabel}>{card.title}</div>
          </div>
        ))}
      </section>

      {/* KPIs Rápidos */}
      <section className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 56 }}>
         <div className={styles.kpiCard}>
            <div className={styles.kpiValue} style={{ color: 'var(--primary)' }}>{dashboardData.stats.people}</div>
            <div className={styles.kpiLabel}>Base de Clientes</div>
         </div>
         <div className={styles.kpiCard}>
            <div className={styles.kpiValue} style={{ color: 'var(--warning)' }}>{dashboardData.stats.activeOrders}</div>
            <div className={styles.kpiLabel}>OS em Produção</div>
         </div>
         <div className={styles.kpiCard}>
            <div className={styles.kpiValue} style={{ color: 'var(--danger)' }}>{dashboardData.stats.lowStock}</div>
            <div className={styles.kpiLabel}>Alertas de Estoque</div>
         </div>
         <div className={styles.kpiCard}>
            <div className={styles.kpiValue} style={{ color: '#fff' }}>{dashboardData.stats.totalOrders}</div>
            <div className={styles.kpiLabel}>Histórico Total</div>
         </div>
      </section>

      {/* Visualização de Dados Principal */}
      <section className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}><TrendingUp size={24} color="var(--success)" /> Performance Financeira</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Últimos 7 dias de operação</div>
          </div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <AreaChart data={dashboardData.financialPerformance}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="costs" stroke="var(--danger)" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}><Activity size={24} color="var(--primary)" /> Mix de Receita</h3>
          </div>
          <div style={{ width: '100%', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={dashboardData.distribution}
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {(dashboardData.distribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][index % 4]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Monitoramento de Atividades e Eficiência */}
      <section className={styles.activitySection}>
        <div className={styles.chartCard}>
           <h3 className={styles.chartTitle} style={{ marginBottom: 32 }}><Clock size={24} color="var(--info)" /> Log de Atividades</h3>
           <div className={styles.activityList}>
              {(dashboardData.activities || []).map((act: any, i: number) => (
                <div key={i} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ 
                    background: act.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)', 
                    color: act.type === 'success' ? 'var(--success)' : 'var(--primary)' 
                  }}>
                    {act.type === 'success' ? <CheckCircle2 size={20} /> : <Wrench size={20} />}
                  </div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityTitle}>{act.title}</div>
                    <div className={styles.activityMeta}>{act.description} • {new Date(act.time).toLocaleTimeString('pt-BR')}</div>
                  </div>
                </div>
              ))}
              {dashboardData.activities.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aguardando novas atividades...</p>}
           </div>
        </div>

        <div className={styles.chartCard}>
           <h3 className={styles.chartTitle} style={{ marginBottom: 32 }}><Percent size={24} color="var(--accent)" /> Eficiência Global</h3>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 }}>
              <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: 64, fontWeight: 900, color: 'var(--accent)', fontFamily: 'Outfit' }}>
                   {Number(dashboardData.operationsKpi?.efficiencyPercent || 0).toFixed(1)}%
                 </div>
                 <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>Índice de Produtividade Global</div>
              </div>
              
              <div style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
                 <div style={{ 
                   height: '100%', 
                   width: `${dashboardData.operationsKpi?.efficiencyPercent || 0}%`, 
                   background: 'linear-gradient(to right, var(--accent), var(--primary))',
                   boxShadow: '0 0 20px var(--accent-glow)'
                 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                 <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Horas Produzidas</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardData.operationsKpi?.workedHours || 0}h</div>
                 </div>
                 <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Minutos de Parada</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>{dashboardData.operationsKpi?.downtimeMinutes || 0}m</div>
                 </div>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
