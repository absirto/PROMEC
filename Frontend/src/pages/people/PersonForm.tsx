import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { User, Mail, Phone, MapPin, CreditCard, ArrowLeft, Save, Globe, Search, Building2 } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from '../../utils/masks';

interface PersonFormData {
  type: 'F' | 'J';
  name: string;
  tradeName: string;
  email: string;
  phone: string;
  document: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    complement: string;
  };
}

const PersonForm: React.FC<{ isEdit?: boolean; isView?: boolean }> = ({ isEdit, isView }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<PersonFormData>({
    defaultValues: {
      type: 'F',
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
    }
  });

  const personType = useWatch({ control, name: 'type' });
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get(`/people/${id}`).then((person: any) => {
        const mainData = person.type === 'F' ? person.naturalPerson : person.legalPerson;
        const mainAddress = person.addresses?.[0] || {};

        reset({
          type: person.type as 'F' | 'J',
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
  }, [id, reset]);

  const handleCNPJLookup = async () => {
    const docValue = (document.getElementById('document-input') as HTMLInputElement)?.value || '';
    const cnpj = docValue.replace(/\D/g, '');
    
    if (cnpj.length !== 14) {
      showToast('Digite um CNPJ válido com 14 dígitos', 'error');
      return;
    }

    setLookupLoading(true);
    try {
      const data = await api.get(`/external/cnpj/${cnpj}`);
      setValue('name', data.corporateName);
      setValue('tradeName', data.tradeName);
      if (data.contact.email) setValue('email', data.contact.email);
      if (data.contact.phone) setValue('phone', maskPhone(data.contact.phone));
      
      if (data.address) {
        setValue('address.street', data.address.street);
        setValue('address.neighborhood', data.address.neighborhood);
        setValue('address.city', data.address.city);
        setValue('address.state', data.address.state);
        setValue('address.zipCode', maskCEP(data.address.zipCode));
      }
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
          setValue('address.street', data.logradouro);
          setValue('address.neighborhood', data.bairro);
          setValue('address.city', data.localidade);
          setValue('address.state', data.uf);
          showToast('Endereço localizado!');
        }
      } catch (err) { /* ignore */ }
    }
  };

  const onSubmit = async (data: PersonFormData) => {
    if (isView) return;

    setLoading(true);
    try {
      const payload = {
        type: data.type,
        naturalPerson: data.type === 'F' ? {
          name: data.name,
          cpf: data.document.replace(/\D/g, '')
        } : undefined,
        legalPerson: data.type === 'J' ? {
          corporateName: data.name,
          tradeName: data.tradeName,
          cnpj: data.document.replace(/\D/g, '')
        } : undefined,
        addresses: data.address.zipCode ? [
          {
            cep: data.address.zipCode.replace(/\D/g, ''),
            logradouro: data.address.street,
            numero: data.address.number,
            bairro: data.address.neighborhood,
            cidade: data.address.city,
            uf: (data.address.state || '').slice(0, 2).toUpperCase(),
            complemento: data.address.complement || '',
            type: 'RESIDENCIAL'
          }
        ] : [],
        contacts: [
          ...(data.email ? [{ type: 'EMAIL', value: data.email }] : []),
          ...(data.phone ? [{ type: 'TELEFONE', value: data.phone.replace(/\D/g, '') }] : [])
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

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tipo de Pessoa</label>
            <div className={styles.toggleContainer}>
              <button 
                type="button" 
                disabled={isView || isEdit}
                className={`${styles.toggleBtn} ${personType === 'F' ? styles.toggleBtnActive : ''}`}
                onClick={() => setValue('type', 'F')}
              >
                Pessoa Física
              </button>
              <button 
                type="button" 
                disabled={isView || isEdit}
                className={`${styles.toggleBtn} ${personType === 'J' ? styles.toggleBtnActive : ''}`}
                onClick={() => setValue('type', 'J')}
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
                id="document-input"
                className={styles.formInput} 
                placeholder={personType === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                disabled={isView || isEdit}
                {...register('document', { 
                  required: 'O documento é obrigatório',
                  validate: (val) => {
                    const clean = val.replace(/\D/g, '');
                    if (personType === 'F' && clean.length !== 11) return 'CPF deve ter 11 dígitos';
                    if (personType === 'J' && clean.length !== 14) return 'CNPJ deve ter 14 dígitos';
                    return true;
                  },
                  onChange: (e) => {
                    const val = e.target.value;
                    setValue('document', personType === 'F' ? maskCPF(val) : maskCNPJ(val));
                  }
                })}
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
            {errors.document && <span className={styles.errorMessage}>{errors.document.message}</span>}
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
                {...register('name', { 
                  required: 'Este campo é obrigatório',
                  minLength: { value: 3, message: 'O nome/razão social deve ter no mínimo 3 caracteres' }
                })}
              />
            </div>
            {errors.name && <span className={styles.errorMessage}>{errors.name.message}</span>}
          </div>

          {personType === 'J' && (
            <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Nome Fantasia</label>
              <div className={styles.inputWrapper}>
                <Building2 className={styles.inputIcon} size={18} />
                <input 
                  className={styles.formInput} 
                  disabled={isView}
                  {...register('tradeName')}
                />
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail</label>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                type="email" 
                disabled={isView}
                {...register('email', { 
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'E-mail inválido'
                  }
                })}
              />
            </div>
            {errors.email && <span className={styles.errorMessage}>{errors.email.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Telefone / WhatsApp</label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                disabled={isView}
                {...register('phone', {
                   onChange: (e) => setValue('phone', maskPhone(e.target.value))
                })}
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
                className={styles.formInput} 
                disabled={isView}
                {...register('address.zipCode', {
                  required: 'CEP é obrigatório',
                  onChange: (e) => {
                    const val = maskCEP(e.target.value);
                    setValue('address.zipCode', val);
                    handleCEP(val);
                  }
                })}
              />
            </div>
            {errors.address?.zipCode && <span className={styles.errorMessage}>{errors.address.zipCode.message}</span>}
          </div>

          <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
            <label className={styles.label}>Rua / Logradouro</label>
            <div className={styles.inputWrapper}>
              <MapPin className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                disabled={isView}
                {...register('address.street', { required: 'Rua é obrigatória' })}
              />
            </div>
            {errors.address?.street && <span className={styles.errorMessage}>{errors.address.street.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Número</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} 
                style={{ paddingLeft: 14 }} 
                disabled={isView}
                {...register('address.number', { required: 'Nº é obrigatório' })}
              />
            </div>
            {errors.address?.number && <span className={styles.errorMessage}>{errors.address.number.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Bairro</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} 
                style={{ paddingLeft: 14 }} 
                disabled={isView}
                {...register('address.neighborhood', { required: 'Bairro é obrigatório' })}
              />
            </div>
            {errors.address?.neighborhood && <span className={styles.errorMessage}>{errors.address.neighborhood.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Cidade</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} 
                style={{ paddingLeft: 14 }} 
                disabled={isView}
                {...register('address.city', { required: 'Cidade é obrigatória' })}
              />
            </div>
            {errors.address?.city && <span className={styles.errorMessage}>{errors.address.city.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>UF</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.formInput} 
                style={{ paddingLeft: 14 }} 
                disabled={isView}
                {...register('address.state', { required: 'UF é obrigatório' })}
              />
            </div>
            {errors.address?.state && <span className={styles.errorMessage}>{errors.address.state.message}</span>}
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 24 }}>
              <button type="submit" className={styles.submitBtn} disabled={loading || isSubmitting}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading || isSubmitting ? 'Salvando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PersonForm;
