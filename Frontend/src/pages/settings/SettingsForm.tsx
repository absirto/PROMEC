import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Mail, Phone, Globe,
  Palette, Save, ArrowLeft, Camera, MapPin, Search
} from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { maskCNPJ, maskPhone, maskCEP } from '../../utils/masks';

const SettingsForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    contactEmail: '',
    phone: '',
    address: '',
    systemTheme: 'dark',
    logoUrl: ''
  });

  useEffect(() => {
    setFetching(true);
    api.get('/settings')
      .then((data: any) => {
        if (data) {
          setFormData({
            companyName: data.companyName || '',
            cnpj: maskCNPJ(data.cnpj || ''),
            contactEmail: data.contactEmail || '',
            phone: maskPhone(data.phone || ''),
            address: data.address || '',
            systemTheme: data.systemTheme || 'dark',
            logoUrl: data.logoUrl || ''
          });
          if (data.logoUrl) setLogoPreview(data.logoUrl);
        }
      })
      .catch(() => setError('Erro ao carregar configurações.'))
      .finally(() => setFetching(false));
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simulação de upload transformando em Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setFormData({ ...formData, logoUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCNPJLookup = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setError('Digite um CNPJ completo para realizar a busca.');
      return;
    }

    setLookupLoading(true);
    setError('');
    try {
      const data = await api.get(`/external/cnpj/${cleanCnpj}`);
      setFormData(prev => ({
        ...prev,
        companyName: data.corporateName || prev.companyName,
        contactEmail: data.contact?.email || prev.contactEmail,
        phone: maskPhone(data.contact?.phone || prev.phone),
        address: data.address ? 
          `${data.address.street}, ${data.address.number}${data.address.complement ? ` - ${data.address.complement}` : ''}, ${data.address.neighborhood}, ${data.address.city} - ${data.address.state}, CEP: ${maskCEP(data.address.zipCode)}` 
          : prev.address
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível localizar os dados deste CNPJ.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await api.put('/settings', formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Erro ao salvar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div style={{ color: '#fff', padding: 40 }}>Carregando configurações...</div>;

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard} style={{ maxWidth: 900 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Configurações do Sistema</h2>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Voltar ao Início
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          {/* Perfil da Empresa */}
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
            <div className={styles.inputWrapper}>
              <Building2 className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>CNPJ</label>
            <div className={styles.inputWrapper}>
              <Globe className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                value={formData.cnpj}
                onChange={e => setFormData({...formData, cnpj: maskCNPJ(e.target.value)})}
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
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData({...formData, contactEmail: e.target.value})}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Telefone Comercial</label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Endereço Completo</label>
            <div className={styles.inputWrapper}>
              <MapPin className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>

          {/* Preferências do Sistema */}
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Palette size={18} /> Preferências e Aparência
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tema Padrão</label>
            <div className={styles.inputWrapper}>
              <Palette className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect}
                value={formData.systemTheme}
                onChange={e => setFormData({...formData, systemTheme: e.target.value})}
              >
                <option value="dark">Dark Mode (Padrão)</option>
                <option value="light">Light Mode</option>
              </select>
            </div>
          </div>

          {error && <div className={styles.fullWidth + ' ' + styles.errorMsg}>{error}</div>}
          {saveSuccess && (
            <div className={styles.fullWidth} style={{ 
              background: 'rgba(0, 230, 176, 0.1)', color: '#00e6b0', 
              padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 600
            }}>
              Configurações salvas com sucesso!
            </div>
          )}

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
