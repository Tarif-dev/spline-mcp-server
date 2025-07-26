import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { Logger } from '../utils/logger';
import { ErrorHandler, SplineApiError, NotFoundError, ValidationError } from '../utils/error-handler';
import { Validator } from '../utils/validation';
import { SplineAnimation, SplineVariable, ApiResponse } from '../types/spline';
import { v4 as uuidv4 } from 'uuid';

export class SplineAnimationManager {
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
        Logger.debug('Spline Animation API request', { 
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
        Logger.debug('Spline Animation API response', {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        Logger.error('Spline Animation API error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          requestId,
        });
        
        if (error.response?.status === 404) {
          throw new NotFoundError('Animation or Variable');
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new SplineApiError(error.response.data?.message || 'Client error', error.response.status);
        } else if (error.response?.status >= 500) {
          throw new SplineApiError('Server error', error.response.status);
        }
        
        throw new SplineApiError(error.message);
      }
    );
  }

  async getAnimations(sceneId: string): Promise<ApiResponse<SplineAnimation[]>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      const response = await this.api.get(`/scenes/${sceneId}/animations`);

      return {
        success: true,
        data: response.data.animations,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async playAnimation(sceneId: string, animationName: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!animationName || animationName.trim().length === 0) {
        throw new ValidationError('Animation name is required');
      }

      await this.api.post(`/scenes/${sceneId}/animations/${animationName}/play`);

      Logger.info('Animation played', { sceneId, animationName });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async pauseAnimation(sceneId: string, animationName: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!animationName || animationName.trim().length === 0) {
        throw new ValidationError('Animation name is required');
      }

      await this.api.post(`/scenes/${sceneId}/animations/${animationName}/pause`);

      Logger.info('Animation paused', { sceneId, animationName });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async stopAnimation(sceneId: string, animationName: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!animationName || animationName.trim().length === 0) {
        throw new ValidationError('Animation name is required');
      }

      await this.api.post(`/scenes/${sceneId}/animations/${animationName}/stop`);

      Logger.info('Animation stopped', { sceneId, animationName });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async getVariables(sceneId: string): Promise<ApiResponse<SplineVariable[]>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      const response = await this.api.get(`/scenes/${sceneId}/variables`);

      return {
        success: true,
        data: response.data.variables,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async getVariable(sceneId: string, variableName: string): Promise<ApiResponse<SplineVariable>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }
      if (!variableName || variableName.trim().length === 0) {
        throw new ValidationError('Variable name is required');
      }

      const response = await this.api.get(`/scenes/${sceneId}/variables/${variableName}`);

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async setVariable(sceneId: string, variable: SplineVariable): Promise<ApiResponse<SplineVariable>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      // Validate variable data
      const validatedVariable = Validator.validate(Validator.variableSchema, variable);

      const response = await this.api.put(`/scenes/${sceneId}/variables/${variable.name}`, validatedVariable);

      Logger.info('Variable updated', { sceneId, variableName: variable.name, value: variable.value });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async createTransition(
    sceneId: string,
    objectId: string,
    properties: Record<string, any>,
    duration: number,
    easing: string = 'ease'
  ): Promise<ApiResponse<void>> {
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
      if (duration <= 0) {
        throw new ValidationError('Duration must be positive');
      }

      await this.api.post(`/scenes/${sceneId}/objects/${objectId}/transition`, {
        properties,
        duration,
        easing,
      });

      Logger.info('Transition created', { sceneId, objectId, duration, easing });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }
}

export const animationControlTools: Tool[] = [
  {
    name: "spline_get_animations",
    description: "Get all animations available in a Spline scene",
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
    name: "spline_play_animation",
    description: "Play a specific animation in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        animationName: {
          type: "string",
          description: "Name of the animation to play",
          minLength: 1
        }
      },
      required: ["sceneId", "animationName"]
    }
  },
  {
    name: "spline_pause_animation",
    description: "Pause a currently playing animation in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        animationName: {
          type: "string",
          description: "Name of the animation to pause",
          minLength: 1
        }
      },
      required: ["sceneId", "animationName"]
    }
  },
  {
    name: "spline_stop_animation",
    description: "Stop a currently playing animation in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        animationName: {
          type: "string",
          description: "Name of the animation to stop",
          minLength: 1
        }
      },
      required: ["sceneId", "animationName"]
    }
  },
  {
    name: "spline_get_variables",
    description: "Get all variables defined in a Spline scene",
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
    name: "spline_get_variable",
    description: "Get the value of a specific variable in a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        variableName: {
          type: "string",
          description: "Name of the variable to retrieve",
          minLength: 1,
          maxLength: 50
        }
      },
      required: ["sceneId", "variableName"]
    }
  },
  {
    name: "spline_set_variable",
    description: "Set the value of a variable in a Spline scene",
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
          description: "Name of the variable",
          minLength: 1,
          maxLength: 50
        },
        value: {
          description: "Value to set for the variable (type depends on variable type)"
        },
        type: {
          type: "string",
          enum: ["string", "number", "boolean", "color", "vector3"],
          description: "Type of the variable"
        }
      },
      required: ["sceneId", "name", "value", "type"]
    }
  },
  {
    name: "spline_create_transition",
    description: "Create a smooth transition animation for an object's properties",
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
          description: "ID of the object to animate"
        },
        properties: {
          type: "object",
          description: "Target properties for the transition",
          additionalProperties: true
        },
        duration: {
          type: "number",
          description: "Duration of the transition in milliseconds",
          minimum: 1,
          maximum: 60000
        },
        easing: {
          type: "string",
          description: "Easing function for the transition",
          enum: ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "bounce", "elastic"],
          default: "ease"
        }
      },
      required: ["sceneId", "objectId", "properties", "duration"]
    }
  }
];