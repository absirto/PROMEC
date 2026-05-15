import Joi from 'joi';

export const userSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  groupId: Joi.number().integer().positive().required(),
  role: Joi.string().valid('admin', 'user').default('user'),
});
