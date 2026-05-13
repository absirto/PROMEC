import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Mail, Phone, MapPin, CreditCard, ArrowLeft, Save, Globe, Search, Building2 } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from '../../utils/masks';

const PersonForm: React.FC<{ isEdit?: boolean; isView?: boolean }> = ({ isEdit, isView }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [personType, setPersonType] = useState<'F' | 'J'>('F');

  const [formData, setFormData] = useState({
    name: '',
    tradeName: '',
    email: '',
    phone: '',
    document: '',
    address: {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      complement: ''
    }
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get(`/people/${id}`).then((person: any) => {
        setPersonType(person.type as 'F' | 'J');
        const mainData = person.type === 'F' ? person.naturalPerson : person.legalPerson;
        const mainContact = person.contacts?.[0] || {};
        const mainAddress = person.addresses?.[0] || {};

        setFormData({
          name: person.type === 'F' ? (mainData?.name || '') : (mainData?.corporateName || ''),
          tradeName: person.type === 'J' ? (mainData?.tradeName || '') : '',
          email: person.contacts?.find((c: any) => c.type === 'EMAIL')?.value || '',
          phone: maskPhone(person.contacts?.find((c: any) => c.type === 'PHONE')?.value || ''),
          document: person.type === 'F' ? maskCPF(mainData?.cpf || '') : maskCNPJ(mainData?.cnpj || ''),
          address: {
            street: mainAddress.logradouro || '',
            number: mainAddress.numero || '',
            neighborhood: mainAddress.bairro || '',
            city: mainAddress.cidade || '',
            state: mainAddress.uf || '',
            zipCode: maskCEP(mainAddress.cep || ''),
            complement: mainAddress.complemento || ''
          }
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const validate = () => {
    const newErrors: any = {};
    if (!formData.name) newErrors.name = personType === 'F' ? 'O nome é obrigatório.' : 'A razão social é obrigatória.';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido.';
    }
    if (!formData.document) newErrors.document = personType === 'F' ? 'O CPF é obrigatório.' : 'O CNPJ é obrigatório.';
    
    const docLength = formData.document.replace(/\D/g, '').length;
    if (personType === 'F' && docLength !== 11) newErrors.document = 'CPF inválido (11 dígitos).';
    if (personType === 'J' && docLength !== 14) newErrors.document = 'CNPJ inválido (14 dígitos).';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCNPJLookup = async () => {
    const cnpj = formData.document.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      showToast('Digite um CNPJ válido com 14 dígitos', 'error');
      return;
    }

    setLookupLoading(true);
    try {
      const data = await api.get(`/external/cnpj/${cnpj}`);
      setFormData(prev => ({
        ...prev,
        name: data.corporateName,
        tradeName: data.tradeName,
        email: data.contact.email || prev.email,
        phone: maskPhone(data.contact.phone || prev.phone),
        address: {
          ...prev.address,
          ...data.address,
          zipCode: maskCEP(data.address.zipCode || prev.address.zipCode)
        }
      }));
      showToast('Dados da empresa carregados com sucesso!');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao consultar CNPJ', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            address: {
              ...prev.address,
              street: data.logradouro,
              neighborhood: data.bairro,
              city: data.localidade,
              state: data.uf,
              zipCode: cep
            }
          }));
          showToast('Endereço localizado!');
        }
      } catch (err) { /* ignore */ }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    if (!validate()) {
      showToast('Por favor, corrija os erros no formulário.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: personType,
        naturalPerson: personType === 'F' ? {
          name: formData.name,
          cpf: formData.document.replace(/\D/g, '')
        } : undefined,
        legalPerson: personType === 'J' ? {
          corporateName: formData.name,
          tradeName: formData.tradeName,
          cnpj: formData.document.replace(/\D/g, '')
        } : undefined,
        addresses: [
          {
            cep: formData.address.zipCode,
            logradouro: formData.address.street,
            numero: formData.address.number,
            bairro: formData.address.neighborhood,
            cidade: formData.address.city,
            uf: formData.address.state,
            complemento: formData.address.complement,
            type: 'PRINCIPAL'
          }
        ],
        contacts: [
          ...(formData.email ? [{ type: 'EMAIL', value: formData.email }] : []),
          ...(formData.phone ? [{ type: 'PHONE', value: formData.phone }] : [])
        ]
      };

      if (id) await api.put(`/people/${id}`, payload);
      else await api.post('/people', payload);
      
      showToast('Salvo com sucesso!');
      navigate('/people');
    } catch (err) {
      showToast('Erro ao salvar cadastro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar Pessoa' : isEdit ? 'Editar Pessoa' : 'Novo Cadastro'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/people')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          {/* Seletor de Tipo */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tipo de Pessoa</label>
            <div className={styles.toggleContainer}>
              <button 
                type="button" 
                disabled={isView || isEdit}
                className={`${styles.toggleBtn} ${personType === 'F' ? styles.toggleBtnActive : ''}`}
                onClick={() => setPersonType('F')}
              >
                Pessoa Física
              </button>
              <button 
                type="button" 
                disabled={isView || isEdit}
                className={`${styles.toggleBtn} ${personType === 'J' ? styles.toggleBtnActive : ''}`}
                onClick={() => setPersonType('J')}
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>{personType === 'F' ? 'CPF' : 'CNPJ'}</label>
            <div className={`${styles.inputWrapper} ${errors.document ? styles.inputError : ''}`}>
              <CreditCard className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                placeholder={personType === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                disabled={isView || isEdit}
                value={formData.document}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, document: personType === 'F' ? maskCPF(val) : maskCNPJ(val)});
                }}
              />
              {personType === 'J' && !isView && !isEdit && (
                <button 
                  type="button" 
                  className={styles.lookupBtn}
                  onClick={handleCNPJLookup}
                  disabled={lookupLoading}
                >
                  <Search size={14} /> {lookupLoading ? '...' : 'Buscar'}
                </button>
              )}
            </div>
            {errors.document && <span className={styles.errorMessage}>{errors.document}</span>}
          </div>

          <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
            <label className={styles.label}>
              {personType === 'F' ? 'Nome Completo' : 'Razão Social'}
            </label>
            <div className={`${styles.inputWrapper} ${errors.name ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                disabled={isView}
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            {errors.name && <span className={styles.errorMessage}>{errors.name}</span>}
          </div>

          {personType === 'J' && (
            <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Nome Fantasia</label>
              <div className={styles.inputWrapper}>
                <Building2 className={styles.inputIcon} size={18} />
                <input 
                  className={styles.formInput} 
                  disabled={isView}
                  value={formData.tradeName}
                  onChange={e => setFormData({...formData, tradeName: e.target.value})}
                />
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail</label>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} type="email" disabled={isView}
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            {errors.email && <span className={styles.errorMessage}>{errors.email}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Telefone / WhatsApp</label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} disabled={isView}
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <MapPin size={18} /> Localização e Endereço
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>CEP</label>
            <div className={styles.inputWrapper}>
              <Globe className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} disabled={isView}
                value={formData.address.zipCode}
                onChange={e => {
                  const val = maskCEP(e.target.value);
                  setFormData({...formData, address: {...formData.address, zipCode: val}});
                  handleCEP(val);
                }}
              />
            </div>
          </div>

          <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
            <label className={styles.label}>Rua / Logradouro</label>
            <div className={styles.inputWrapper}>
              <MapPin className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} disabled={isView}
                value={formData.address.street}
                onChange={e => setFormData({...formData, address: {...formData.address, street: e.target.value}})}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Número</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} style={{ paddingLeft: 14 }} disabled={isView}
                value={formData.address.number}
                onChange={e => setFormData({...formData, address: {...formData.address, number: e.target.value}})}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Bairro</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} style={{ paddingLeft: 14 }} disabled={isView}
                value={formData.address.neighborhood}
                onChange={e => setFormData({...formData, address: {...formData.address, neighborhood: e.target.value}})}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Cidade</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} style={{ paddingLeft: 14 }} disabled={isView}
                value={formData.address.city}
                onChange={e => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>UF</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} style={{ paddingLeft: 14 }} disabled={isView}
                value={formData.address.state}
                onChange={e => setFormData({...formData, address: {...formData.address, state: e.target.value}})}
              />
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 24 }}>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading ? 'Salvando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PersonForm;
