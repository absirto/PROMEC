import Joi from 'joi';

export const workAreaSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
});
