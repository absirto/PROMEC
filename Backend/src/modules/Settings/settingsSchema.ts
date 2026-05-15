import Joi from 'joi';

export const settingsSchema = Joi.object({
  backgroundImageUrl: Joi.string().uri().allow('', null),
  address: Joi.string().max(255).allow('', null),
  cnpj: Joi.string().max(30).allow('', null),
  companyName: Joi.string().max(120).allow('', null),
  contactEmail: Joi.string().email().allow('', null),
  logoUrl: Joi.string().uri().allow('', null),
  phone: Joi.string().max(30).allow('', null),
  systemTheme: Joi.string().max(20).allow('', null),
}).min(1);
