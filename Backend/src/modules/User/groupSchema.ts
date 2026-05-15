import Joi from 'joi';

export const groupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  permissionKeys: Joi.array().items(Joi.string().trim().min(1).max(120)).min(1).required(),
});
