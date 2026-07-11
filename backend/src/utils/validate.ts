import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      throw new AppError(400, messages);
    }
    next();
  };
}

export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createBook: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    author: Joi.string().max(255).optional().allow(''),
    isbn: Joi.string().max(20).optional().allow(''),
    pages: Joi.number().integer().min(1).optional(),
    bookshop_id: Joi.string().uuid().optional(),
  }),

  updateBookStatus: Joi.object({
    status: Joi.string().valid('pending', 'approved', 'rejected', 'archived').required(),
  }),

  createPrintJob: Joi.object({
    book_id: Joi.string().uuid().required(),
    bookshop_id: Joi.string().uuid().optional(),
    copies: Joi.number().integer().min(1).max(1000).default(1),
    notes: Joi.string().max(1000).optional().allow(''),
  }),

  updatePrintStatus: Joi.object({
    status: Joi.string().valid('pending', 'printing', 'completed', 'cancelled').required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};
