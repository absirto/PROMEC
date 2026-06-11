import React, { useEffect, useState } from 'react';
import {
  Users, Package, Key,
  TrendingUp, Wallet, RefreshCw, Zap, Clock, Activity, AlertTriangle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import Skeleton from '../../../components/Skeleton';
import api from '../../../services/api';
import StatsCard from '../../../components/StatsCard';
import styles from './Home.module.css';

/* ==========================================================================
   DASHBOARD PAGE
   ========================================================================== */
const Home: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>({
    stats: { totalRevenue: 0, people: 0, activeOrders: 0, lowStock: 0, totalOrders: 0, totalProfit: 0 },
    activities: [],
    financialPerformance: [],
    distribution: [],
    operationsKpi: { workedHours: 0, downtimeMinutes: 0, efficiencyPercent: 0, logsCount: 0 },
    efficiencyByCenter: [],
    downtimeByCategory: {}
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const data = await api.get('/dashboard/stats');
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard stats', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loadingGrid}>
          <Skeleton height="80px" borderRadius="16px" />
          <Skeleton height="80px" borderRadius="16px" />
          <div className={styles.statsGrid}>
            {[1,2,3,4].map(i => <Skeleton key={i} height="180px" borderRadius="16px" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardGrid}>
        
        {/* ============ ROW 1: HEADERS ============ */}
        {/* Left Header (Dark) */}
        <div className={styles.leftHeader}>
          <div className={styles.badgeLabel}>
            <Zap size={14} /> Sistema Operacional Ativo
          </div>
          <h1 className={styles.welcomeTitle}>Central de Comando</h1>
          <p className={styles.welcomeSubtitle}>
            Monitoramento estratégico e inteligência operacional em tempo real.
          </p>
        </div>

        {/* Right Header (Light) */}
        <div className={styles.rightHeader}>
          <h2 className={styles.rightHeaderTitle}>DASHBOARD E DESEMPENHO</h2>
          <button onClick={() => void fetchData()} className={styles.refreshBtn} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            <span>Atualizar Dados</span>
          </button>
        </div>

        {/* ============ ROW 2: KPI CARDS ============ */}
        {/* Card 1: Receita Consolidada (Dark) */}
        <div className={styles.darkCardWrapper}>
          <StatsCard 
            title="Receita Consolidada" 
            value={formatCurrency(dashboardData.stats.totalRevenue || 0)} 
            icon={Wallet} 
            trend={{ 
              value: `Lucro Est: ${formatCurrency(dashboardData.stats.totalProfit || 0)}`, 
              isPositive: true 
            }}
            color="#00e6b0"
          />
        </div>

        {/* Card 2: Ordens Ativas (Dark) */}
        <div className={styles.darkCardWrapper}>
          <StatsCard 
            title="Ordens Ativas" 
            value={dashboardData.stats.activeOrders || 0} 
            icon={Key} 
            trend={{
              value: `Total: ${dashboardData.stats.totalOrders || 0} ordens`,
              isPositive: true
            }}
            color="#5865F2"
          />
        </div>

        {/* Card 3: Base de Clientes (Light) */}
        <div className={styles.lightCardWrapper}>
          <StatsCard 
            title="Base de Clientes" 
            value={dashboardData.stats.people || 0} 
            icon={Users} 
            color="#5865F2"
          />
        </div>

        {/* Card 4: Alertas de Estoque (Light) */}
        <div className={styles.lightCardWrapper}>
          <StatsCard 
            title="Alertas de Estoque" 
            value={dashboardData.stats.lowStock || 0} 
            icon={Package} 
            trend={{ value: 'Crítico', isPositive: false }}
            color="#FF5252"
          />
        </div>

        {/* ============ ROW 3: MAIN CHARTS & OPERATIONAL DATA ============ */}
        {/* Performance Financeira (Left/Dark, span 2) */}
        <div className={styles.glassChartCard}>
          <div className={styles.glassChartHeader}>
            <div>
              <h3 className={styles.glassChartTitle}>Performance Financeira</h3>
              <p className={styles.glassChartSubtitle}>Comparação de faturamento e custos (últimos 6 meses)</p>
            </div>
            <div className={styles.glassChartAction}>
              <TrendingUp size={20} color="#5865F2" />
            </div>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dashboardData.financialPerformance}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#7a8b9e', fontSize: 11, fontWeight: 500}} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#7a8b9e', fontSize: 11}} 
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  contentStyle={{ background: '#131822', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, paddingBottom: 10 }} />
                <Area type="monotone" name="Faturamento" dataKey="revenue" stroke="#5865F2" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" name="Custo Est." dataKey="costs" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorCosts)" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Eficiência por Centro de Trabalho (Right/Light, span 2) */}
        <div className={styles.lightEfficiencyCard}>
          <div className={styles.lightCardHeader}>
            <h3 className={styles.lightCardTitle}>Eficiência Operacional</h3>
            <p className={styles.lightCardSubtitle}>Visão geral da linha de produção</p>
          </div>
          <div className={styles.efficiencyDashboard}>
            <div className={styles.efficiencyOverview}>
              <div className={styles.efficiencyCircle}>
                <div className={styles.efficiencyValue}>
                  {Number(dashboardData.operationsKpi?.efficiencyPercent || 0).toFixed(1)}%
                </div>
                <div className={styles.efficiencyLabel}>Produtividade Global</div>
              </div>
              <div className={styles.efficiencyMetrics}>
                <div className={styles.efficiencyMetricItem}>
                  <Clock size={16} color="var(--primary)" />
                  <div>
                    <span className={styles.efficiencyMetricVal}>
                      {Number(dashboardData.operationsKpi?.workedHours || 0).toFixed(1)}h
                    </span>
                    <span className={styles.efficiencyMetricLab}>Trabalhadas</span>
                  </div>
                </div>
                <div className={styles.efficiencyMetricItem}>
                  <AlertTriangle size={16} color="#FF5252" />
                  <div>
                    <span className={styles.efficiencyMetricVal}>
                      {Number(dashboardData.operationsKpi?.downtimeMinutes || 0)}m
                    </span>
                    <span className={styles.efficiencyMetricLab}>Paradas</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.efficiencyDivider} />
            
            <div className={styles.centerEfficiencyList}>
              <h4 className={styles.centerListTitle}>Eficiência por Centro</h4>
              <div className={styles.centersScroll}>
                {(dashboardData.efficiencyByCenter || []).map((c: any, i: number) => (
                  <div key={i} className={styles.centerItem}>
                    <div className={styles.centerMeta}>
                      <span className={styles.centerName}>{c.workCenter}</span>
                      <span className={styles.centerValue}>{Number(c.efficiencyPercent || 0).toFixed(1)}%</span>
                    </div>
                    <div className={styles.centerProgressBar}>
                      <div 
                        className={styles.centerProgressFill} 
                        style={{ 
                          width: `${c.efficiencyPercent || 0}%`,
                          background: c.efficiencyPercent >= 80 ? '#10b981' : c.efficiencyPercent >= 50 ? '#5865F2' : '#FF5252'
                        }} 
                      />
                    </div>
                  </div>
                ))}
                {(!dashboardData.efficiencyByCenter || dashboardData.efficiencyByCenter.length === 0) && (
                  <p className={styles.emptyText}>Sem dados de produção.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============ ROW 4: BOTTOM DETAILED CARDS ============ */}
        {/* Fluxo de Atividades (Left/Dark, span 1) */}
        <div className={styles.darkBottomCard}>
          <div className={styles.glassChartHeader}>
            <h3 className={styles.glassChartTitle}>Fluxo de Atividades</h3>
            <p className={styles.glassChartSubtitle}>Últimas ocorrências no sistema</p>
          </div>
          <div className={styles.activityList}>
            {(dashboardData.activities || []).slice(0, 3).map((act: any, i: number) => (
              <div key={i} className={styles.activityItem}>
                <div className={styles.activityDot} style={{ background: act.type === 'success' ? '#00e6b0' : '#5865F2' }} />
                <div className={styles.activityContent}>
                  <p className={styles.activityText}>{act.title}</p>
                  <p className={styles.activityDesc}>{act.description}</p>
                  <span className={styles.activityTime}>
                    {new Date(act.time).toLocaleDateString('pt-BR')} às {new Date(act.time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            ))}
            {(dashboardData.activities || []).length === 0 && (
              <p className={styles.emptyText}>Nenhuma atividade recente.</p>
            )}
          </div>
        </div>

        {/* Paradas por Categoria - Downtime (Left/Dark, span 1) */}
        <div className={styles.darkBottomCard}>
          <div className={styles.glassChartHeader}>
            <h3 className={styles.glassChartTitle}>Tempo de Parada</h3>
            <p className={styles.glassChartSubtitle}>Minutos inativos por categoria</p>
          </div>
          <div className={styles.downtimeList}>
            {Object.entries(dashboardData.downtimeByCategory || {}).map(([category, minutes]: [string, any], idx: number) => {
              const totalDowntime = dashboardData.operationsKpi?.downtimeMinutes || 1;
              const percent = ((minutes / totalDowntime) * 100).toFixed(0);
              return (
                <div key={idx} className={styles.downtimeItem}>
                  <div className={styles.downtimeMeta}>
                    <span className={styles.downtimeLabel}>{category}</span>
                    <span className={styles.downtimeVal}>{minutes} min ({percent}%)</span>
                  </div>
                  <div className={styles.downtimeProgressBar}>
                    <div 
                      className={styles.downtimeProgressFill} 
                      style={{ 
                        width: `${Math.min(100, (minutes / totalDowntime) * 100)}%`,
                        background: '#FF5252'
                      }} 
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(dashboardData.downtimeByCategory || {}).length === 0 && (
              <p className={styles.emptyText}>Sem paradas de máquinas registradas.</p>
            )}
          </div>
        </div>

        {/* Distribuição por Status (Right/Light, span 2) */}
        <div className={styles.lightBottomCard}>
          <div className={styles.lightCardHeader}>
            <h3 className={styles.lightCardTitle}>Distribuição de Status</h3>
            <p className={styles.lightCardSubtitle}>Status das Ordens de Serviço cadastradas</p>
          </div>
          <div className={styles.distributionContainer}>
            <div className={styles.chartContainerMini} style={{ flex: '1 1 auto' }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={dashboardData.distribution}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(dashboardData.distribution || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#a855f7', '#5865F2', '#e28743', '#10b981', '#FF5252'][index % 5]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}
                    itemStyle={{ color: '#111827' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className={styles.distributionLegend}>
              {(dashboardData.distribution || []).map((entry: any, index: number) => {
                const colors = ['#a855f7', '#5865F2', '#e28743', '#10b981', '#FF5252'];
                const color = colors[index % colors.length];
                const totalVal = dashboardData.stats.totalOrders || 1;
                const percentage = ((entry.value / totalVal) * 100).toFixed(0);
                return (
                  <div key={index} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: color }} />
                    <span className={styles.legendLabel}>{entry.label}</span>
                    <span className={styles.legendValue}>
                      <strong>{entry.value}</strong> ({percentage}%)
                    </span>
                  </div>
                );
              })}
              {(dashboardData.distribution || []).length === 0 && (
                <p className={styles.emptyText}>Nenhuma OS registrada.</p>
              )}
            </div>
          </div>
        </div>

        <div className={styles.systemInfoFooterWrapper}>
          <div className={styles.systemInfoFooter}>
            Software de Gestão Operacional ProMEC<br />
            Todos os direitos reservados.<br />
            Versão 2.1.0 • Sistema Seguro
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
