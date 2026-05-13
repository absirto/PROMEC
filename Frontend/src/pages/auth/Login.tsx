import React, { useState } from 'react';
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

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

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
      <div className={styles['login-left']}>
        <div className={styles['login-left-content']}>
          <div className={styles['login-logo-row']}>
            <div className={styles['login-logo']}>
              <Wrench size={32} color="#00e6b0" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 32, color: '#fff', letterSpacing: -1 }}>ProMEC</div>
              <div style={{ fontSize: 13, color: '#00e6b0', fontWeight: 700, textTransform: 'uppercase' }}>Industrial ERP</div>
            </div>
          </div>
          
          <h1 className={styles['login-title']}>
            Gestão <span className={styles['highlight']}>Eficiente</span> <br />
            para sua Indústria
          </h1>
          
          <p className={styles['login-desc']}>
            Otimize sua produção, controle ordens de serviço e monitore seus indicadores em tempo real.
          </p>
          
          <ul className={styles['login-features']}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8a99a8', marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e6b0', boxShadow: '0 0 10px #00e6b0' }} /> 
              Fluxo de Produção Customizado
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8a99a8', marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e6b0', boxShadow: '0 0 10px #00e6b0' }} /> 
              Relatórios Financeiros Avançados
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8a99a8' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e6b0', boxShadow: '0 0 10px #00e6b0' }} /> 
              Controle de Qualidade Integrado
            </li>
          </ul>
        </div>
      </div>
      
      <div className={styles['login-right']}>
        <div className={styles['form-wrapper']}>
          <form className={styles['login-form']} onSubmit={handleSubmit(onSubmit)}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 0 8px 0', letterSpacing: -1 }}>Acesso</h2>
            <p style={{ color: '#8a99a8', marginBottom: 40, fontSize: 14 }}>Insira suas credenciais para entrar</p>
            
            <div className={styles['input-container']}>
              <label className={styles['input-label']}>E-mail</label>
              <div className={`${styles['input-field-wrapper']} ${errors.email ? styles['input-error'] : ''}`}>
                <Mail className={styles['input-icon']} size={20} />
                <input
                  type="email"
                  className={styles['input-field']}
                  placeholder="admin@promec.com"
                  {...register('email', { required: 'E-mail é obrigatório' })}
                />
              </div>
            </div>

            <div className={styles['input-container']}>
              <label className={styles['input-label']}>Senha</label>
              <div className={`${styles['input-field-wrapper']} ${errors.password ? styles['input-error'] : ''}`}>
                <Lock className={styles['input-icon']} size={20} />
                <input
                  type="password"
                  className={styles['input-field']}
                  placeholder="••••••••"
                  {...register('password', { required: 'Senha é obrigatória' })}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className={styles['submit-btn']}
              disabled={loading}
            >
              {loading ? 'Processando...' : <><LogIn size={20} /> Acessar Sistema</>}
            </button>
          </form>
          
          <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#5c6b7a', letterSpacing: 0.5, lineHeight: 1.6 }}>
            Software de Gestão Operacional ProMEC<br />
            Versão 1.0 • Sistema Seguro
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
