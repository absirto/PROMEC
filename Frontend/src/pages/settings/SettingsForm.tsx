import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Building2, Mail, Phone, Globe,
  Palette, Save, ArrowLeft, Camera, MapPin, Search
} from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { maskCNPJ, maskPhone, maskCEP } from '../../utils/masks';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';

interface SettingsFormData {
  companyName: string;
  cnpj: string;
  contactEmail: string;
  phone: string;
  address: string;
  systemTheme: string;
  logoUrl: string;
}

const SettingsForm: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SettingsFormData>({
    defaultValues: {
      companyName: '',
      cnpj: '',
      contactEmail: '',
      phone: '',
      address: '',
      systemTheme: 'dark',
      logoUrl: ''
    }
  });

  const cnpjValue = watch('cnpj');

  useEffect(() => {
    setFetching(true);
    api.get('/settings')
      .then((data: any) => {
        if (data) {
          const formatted = {
            companyName: data.companyName || '',
            cnpj: maskCNPJ(data.cnpj || ''),
            contactEmail: data.contactEmail || '',
            phone: maskPhone(data.phone || ''),
            address: data.address || '',
            systemTheme: data.systemTheme || 'dark',
            logoUrl: data.logoUrl || ''
          };
          reset(formatted);
          if (data.logoUrl) setLogoPreview(data.logoUrl);
        }
      })
      .catch(() => showToast('Erro ao carregar configurações.', 'error'))
      .finally(() => setFetching(false));
  }, [reset, showToast]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setValue('logoUrl', base64, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCNPJLookup = async () => {
    const cleanCnpj = cnpjValue?.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      showToast('Digite um CNPJ completo para realizar a busca.', 'warning');
      return;
    }

    setLookupLoading(true);
    try {
      const data = await api.get(`/external/cnpj/${cleanCnpj}`);
      if (data.corporateName) setValue('companyName', data.corporateName, { shouldDirty: true });
      if (data.contact?.email) setValue('contactEmail', data.contact.email, { shouldDirty: true });
      if (data.contact?.phone) setValue('phone', maskPhone(data.contact.phone), { shouldDirty: true });
      if (data.address) {
        const addr = `${data.address.street}, ${data.address.number}${data.address.complement ? ` - ${data.address.complement}` : ''}, ${data.address.neighborhood}, ${data.address.city} - ${data.address.state}, CEP: ${maskCEP(data.address.zipCode)}`;
        setValue('address', addr, { shouldDirty: true });
      }
      showToast('Dados do CNPJ importados com sucesso!');
    } catch (err: any) {
      showToast('Não foi possível localizar os dados deste CNPJ.', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    setLoading(true);
    try {
      await api.put('/settings', data);
      showToast('Configurações salvas com sucesso!');
    } catch (err) {
      showToast('Erro ao salvar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.glassCard} style={{ maxWidth: 900 }}>
          <div className={styles.header}><Skeleton width="300px" height="35px" /></div>
          <div style={{ marginTop: 30 }}><Skeleton height="160px" borderRadius="24px" /></div>
          <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height="50px" borderRadius="10px" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard} style={{ maxWidth: 900 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Configurações do Sistema</h2>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Voltar ao Início
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Building2 size={18} /> Perfil da Empresa / Organização
          </div>

          <div className={styles.fullWidth} style={{ marginBottom: 32 }}>
             <label className={styles.label}>Logotipo da Empresa</label>
             <div 
               style={{ 
                 width: '100%', height: 160, borderRadius: 24, 
                 background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)',
                 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                 cursor: 'pointer', transition: 'all 0.3s', position: 'relative', overflow: 'hidden'
               }}
               onClick={() => document.getElementById('logoInput')?.click()}
             >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ height: '80%', objectFit: 'contain' }} />
                ) : (
                  <>
                    <Camera size={32} color="#8a99a8" style={{ marginBottom: 12 }} />
                    <span style={{ color: '#8a99a8', fontWeight: 600 }}>Clique ou arraste o logo aqui</span>
                    <span style={{ color: '#5c6b7a', fontSize: 12, marginTop: 4 }}>PNG, JPG ou SVG (Max. 2MB)</span>
                  </>
                )}
                <input id="logoInput" type="file" hidden accept="image/*" onChange={handleLogoChange} />
             </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nome da Empresa</label>
            <div className={`${styles.inputWrapper} ${errors.companyName ? styles.inputError : ''}`}>
              <Building2 className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                {...register('companyName', { required: 'Obrigatório' })}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>CNPJ</label>
            <div className={styles.inputWrapper}>
              <Globe className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                {...register('cnpj', { 
                  onChange: (e) => setValue('cnpj', maskCNPJ(e.target.value))
                })}
                placeholder="00.000.000/0000-00"
              />
              <button 
                type="button" 
                className={styles.lookupBtn}
                style={{ 
                  position: 'absolute', right: 8, top: 8, bottom: 8,
                  padding: '0 12px', background: 'rgba(0, 230, 176, 0.1)', color: '#00e6b0',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s'
                }}
                onClick={handleCNPJLookup}
                disabled={lookupLoading}
              >
                {lookupLoading ? '...' : <><Search size={14} /> Buscar</>}
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail de Contato</label>
            <div className={`${styles.inputWrapper} ${errors.contactEmail ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                type="email"
                {...register('contactEmail')}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Telefone Comercial</label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                {...register('phone', {
                  onChange: (e) => setValue('phone', maskPhone(e.target.value))
                })}
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Endereço Completo</label>
            <div className={styles.inputWrapper}>
              <MapPin className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                {...register('address')}
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Palette size={18} /> Preferências e Aparência
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tema Padrão</label>
            <div className={styles.inputWrapper}>
              <Palette className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect}
                {...register('systemTheme')}
              >
                <option value="dark">Dark Mode (Padrão)</option>
                <option value="light">Light Mode</option>
              </select>
            </div>
          </div>

          <div className={styles.fullWidth} style={{ marginTop: 20 }}>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsForm;
