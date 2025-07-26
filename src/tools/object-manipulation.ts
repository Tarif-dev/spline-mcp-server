import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { Logger } from '../utils/logger';
import { ErrorHandler, SplineApiError, NotFoundError, ValidationError } from '../utils/error-handler';
import { Validator } from '../utils/validation';
import { SplineObject, Vector3, ApiResponse } from '../types/spline';
import { v4 as uuidv4 } from 'uuid';

export class SplineObjectManager {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${config.spline.apiBaseUrl}/${config.spline.apiVersion}`,
      timeout: config.spline.timeout,
      headers: {
        'Authorization': `Bearer ${config.spline.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Spline-MCP-Server/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(
      (config) => {
        const requestId = uuidv4();
        config.headers['X-Request-ID'] = requestId;
        Logger.debug('Spline Object API request', { 
          method: config.method,
          url: config.url,
          requestId 
        });
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => {
        Logger.debug('Spline Object API response', {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        Logger.error('Spline Object API error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          requestId,
        });
        
        if (error.response?.status === 404) {
          throw new NotFoundError('Object');
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new SplineApiError(error.response.data?.message || 'Client error', error.response.status);
        } else if (error.response?.status >= 500) {
          throw new SplineApiError('Server error', error.response.status);
        }
        
        throw new SplineApiError(error.message);
      }
    );
  }

  async getSceneObjects(sceneId: string): Promise<ApiResponse<SplineObject[]>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      const response = await this.api.get(`/scenes/${sceneId}/objects`);

      return {
        success: true,
        data: response.data.objects,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async getObject(sceneId: string, objectId: string): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }

      const response = await this.api.get(`/scenes/${sceneId}/objects/${objectId}`);

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async updateObjectTransform(
    sceneId: string, 
    objectId: string, 
    transform: { position?: Vector3; rotation?: Vector3; scale?: Vector3 }
  ): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }

      // Validate transform data
      if (transform.position) {
        Validator.validate(Validator.vector3Schema, transform.position);
      }
      if (transform.rotation) {
        Validator.validate(Validator.vector3Schema, transform.rotation);
      }
      if (transform.scale) {
        Validator.validate(Validator.vector3Schema, transform.scale);
      }

      const response = await this.api.patch(`/scenes/${sceneId}/objects/${objectId}/transform`, transform);

      Logger.info('Object transform updated', { sceneId, objectId, transform });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async updateObjectProperties(
    sceneId: string, 
    objectId: string, 
    properties: Record<string, any>
  ): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }
      if (!properties || Object.keys(properties).length === 0) {
        throw new ValidationError('Properties object cannot be empty');
      }

      const response = await this.api.patch(`/scenes/${sceneId}/objects/${objectId}/properties`, {
        properties
      });

      Logger.info('Object properties updated', { sceneId, objectId, properties });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async setObjectVisibility(
    sceneId: string, 
    objectId: string, 
    visible: boolean
  ): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }

      const response = await this.api.patch(`/scenes/${sceneId}/objects/${objectId}`, {
        visible
      });

      Logger.info('Object visibility updated', { sceneId, objectId, visible });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async createObject(
    sceneId: string,
    objectData: Omit<SplineObject, 'id'>
  ): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      // Validate object data
      const validatedData = Validator.validate(
        Validator.splineObjectSchema.keys({ id: Validator.splineObjectSchema.extract('id').optional() }),
        objectData
      );

      const response = await this.api.post(`/scenes/${sceneId}/objects`, validatedData);

      Logger.info('Object created', { sceneId, objectId: response.data.id });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async deleteObject(sceneId: string, objectId: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }

      await this.api.delete(`/scenes/${sceneId}/objects/${objectId}`);

      Logger.info('Object deleted', { sceneId, objectId });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async duplicateObject(sceneId: string, objectId: string): Promise<ApiResponse<SplineObject>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!objectId) {
        throw new ValidationError('Object ID is required');
      }

      const response = await this.api.post(`/scenes/${sceneId}/objects/${objectId}/duplicate`);

      Logger.info('Object duplicated', { sceneId, originalId: objectId, newId: response.data.id });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }
}

export const objectManipulationTools: Tool[] = [
  {
    name: "spline_get_scene_objects",
    description: "Get all objects in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "spline_get_object",
    description: "Get detailed information about a specific object in a scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object to retrieve"
        }
      },
      required: ["sceneId", "objectId"]
    }
  },
  {
    name: "spline_update_object_transform",
    description: "Update the position, rotation, or scale of an object in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object to update"
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          description: "New position coordinates"
        },
        rotation: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          description: "New rotation values in radians"
        },
        scale: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          description: "New scale values"
        }
      },
      required: ["sceneId", "objectId"]
    }
  },
  {
    name: "spline_update_object_properties",
    description: "Update custom properties of an object in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object to update"
        },
        properties: {
          type: "object",
          description: "Object properties to update",
          additionalProperties: true
        }
      },
      required: ["sceneId", "objectId", "properties"]
    }
  },
  {
    name: "spline_set_object_visibility",
    description: "Show or hide an object in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object"
        },
        visible: {
          type: "boolean",
          description: "Whether the object should be visible"
        }
      },
      required: ["sceneId", "objectId", "visible"]
    }
  },
  {
    name: "spline_create_object",
    description: "Create a new object in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        name: {
          type: "string",
          description: "Name of the new object",
          minLength: 1,
          maxLength: 100
        },
        type: {
          type: "string",
          enum: ["mesh", "light", "camera", "group", "text", "spline"],
          description: "Type of object to create"
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          required: ["x", "y", "z"],
          description: "Initial position"
        },
        rotation: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          required: ["x", "y", "z"],
          description: "Initial rotation in radians"
        },
        scale: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          },
          required: ["x", "y", "z"],
          description: "Initial scale"
        },
        visible: {
          type: "boolean",
          description: "Whether the object should be visible",
          default: true
        },
        properties: {
          type: "object",
          description: "Additional object properties",
          additionalProperties: true
        }
      },
      required: ["sceneId", "name", "type", "position", "rotation", "scale"]
    }
  },
  {
    name: "spline_delete_object",
    description: "Delete an object from a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object to delete"
        }
      },
      required: ["sceneId", "objectId"]
    }
  },
  {
    name: "spline_duplicate_object",
    description: "Create a copy of an object in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        objectId: {
          type: "string",
          description: "ID of the object to duplicate"
        }
      },
      required: ["sceneId", "objectId"]
    }
  }
];