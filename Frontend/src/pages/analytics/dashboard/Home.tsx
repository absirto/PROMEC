import React, { useEffect, useState, useMemo } from 'react';
import {
  Users, Package, Wrench,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  TrendingUp, Wallet, Activity, Percent, Filter, RefreshCw,
  LayoutDashboard, Zap, ShieldCheck
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import Skeleton from '../../../components/Skeleton';
import api from '../../../services/api';
import StatsCard from '../../../components/StatsCard';
import styles from './Home.module.css';

const Home: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>({
    stats: { totalRevenue: 0, people: 0, activeOrders: 0, lowStock: 0, totalOrders: 0 },
    activities: [],
    financialPerformance: [],
    distribution: [],
    operationsKpi: { workedHours: 0, downtimeMinutes: 0, efficiencyPercent: 0, logsCount: 0 },
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ personId: '', startDate: '', endDate: '' });
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

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
          <div className={styles.badgeLabel}>
            <Zap size={14} /> Sistema Operacional Ativo
          </div>
          <h1 className={styles.welcomeTitle}>Central de Comando</h1>
          <p className={styles.welcomeSubtitle}>
            Monitoramento estratégico e inteligência operacional em tempo real.
          </p>
        </div>
        <button onClick={() => void fetchData()} className={styles.refreshBtn} disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
          <span>{refreshing ? 'Sincronizando...' : 'Atualizar Dados'}</span>
        </button>
      </header>

      {/* Bento Grid Stats */}
      <section className={styles.statsGrid}>
        <StatsCard 
          title="Receita Consolidada" 
          value={formatCurrency(dashboardData.stats.totalRevenue || 0)} 
          icon={Wallet} 
          trend={{ value: '+12.5%', isPositive: true }}
          color="var(--success)"
        />
        <StatsCard 
          title="Ordens Ativas" 
          value={dashboardData.stats.activeOrders || 0} 
          icon={Wrench} 
          color="var(--primary)"
        />
        <StatsCard 
          title="Base de Clientes" 
          value={dashboardData.stats.people || 0} 
          icon={Users} 
          color="#a855f7"
        />
        <StatsCard 
          title="Alertas de Estoque" 
          value={dashboardData.stats.lowStock || 0} 
          icon={Package} 
          trend={{ value: 'Crítico', isPositive: false }}
          color="var(--danger)"
        />
      </section>

      {/* Main Insights Grid */}
      <section className={styles.bentoGrid}>
        {/* Gráfico Financeiro */}
        <div className={`${styles.bentoItem} ${styles.large}`}>
          <div className={styles.bentoHeader}>
            <div>
              <h3 className={styles.bentoTitle}>Performance Financeira</h3>
              <p className={styles.bentoSubtitle}>Fluxo de receita dos últimos períodos</p>
            </div>
            <div className={styles.bentoAction}>
              <TrendingUp size={20} color="var(--primary)" />
            </div>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.financialPerformance}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Eficiência Global */}
        <div className={styles.bentoItem}>
          <div className={styles.bentoHeader}>
            <h3 className={styles.bentoTitle}>Eficiência Operacional</h3>
          </div>
          <div className={styles.efficiencyCircle}>
            <div className={styles.efficiencyValue}>
              {Number(dashboardData.operationsKpi?.efficiencyPercent || 0).toFixed(1)}%
            </div>
            <div className={styles.efficiencyLabel}>Produtividade</div>
          </div>
          <div className={styles.efficiencyBar}>
            <div 
              className={styles.efficiencyFill} 
              style={{ width: `${dashboardData.operationsKpi?.efficiencyPercent || 0}%` }} 
            />
          </div>
        </div>

        {/* Atividades Recentes */}
        <div className={`${styles.bentoItem} ${styles.medium}`}>
          <div className={styles.bentoHeader}>
            <h3 className={styles.bentoTitle}>Fluxo de Atividades</h3>
          </div>
          <div className={styles.activityList}>
            {(dashboardData.activities || []).slice(0, 5).map((act: any, i: number) => (
              <div key={i} className={styles.activityItem}>
                <div className={styles.activityDot} style={{ background: act.type === 'success' ? 'var(--success)' : 'var(--primary)' }} />
                <div className={styles.activityContent}>
                  <p className={styles.activityText}>{act.title}</p>
                  <span className={styles.activityTime}>{new Date(act.time).toLocaleTimeString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mix de Receita */}
        <div className={styles.bentoItem}>
          <div className={styles.bentoHeader}>
            <h3 className={styles.bentoTitle}>Distribuição</h3>
          </div>
          <div className={styles.chartContainerMini}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={dashboardData.distribution}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(dashboardData.distribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#2DD4BF', '#3b82f6', '#a855f7', '#f43f5e'][index % 4]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
