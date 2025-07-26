export interface SplineScene {
  id: string;
  name: string;
  url: string;
  version: string;
  created: Date;
  modified: Date;
  owner: string;
  permissions: SplinePermissions;
}

export interface SplinePermissions {
  read: boolean;
  write: boolean;
  share: boolean;
  admin: boolean;
}

export interface SplineObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'text' | 'spline';
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  visible: boolean;
  properties: Record<string, any>;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SplineAnimation {
  name: string;
  duration: number;
  loop: boolean;
  autoplay: boolean;
  easing: string;
}

export interface SplineVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'color' | 'vector3';
}

export interface SplineExportOptions {
  format: 'gltf' | 'obj' | 'fbx' | 'image' | 'video';
  quality: 'low' | 'medium' | 'high';
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}