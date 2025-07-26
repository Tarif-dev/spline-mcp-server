import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { RateLimiter } from './utils/rate-limiter';

// Import tool managers
import { SplineSceneManager, sceneManagementTools } from './tools/scene-management';
import { SplineObjectManager, objectManipulationTools } from './tools/object-manipulation';
import { SplineAnimationManager, animationControlTools } from './tools/animation-control';
import { SplineExportManager, exportTools } from './tools/export-tools';

export class SplineMcpServer {
  private server: Server;
  private sceneManager: SplineSceneManager;
  private objectManager: SplineObjectManager;
  private animationManager: SplineAnimationManager;
  private exportManager: SplineExportManager;

  constructor() {
    this.server = new Server(
      {
        name: 'spline-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize managers
    this.sceneManager = new SplineSceneManager();
    this.objectManager = new SplineObjectManager();
    this.animationManager = new SplineAnimationManager();
    this.exportManager = new SplineExportManager();

    this.setupHandlers();
    Logger.info('Spline MCP Server initialized');
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.debug('Listing available tools');
      
      return {
        tools: [
          ...sceneManagementTools,
          ...objectManipulationTools,
          ...animationControlTools,
          ...exportTools,
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      Logger.info('Tool called', { toolName: name, requestId, args });

      try {
        // Rate limiting check
        const rateLimitKey = `tool:${name}`;
        const isAllowed = await RateLimiter.checkCustomLimit(rateLimitKey, 100, 60000); // 100 calls per minute
        
        if (!isAllowed) {
          throw new McpError(
            ErrorCode.InternalError,
            'Rate limit exceeded for this tool'
          );
        }

        let result;

        // Scene Management Tools
        switch (name) {
          case 'spline_list_scenes':
            result = await this.sceneManager.listScenes(args.limit, args.offset);
            break;
            
          case 'spline_get_scene':
            result = await this.sceneManager.getScene(args.sceneId);
            break;
            
          case 'spline_create_scene':
            result = await this.sceneManager.createScene(args.name, args.description);
            break;
            
          case 'spline_update_scene':
            result = await this.sceneManager.updateScene(args.sceneId, {
              name: args.name,
              description: args.description,
            });
            break;
            
          case 'spline_delete_scene':
            result = await this.sceneManager.deleteScene(args.sceneId);
            break;
            
          case 'spline_duplicate_scene':
            result = await this.sceneManager.duplicateScene(args.sceneId, args.newName);
            break;

          // Object Manipulation Tools
          case 'spline_get_scene_objects':
            result = await this.objectManager.getSceneObjects(args.sceneId);
            break;
            
          case 'spline_get_object':
            result = await this.objectManager.getObject(args.sceneId, args.objectId);
            break;
            
          case 'spline_update_object_transform':
            result = await this.objectManager.updateObjectTransform(args.sceneId, args.objectId, {
              position: args.position,
              rotation: args.rotation,
              scale: args.scale,
            });
            break;
            
          case 'spline_update_object_properties':
            result = await this.objectManager.updateObjectProperties(
              args.sceneId,
              args.objectId,
              args.properties
            );
            break;
            
          case 'spline_set_object_visibility':
            result = await this.objectManager.setObjectVisibility(
              args.sceneId,
              args.objectId,
              args.visible
            );
            break;
            
          case 'spline_create_object':
            result = await this.objectManager.createObject(args.sceneId, {
              name: args.name,
              type: args.type,
              position: args.position,
              rotation: args.rotation,
              scale: args.scale,
              visible: args.visible !== undefined ? args.visible : true,
              properties: args.properties || {},
            });
            break;
            
          case 'spline_delete_object':
            result = await this.objectManager.deleteObject(args.sceneId, args.objectId);
            break;
            
          case 'spline_duplicate_object':
            result = await this.objectManager.duplicateObject(args.sceneId, args.objectId);
            break;

          // Animation Control Tools
          case 'spline_get_animations':
            result = await this.animationManager.getAnimations(args.sceneId);
            break;
            
          case 'spline_play_animation':
            result = await this.animationManager.playAnimation(args.sceneId, args.animationName);
            break;
            
          case 'spline_pause_animation':
            result = await this.animationManager.pauseAnimation(args.sceneId, args.animationName);
            break;
            
          case 'spline_stop_animation':
            result = await this.animationManager.stopAnimation(args.sceneId, args.animationName);
            break;
            
          case 'spline_get_variables':
            result = await this.animationManager.getVariables(args.sceneId);
            break;
            
          case 'spline_get_variable':
            result = await this.animationManager.getVariable(args.sceneId, args.variableName);
            break;
            
          case 'spline_set_variable':
            result = await this.animationManager.setVariable(args.sceneId, {
              name: args.name,
              value: args.value,
              type: args.type,
            });
            break;
            
          case 'spline_create_transition':
            result = await this.animationManager.createTransition(
              args.sceneId,
              args.objectId,
              args.properties,
              args.duration,
              args.easing
            );
            break;

          // Export Tools
          case 'spline_export_scene':
            result = await this.exportManager.exportScene(args.sceneId, {
              format: args.format,
              quality: args.quality || 'medium',
              width: args.width,
              height: args.height,
              fps: args.fps,
              duration: args.duration,
            });
            break;
            
          case 'spline_get_export_status':
            result = await this.exportManager.getExportStatus(args.jobId);
            break;
            
          case 'spline_cancel_export':
            result = await this.exportManager.cancelExport(args.jobId);
            break;
            
          case 'spline_get_export_history':
            result = await this.exportManager.getExportHistory(args.sceneId, args.limit);
            break;
            
          case 'spline_download_export':
            result = await this.exportManager.downloadExport(args.jobId);
            break;
            
          case 'spline_get_preview_image':
            result = await this.exportManager.getPreviewImage(
              args.sceneId,
              args.width || 800,
              args.height || 600
            );
            break;

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        Logger.info('Tool executed successfully', { toolName: name, requestId });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        const errorInfo = ErrorHandler.handle(error);
        Logger.error('Tool execution failed', { 
          toolName: name, 
          requestId, 
          error: errorInfo 
        });

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorInfo.message}`,
          errorInfo
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    Logger.info('Spline MCP Server running on stdio transport');
  }

  async close() {
    Logger.info('Shutting down Spline MCP Server');
    // Add any cleanup logic here
  }
}