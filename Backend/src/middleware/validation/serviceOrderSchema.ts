import Joi from 'joi';

const nestedServiceSchema = Joi.object({
  serviceId: Joi.number().integer().required(),
  employeeId: Joi.number().integer().allow(null, ''),
  description: Joi.string().allow(null, ''),
  hoursWorked: Joi.number().min(0).default(0),
  unitPrice: Joi.number().min(0).default(0),
  totalPrice: Joi.number().min(0).default(0)
});

const nestedMaterialSchema = Joi.object({
  materialId: Joi.number().integer().required(),
  quantity: Joi.number().min(0).required(),
  unitPrice: Joi.number().min(0).default(0),
  totalPrice: Joi.number().min(0).default(0)
});

export const serviceOrderCreateSchema = Joi.object({
  traceCode: Joi.string().trim().max(50).allow(null, ''),
  partCode: Joi.string().trim().max(100).allow(null, ''),
  batchCode: Joi.string().trim().max(100).allow(null, ''),
  workCenter: Joi.string().trim().max(100).allow(null, ''),
  plannedStartDate: Joi.date().iso().allow(null, ''),
  plannedEndDate: Joi.date().iso().min(Joi.ref('plannedStartDate')).allow(null, ''),
  plannedHours: Joi.number().min(0).allow(null, ''),
  description: Joi.string().allow(null, ''),
  personId: Joi.number().integer().required().messages({
    'any.required': 'O cliente (Pessoa) é obrigatório.'
  }),
  status: Joi.string().required(),
  openingDate: Joi.date().iso().default(() => new Date()),
  closingDate: Joi.date().iso().min(Joi.ref('openingDate')).allow(null, ''),
  problemDescription: Joi.string().allow(null, ''),
  technicalDiagnosis: Joi.string().allow(null, ''),
  taxPercent: Joi.number().min(0).max(100).default(0),
  profitPercent: Joi.number().min(0).default(0),
  services: Joi.array().items(nestedServiceSchema).default([]),
  materials: Joi.array().items(nestedMaterialSchema).default([])
});

export const serviceOrderUpdateSchema = Joi.object({
  traceCode: Joi.string().trim().max(50).allow(null, ''),
  partCode: Joi.string().trim().max(100).allow(null, ''),
  batchCode: Joi.string().trim().max(100).allow(null, ''),
  workCenter: Joi.string().trim().max(100).allow(null, ''),
  plannedStartDate: Joi.date().iso().allow(null, ''),
  plannedEndDate: Joi.date().iso().min(Joi.ref('plannedStartDate')).allow(null, ''),
  plannedHours: Joi.number().min(0).allow(null, ''),
  description: Joi.string().allow(null, ''),
  personId: Joi.number().integer(),
  status: Joi.string(),
  openingDate: Joi.date().iso(),
  closingDate: Joi.date().iso().min(Joi.ref('openingDate')).allow(null, ''),
  problemDescription: Joi.string().allow(null, ''),
  technicalDiagnosis: Joi.string().allow(null, ''),
  taxPercent: Joi.number().min(0).max(100),
  profitPercent: Joi.number().min(0),
  services: Joi.array().items(nestedServiceSchema),
  materials: Joi.array().items(nestedMaterialSchema)
}).min(1);
