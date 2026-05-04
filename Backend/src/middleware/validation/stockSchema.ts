import Joi from 'joi';

export const stockSchema = Joi.object({
  materialId: Joi.number().integer().positive().required(),
  quantity: Joi.number().positive().required(),
  type: Joi.string().trim().valid('IN', 'OUT').required(),
  description: Joi.string().allow('').max(255),
  supplierPersonId: Joi.number().integer().positive(),
  unitCost: Joi.number().positive(),
  totalPaid: Joi.number().positive(),
});
