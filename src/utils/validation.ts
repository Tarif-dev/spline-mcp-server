import Joi from 'joi';
import { ValidationError } from './error-handler';

export class Validator {
  static vector3Schema = Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    z: Joi.number().required(),
  });

  static splineObjectSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('mesh', 'light', 'camera', 'group', 'text', 'spline').required(),
    position: this.vector3Schema.required(),
    rotation: this.vector3Schema.required(),
    scale: this.vector3Schema.required(),
    visible: Joi.boolean().required(),
    properties: Joi.object().optional(),
  });

  static exportOptionsSchema = Joi.object({
    format: Joi.string().valid('gltf', 'obj', 'fbx', 'image', 'video').required(),
    quality: Joi.string().valid('low', 'medium', 'high').default('medium'),
    width: Joi.number().positive().max(4096).optional(),
    height: Joi.number().positive().max(4096).optional(),
    fps: Joi.number().positive().max(60).optional(),
    duration: Joi.number().positive().max(300).optional(),
  });

  static variableSchema = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    value: Joi.any().required(),
    type: Joi.string().valid('string', 'number', 'boolean', 'color', 'vector3').required(),
  });

  static validate<T>(schema: Joi.ObjectSchema, data: any): T {
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new ValidationError(message);
    }
    
    return value;
  }

  static validateArray<T>(schema: Joi.ObjectSchema, data: any[]): T[] {
    return data.map(item => this.validate<T>(schema, item));
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  }
}