import Joi from 'joi';

export const jobRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
});
