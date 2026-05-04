import Joi from 'joi';

export const materialSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().allow('').max(255),
  price: Joi.number().positive().required(),
  unit: Joi.string().min(1).max(10).required(),
  active: Joi.boolean().required(),
});
