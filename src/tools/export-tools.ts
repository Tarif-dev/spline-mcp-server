import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { Logger } from '../utils/logger';
import { ErrorHandler, SplineApiError, NotFoundError, ValidationError } from '../utils/error-handler';
import { Validator } from '../utils/validation';
import { SplineExportOptions, ApiResponse } from '../types/spline';
import { v4 as uuidv4 } from 'uuid';

export interface ExportJob {
  id: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class SplineExportManager {
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
        Logger.debug('Spline Export API request', { 
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
        Logger.debug('Spline Export API response', {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        Logger.error('Spline Export API error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          requestId,
        });
        
        if (error.response?.status === 404) {
          throw new NotFoundError('Export job or scene');
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new SplineApiError(error.response.data?.message || 'Client error', error.response.status);
        } else if (error.response?.status >= 500) {
          throw new SplineApiError('Server error', error.response.status);
        }
        
        throw new SplineApiError(error.message);
      }
    );
  }

  async exportScene(sceneId: string, options: SplineExportOptions): Promise<ApiResponse<ExportJob>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      // Validate export options
      const validatedOptions = Validator.validate(Validator.exportOptionsSchema, options);

      // Additional validation for specific formats
      if (validatedOptions.format === 'image' || validatedOptions.format === 'video') {
        if (!validatedOptions.width || !validatedOptions.height) {
          throw new ValidationError('Width and height are required for image and video exports');
        }
      }

      if (validatedOptions.format === 'video' && !validatedOptions.fps) {
        validatedOptions.fps = 30; // Default FPS
      }

      const response = await this.api.post(`/scenes/${sceneId}/export`, validatedOptions);

      Logger.info('Export job created', { 
        sceneId, 
        jobId: response.data.id, 
        format: validatedOptions.format 
      });

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async getExportStatus(jobId: string): Promise<ApiResponse<ExportJob>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(jobId)) {
        throw new ValidationError('Invalid job ID format');
      }

      const response = await this.api.get(`/export/jobs/${jobId}`);

      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async cancelExport(jobId: string): Promise<ApiResponse<void>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(jobId)) {
        throw new ValidationError('Invalid job ID format');
      }

      await this.api.delete(`/export/jobs/${jobId}`);

      Logger.info('Export job cancelled', { jobId });

      return {
        success: true,
        timestamp: new Date(),
        requestId: uuidv4(),
      };
    });
  }

  async getExportHistory(sceneId: string, limit: number = 20): Promise<ApiResponse<ExportJob[]>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }

      const response = await this.api.get(`/scenes/${sceneId}/export/history`, {
        params: { limit }
      });

      return {
        success: true,
        data: response.data.jobs,
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async downloadExport(jobId: string): Promise<ApiResponse<{ downloadUrl: string; expiresAt: Date }>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(jobId)) {
        throw new ValidationError('Invalid job ID format');
      }

      const response = await this.api.post(`/export/jobs/${jobId}/download`);

      return {
        success: true,
        data: {
          downloadUrl: response.data.downloadUrl,
          expiresAt: new Date(response.data.expiresAt),
        },
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }

  async getPreviewImage(sceneId: string, width: number = 800, height: number = 600): Promise<ApiResponse<{ imageUrl: string }>> {
    return ErrorHandler.handleAsync(async () => {
      if (!Validator.isValidUUID(sceneId)) {
        throw new ValidationError('Invalid scene ID format');
      }

      if (width < 100 || width > 4096 || height < 100 || height > 4096) {
        throw new ValidationError('Width and height must be between 100 and 4096 pixels');
      }

      const response = await this.api.get(`/scenes/${sceneId}/preview`, {
        params: { width, height }
      });

      return {
        success: true,
        data: {
          imageUrl: response.data.imageUrl,
        },
        timestamp: new Date(),
        requestId: response.config.headers['X-Request-ID'] as string,
      };
    });
  }
}

export const exportTools: Tool[] = [
  {
    name: "spline_export_scene",
    description: "Export a Spline scene to various formats (GLTF, OBJ, FBX, image, video)",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene to export",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        format: {
          type: "string",
          enum: ["gltf", "obj", "fbx", "image", "video"],
          description: "Export format"
        },
        quality: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Export quality",
          default: "medium"
        },
        width: {
          type: "number",
          description: "Width in pixels (required for image/video formats)",
          minimum: 100,
          maximum: 4096
        },
        height: {
          type: "number",
          description: "Height in pixels (required for image/video formats)",
          minimum: 100,
          maximum: 4096
        },
        fps: {
          type: "number",
          description: "Frames per second (for video format)",
          minimum: 1,
          maximum: 60,
          default: 30
        },
        duration: {
          type: "number",
          description: "Duration in seconds (for video format)",
          minimum: 1,
          maximum: 300
        }
      },
      required: ["sceneId", "format"]
    }
  },
  {
    name: "spline_get_export_status",
    description: "Get the status of an export job",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID of the export job",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["jobId"]
    }
  },
  {
    name: "spline_cancel_export",
    description: "Cancel a pending or processing export job",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID of the export job to cancel",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["jobId"]
    }
  },
  {
    name: "spline_get_export_history",
    description: "Get the export history for a scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        limit: {
          type: "number",
          description: "Maximum number of export jobs to return",
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      required: ["sceneId"]
    }
  },
  {
    name: "spline_download_export",
    description: "Get a download URL for a completed export",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID of the completed export job",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        }
      },
      required: ["jobId"]
    }
  },
  {
    name: "spline_get_preview_image",
    description: "Generate a preview image of a Spline scene",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "UUID of the scene",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        },
        width: {
          type: "number",
          description: "Width of the preview image in pixels",
          minimum: 100,
          maximum: 4096,
          default: 800
        },
        height: {
          type: "number",
          description: "Height of the preview image in pixels",
          minimum: 100,
          maximum: 4096,
          default: 600
        }
      },
      required: ["sceneId"]
    }
  }
];