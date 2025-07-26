# Spline MCP Server

A production-ready Model Context Protocol (MCP) server for integrating with Spline 3D design tool. This server provides comprehensive tools for scene management, object manipulation, animation control, and export functionality.

## Features

- **Scene Management**: Create, read, update, delete, and duplicate Spline scenes
- **Object Manipulation**: Control 3D objects with position, rotation, scale, and property updates
- **Animation Control**: Play, pause, stop animations and manage scene variables
- **Export Tools**: Export scenes to various formats (GLTF, OBJ, FBX, images, videos)
- **Production Ready**: Comprehensive error handling, logging, rate limiting, and monitoring
- **Docker Support**: Containerized deployment with Redis caching
- **Type Safety**: Full TypeScript implementation with comprehensive validation

## Installation

### Prerequisites

- Node.js 18+ 
- Redis (optional, for enhanced rate limiting and caching)
- Spline API key

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd spline-mcp-server# spline-mcp-server
