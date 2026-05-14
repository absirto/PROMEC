import Joi from 'joi';

export const employeeCreateSchema = Joi.object({
  personId: Joi.number().integer().required().messages({
    'any.required': 'O vínculo com uma pessoa é obrigatório.'
  }),
  jobRoleId: Joi.number().integer().required().messages({
    'any.required': 'O cargo é obrigatório.'
  }),
  workAreaId: Joi.number().integer().required().messages({
    'any.required': 'A área de trabalho é obrigatória.'
  }),
  matricula: Joi.string().trim().min(2).max(50).required().messages({
    'any.required': 'A matrícula é obrigatória.',
    'string.min': 'A matrícula deve ter pelo menos 2 caracteres.'
  }),
  status: Joi.string().valid('Ativo', 'Inativo', 'Afastado', 'Férias').default('Ativo'),
  userId: Joi.number().integer().allow(null, '')
});

export const employeeUpdateSchema = Joi.object({
  jobRoleId: Joi.number().integer(),
  workAreaId: Joi.number().integer(),
  matricula: Joi.string().trim().min(2).max(50),
  status: Joi.string().valid('Ativo', 'Inativo', 'Afastado', 'Férias'),
  userId: Joi.number().integer().allow(null, '')
}).min(1);
