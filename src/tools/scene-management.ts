import { McpError, Tool } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { Logger } from '../utils/logger';
import { ErrorHandler, SplineApiError, NotFoundError, ValidationError } from '../utils/error-handler';
import { Validator } from '../utils/validation';
import { SplineScene, ApiResponse } from '../types/spline';
import { v4 as uuidv4 } from 'uuid';

export class SplineSceneManager {
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
        Logger.debug('Spline API request', { 
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
        Logger.debug('Spline API response', {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        Logger.error('Spline API error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          requestId,
        });
        
        if (error.response?.status === 404) {
          throw new NotFoundError('Scene');
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new SplineApiError(error.response.data?.message || 'Client error', error.response.status);
        } else if (error.response?.status >= 500) {
          throw new SplineApiError('Server error', error.response.status);
        }
        
        throw new SplineApiError(error.message);
      }
    );
  }

  async listScenes(limit: number = 50, offset: number = 0): Promise<ApiResponse<SplineScene[]>> {
    return ErrorHandler.handleAsync(async () => {
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }

      const response = await this.api.get('/scenes', {
        params: { limit, offset }
      });

      return {
        success: true,
        data: response.data.scenes,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async getScene(sceneId: string): Promise<ApiResponse<SplineScene>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      const response = await this.api.get(`/scenes/${sceneId}`);

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async createScene(name: string, description?: string): Promise<ApiResponse<SplineScene>> {
    return ErrorHandler.handleAsync(async () => {
      if (!name || name.trim().length === 0) {
        throw new ValidationError('Scene name is required');
      }

      if (name.length > 100) {
        throw new ValidationError('Scene name must be less than 100 characters');
      }

      const response = await this.api.post('/scenes', {
        name: name.trim(),
        description: description?.trim(),
      });

      Logger.info('Scene created', { sceneId: response.data.id, name });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async updateScene(sceneId: string, updates: Partial<{ name: string; description: string }>): Promise<ApiResponse<SplineScene>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new ValidationError('Scene name cannot be empty');
        }
        if (updates.name.length > 100) {
          throw new ValidationError('Scene name must be less than 100 characters');
        }
      }

      const response = await this.api.patch(`/scenes/${sceneId}`, updates);

      Logger.info('Scene updated', { sceneId, updates });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async deleteScene(sceneId: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      await this.api.delete(`/scenes/${sceneId}`);

      Logger.info('Scene deleted', { sceneId });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async duplicateScene(sceneId: string, newName?: string): Promise<ApiResponse<SplineScene>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      const response = await this.api.post(`/scenes/${sceneId}/duplicate`, {
        name: newName,
      });

      Logger.info('Scene duplicated', { originalId: sceneId, newId: response.data.id });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }
}

export const sceneManagementTools: Tool[] = [
  {
    name: "spline_list_scenes",
    description: "List all available Spline scenes with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of scenes to return (1-100)",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        offset: {
          type: "number",
          description: "Number of scenes to skip for pagination",
          minimum: 0,
          default: 0
        }
      }
    }
  },
  {
    name: "spline_get_scene",
    description: "Get detailed information about a specific Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene to retrieve",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "spline_create_scene",
    description: "Create a new Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the new scene",
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: "string",
          description: "Optional description of the scene",
          maxLength: 500
        }
      },
      required: ["name"]
    }
  },
  {
    name: "spline_update_scene",
    description: "Update an existing Spline scene's metadata",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene to update",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        name: {
          type: "string",
          description: "New name for the scene",
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: "string",
          description: "New description for the scene",
          maxLength: 500
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "spline_delete_scene",
    description: "Delete a Spline scene permanently",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene to delete",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "spline_duplicate_scene",
    description: "Create a copy of an existing Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene to duplicate",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        newName: {
          type: "string",
          description: "Name for the duplicated scene",
          minLength: 1,
          maxLength: 100
        }
      },
      required: ["sceneId"]
    }
  }
];