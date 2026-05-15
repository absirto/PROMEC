import Joi from 'joi';

export const financeSchema = Joi.object({
  type: Joi.string().trim().min(2).max(30).required(),
  amount: Joi.number().positive().required(),
  category: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().allow('').max(255),
  orderId: Joi.number().integer().positive().allow(null),
});
