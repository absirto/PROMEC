import Joi from 'joi';

export const materialCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.empty': 'O nome do material é obrigatório.',
    'string.min': 'O nome deve ter pelo menos 2 caracteres.'
  }),
  description: Joi.string().allow(null, '').max(1000),
  price: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'O preço deve ser um valor positivo.',
    'any.required': 'O preço é obrigatório.'
  }),
  unit: Joi.string().trim().max(10).required().messages({
    'any.required': 'A unidade de medida é obrigatória (ex: UN, KG, M).'
  }),
  active: Joi.boolean().default(true)
});

export const materialUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255),
  description: Joi.string().allow(null, '').max(1000),
  price: Joi.number().positive().precision(2),
  unit: Joi.string().trim().max(10),
  active: Joi.boolean()
}).min(1); // Exige pelo menos um campo para atualização
