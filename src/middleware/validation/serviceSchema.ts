import Joi from 'joi';

export const serviceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().allow('').max(255),
  price: Joi.number().positive().required(),
  active: Joi.boolean().required(),
});
