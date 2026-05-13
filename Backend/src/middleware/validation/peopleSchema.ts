import Joi from 'joi';

const addressSchema = Joi.object({
  cep: Joi.string().trim().length(8).required(),
  logradouro: Joi.string().trim().required(),
  numero: Joi.string().trim().required(),
  complemento: Joi.string().trim().allow(null, ''),
  bairro: Joi.string().trim().required(),
  cidade: Joi.string().trim().required(),
  uf: Joi.string().trim().length(2).uppercase().required(),
  type: Joi.string().valid('RESIDENCIAL', 'COMERCIAL', 'ENTREGA', 'COBRANCA').required()
});

const contactSchema = Joi.object({
  type: Joi.string().valid('EMAIL', 'TELEFONE', 'WHATSAPP', 'OUTRO').required(),
  value: Joi.string().trim().required(),
  description: Joi.string().trim().allow(null, '')
});

export const personCreateSchema = Joi.object({
  type: Joi.string().valid('F', 'J').required(),
  naturalPerson: Joi.object({
    cpf: Joi.string().trim().length(11).required(),
    name: Joi.string().trim().min(3).required(),
    rg: Joi.string().trim().allow(null, ''),
    orgEmissor: Joi.string().trim().allow(null, ''),
    ufRg: Joi.string().trim().length(2).uppercase().allow(null, ''),
    birthDate: Joi.date().iso().allow(null, ''),
    gender: Joi.string().valid('M', 'F', 'OTHER').allow(null, '')
  }).when('type', { is: 'F', then: Joi.required(), otherwise: Joi.forbidden() }),
  legalPerson: Joi.object({
    cnpj: Joi.string().trim().length(14).required(),
    corporateName: Joi.string().trim().required(),
    tradeName: Joi.string().trim().allow(null, ''),
    stateRegistration: Joi.string().trim().allow(null, ''),
    municipalRegistration: Joi.string().trim().allow(null, ''),
    representatives: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      cpf: Joi.string().length(11).required(),
      function: Joi.string().required()
    })).default([])
  }).when('type', { is: 'J', then: Joi.required(), otherwise: Joi.forbidden() }),
  addresses: Joi.array().items(addressSchema).default([]),
  contacts: Joi.array().items(contactSchema).default([])
});

export const personUpdateSchema = Joi.object({
  type: Joi.string().valid('F', 'J'),
  naturalPerson: Joi.object({
    cpf: Joi.string().trim().length(11),
    name: Joi.string().trim().min(3),
    rg: Joi.string().trim().allow(null, ''),
    orgEmissor: Joi.string().trim().allow(null, ''),
    ufRg: Joi.string().trim().length(2).uppercase().allow(null, ''),
    birthDate: Joi.date().iso().allow(null, ''),
    gender: Joi.string().valid('M', 'F', 'OTHER').allow(null, '')
  }),
  legalPerson: Joi.object({
    cnpj: Joi.string().trim().length(14),
    corporateName: Joi.string().trim(),
    tradeName: Joi.string().trim().allow(null, ''),
    stateRegistration: Joi.string().trim().allow(null, ''),
    municipalRegistration: Joi.string().trim().allow(null, ''),
    representatives: Joi.array().items(Joi.object({
      name: Joi.string(),
      cpf: Joi.string().length(11),
      function: Joi.string()
    }))
  }),
  addresses: Joi.array().items(addressSchema),
  contacts: Joi.array().items(contactSchema)
}).min(1);
