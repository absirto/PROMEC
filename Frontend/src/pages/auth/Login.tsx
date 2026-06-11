import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Mail, Lock, LogIn, Wrench } from 'lucide-react';
import api from '../../services/api';
import styles from './Login.module.css';
import { useToast } from '../../components/ToastProvider';

interface LoginFormData {
  email: string;
  password: string;
}

/* ==========================================================================
   NETWORK MESH — Canvas animado de fundo (nodos + conexões)
   ========================================================================== */
const NetworkCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Gerar nodos estáticos em posições determinísticas (seed = dimensões)
    const NODES = 90;
    const CONNECT_DIST = 160;
    const time = Date.now() * 0.0003;

    const nodes: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < NODES; i++) {
      const baseX = ((i * 137.508) % w);
      const baseY = ((i * 97.135) % h);
      const ox = Math.sin(time + i * 0.7) * 12;
      const oy = Math.cos(time + i * 0.5) * 12;
      nodes.push({ x: baseX + ox, y: baseY + oy, r: 1.5 + (i % 3) * 0.5 });
    }

    ctx.clearRect(0, 0, w, h);

    // Conexões
    ctx.lineWidth = 0.5;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.12;
          ctx.strokeStyle = `rgba(0, 230, 176, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Nodos
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 230, 176, 0.25)';
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return <canvas ref={canvasRef} className={styles.networkCanvas} />;
};

/* ==========================================================================
   LOGIN PAGE
   ========================================================================== */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      const { token, user } = response.data || response;
      localStorage.setItem('token', token);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      showToast('Login realizado com sucesso!');
      navigate('/');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err.message || 'Credenciais inválidas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['login-root']}>
      {/* Animated network mesh background */}
      <NetworkCanvas />
      <div className={styles.rightBgIllustration} />

      {/* ============ LADO ESQUERDO — BRANDING ============ */}
      <div className={styles['login-left']}>
        <div className={styles['login-left-content']}>
          <div className={styles['logo-container']}>
            <Wrench size={32} color="#00e6b0" />
          </div>
          <div className={styles['brand-name']}>ProMEC</div>
          <div className={styles['brand-sub']}>INDUSTRIAL ERP</div>

          <h1 className={styles['login-title']}>
            Gestão <span className={styles.highlight}>Eficiente</span><br />
            para sua Indústria
          </h1>

          <p className={styles['login-desc']}>
            Otimize sua produção, controle ordens de serviço e monitore
            seus indicadores em tempo real.
          </p>

          <ul className={styles['login-features']}>
            <li className={styles['feature-item']}>
              <div className={styles['feature-dot']} />
              Fluxo de Produção Customizado
            </li>
            <li className={styles['feature-item']}>
              <div className={styles['feature-dot']} />
              Relatórios Financeiros Avançados
            </li>
            <li className={styles['feature-item']}>
              <div className={styles['feature-dot']} />
              Controle de Qualidade Integrado
            </li>
          </ul>
        </div>
      </div>

      {/* ============ LADO DIREITO — FORM ============ */}
      <div className={styles['login-right']}>
        <div className={styles['form-wrapper']}>
          <form className={styles['login-form']} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles['form-heading']}>Acesso</h2>

            {/* E-mail */}
            <div className={styles['input-container']}>
              <label htmlFor="login-email" className={styles['input-label']}>E-MAIL</label>
              <div className={`${styles['input-field-wrapper']} ${errors.email ? styles['input-error'] : ''}`}>
                <Mail className={styles['input-icon']} size={18} />
                <input
                  id="login-email"
                  type="email"
                  className={styles['input-field']}
                  placeholder="admin@promec.com"
                  autoComplete="email"
                  {...register('email', { required: 'E-mail é obrigatório' })}
                />
              </div>
            </div>

            {/* Senha */}
            <div className={styles['input-container']}>
              <label htmlFor="login-password" className={styles['input-label']}>SENHA</label>
              <div className={`${styles['input-field-wrapper']} ${errors.password ? styles['input-error'] : ''}`}>
                <Lock className={styles['input-icon']} size={18} />
                <input
                  id="login-password"
                  type="password"
                  className={styles['input-field']}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password', { required: 'Senha é obrigatória' })}
                />
              </div>
              <div className={styles['password-extras']}>
                <button type="button" className={styles['forgot-link']} tabIndex={-1}>
                  Esqueceu sua senha?
                </button>
              </div>
            </div>

            {/* Mantenha-me conectado */}
            <div className={styles['remember-row']}>
              <input
                type="checkbox"
                id="remember-me"
                className={styles['remember-checkbox']}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className={styles['remember-label']}>
                Mantenha-me conectado
              </label>
            </div>

            {/* Botão principal */}
            <button
              type="submit"
              className={styles['submit-btn']}
              disabled={loading}
            >
              <span>
                {loading ? 'Processando...' : <><LogIn size={16} /> Acessar Sistema</>}
              </span>
            </button>

            <div className={styles['form-divider']} />

            <div className={styles['form-tagline']}>O ERP que sua Indústria Merece</div>
          </form>

          <div className={styles['login-footer']}>
            Software de Gestão Operacional ProMEC<br />
            Todos os direitos reservados.<br />
            Versão 2.1.0 • Sistema Seguro
          </div>
        </div>

        <div className={styles.footerSparkleIcon}>✦</div>
      </div>
    </div>
  );
};

export default Login;
