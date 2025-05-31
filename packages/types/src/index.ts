/**
 * SermonFlow Types Package
 * 
 * This package exports TypeScript types and interfaces used throughout the SermonFlow application.
 * It includes re-exports from Prisma client, custom API types, and Zod schemas for validation.
 */

import { z } from 'zod';
import type {
  User,
  Sermon,
  Series,
  SermonBlock,
  Template,
  Comment,
  SermonCollaborator,
  SeriesCollaborator,
  AIResearchQuery,
  AIResearchCitation,
  FileAttachment,
  Tag,
  Category,
  ActivityLog,
  Notification,
  UserRole,
  SermonStatus,
  SeriesStatus,
  BlockType,
  CollaboratorRole,
  CitationType,
  NotificationType,
  SermonVersion,
  SermonBlockVersion,
} from '@prisma/client';

// =============================================================================
// RE-EXPORT PRISMA TYPES
// =============================================================================

// Core entity types
export type {
  User,
  Sermon,
  Series,
  SermonBlock,
  Template,
  Comment,
  SermonCollaborator,
  SeriesCollaborator,
  AIResearchQuery,
  AIResearchCitation,
  FileAttachment,
  Tag,
  Category,
  ActivityLog,
  Notification,
  SermonVersion,
  SermonBlockVersion,
};

// Enum types
export type {
  UserRole,
  SermonStatus,
  SeriesStatus,
  BlockType,
  CollaboratorRole,
  CitationType,
  NotificationType,
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Makes all properties in T optional except those in K
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Makes specific properties in T optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Omits the id, createdAt, and updatedAt fields from a type
 */
export type OmitTimestamps<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Creates a type with only the specified keys from T
 */
export type PickKeys<T, K extends keyof T> = Pick<T, K>;

/**
 * Pagination result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// =============================================================================
// AUTHENTICATION & AUTHORIZATION TYPES
// =============================================================================

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  churchName?: string;
  denomination?: string;
}

/**
 * Authentication response with tokens
 */
export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * User profile (safe user data without sensitive fields)
 */
export type UserProfile = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'churchName'
  | 'denomination'
  | 'role'
  | 'bio'
  | 'avatarUrl'
  | 'isEmailVerified'
  | 'createdAt'
>;

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password update request
 */
export interface PasswordUpdateRequest {
  token: string;
  password: string;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  token: string;
}

// =============================================================================
// SERMON EDITOR TYPES
// =============================================================================

/**
 * Sermon creation request
 */
export interface CreateSermonRequest {
  title: string;
  scripture?: string;
  description?: string;
  notes?: string;
  seriesId?: string;
  scheduledDate?: string | Date;
  duration?: number;
  status?: SermonStatus;
  tags?: string[];
  categories?: string[];
}

/**
 * Sermon update request
 */
export type UpdateSermonRequest = Partial<CreateSermonRequest>;

/**
 * Sermon with related data
 */
export interface SermonWithRelations extends Sermon {
  createdBy: UserProfile;
  series?: Series;
  blocks: SermonBlock[];
  collaborators: (SermonCollaborator & { user: UserProfile })[];
  tags: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  fileAttachments?: FileAttachment[];
}

/**
 * Sermon block creation request
 */
export interface CreateSermonBlockRequest {
  sermonId: string;
  parentId?: string;
  type: BlockType;
  content: string;
  order: number;
}

/**
 * Sermon block update request
 */
export type UpdateSermonBlockRequest = Partial<
  Omit<CreateSermonBlockRequest, 'sermonId'>
>;

/**
 * Sermon block with hierarchy
 */
export interface SermonBlockWithChildren extends SermonBlock {
  children: SermonBlockWithChildren[];
}

/**
 * Template creation request
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  structure: TemplateStructure;
  isPublic?: boolean;
  tags?: string[];
  categories?: string[];
}

/**
 * Template structure definition
 */
export interface TemplateStructure {
  blocks: TemplateBlock[];
}

/**
 * Template block definition
 */
export interface TemplateBlock {
  type: BlockType;
  content: string;
  order: number;
  children?: TemplateBlock[];
}

/**
 * Series creation request
 */
export interface CreateSeriesRequest {
  title: string;
  description?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  coverImageUrl?: string;
  status?: SeriesStatus;
  tags?: string[];
  categories?: string[];
}

/**
 * Series update request
 */
export type UpdateSeriesRequest = Partial<CreateSeriesRequest>;

/**
 * Series with related data
 */
export interface SeriesWithRelations extends Series {
  createdBy: UserProfile;
  sermons: Sermon[];
  collaborators: (SeriesCollaborator & { user: UserProfile })[];
  tags: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

// =============================================================================
// AI RESEARCH TYPES
// =============================================================================

/**
 * AI research query request
 */
export interface AIResearchQueryRequest {
  query: string;
  context?: string;
  sermonId?: string;
  maxResults?: number;
}

/**
 * AI research response
 */
export interface AIResearchResponse {
  query: AIResearchQuery;
  results: AIResearchResult[];
}

/**
 * AI research result
 */
export interface AIResearchResult {
  content: string;
  contentType: CitationType;
  sourceUrl?: string;
  sourceTitle?: string;
  relevanceScore?: number;
}

/**
 * AI content suggestion request
 */
export interface AIContentSuggestionRequest {
  sermonId: string;
  blockId?: string;
  type?: BlockType;
  context?: string;
}

/**
 * AI content suggestion
 */
export interface AIContentSuggestion {
  content: string;
  type: BlockType;
  citations: AIResearchCitation[];
}

/**
 * RAG embedding vector
 */
export interface EmbeddingVector {
  id: string;
  content: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
}

// =============================================================================
// COLLABORATION TYPES
// =============================================================================

/**
 * Collaborator invitation request
 */
export interface CollaboratorInviteRequest {
  email: string;
  role: CollaboratorRole;
  entityType: 'sermon' | 'series';
  entityId: string;
  message?: string;
}

/**
 * Collaboration session
 */
export interface CollaborationSession {
  id: string;
  entityType: 'sermon' | 'series';
  entityId: string;
  activeUsers: CollaborationUser[];
  lastActivity: Date;
}

/**
 * Collaboration user
 */
export interface CollaborationUser {
  id: string;
  name: string;
  avatarUrl?: string;
  cursor?: {
    blockId: string;
    position: number;
  };
  lastActivity: Date;
}

/**
 * Real-time collaboration events
 */
export enum CollaborationEvent {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CURSOR_MOVED = 'cursor_moved',
  BLOCK_CREATED = 'block_created',
  BLOCK_UPDATED = 'block_updated',
  BLOCK_DELETED = 'block_deleted',
  COMMENT_ADDED = 'comment_added',
  COMMENT_RESOLVED = 'comment_resolved',
}

/**
 * Collaboration event payload
 */
export interface CollaborationEventPayload<T = unknown> {
  event: CollaborationEvent;
  sessionId: string;
  userId: string;
  timestamp: Date;
  data: T;
}

// =============================================================================
// FILE UPLOAD & MEDIA TYPES
// =============================================================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  file: File;
  entityType?: 'sermon' | 'series' | 'user';
  entityId?: string;
  isPublic?: boolean;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  file: FileAttachment;
  url: string;
}

/**
 * Media type
 */
export enum MediaType {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  OTHER = 'other',
}

/**
 * Media library query params
 */
export interface MediaLibraryQuery extends PaginationParams {
  search?: string;
  type?: MediaType;
  entityType?: 'sermon' | 'series' | 'user';
  entityId?: string;
}

// =============================================================================
// NOTIFICATION & ACTIVITY TYPES
// =============================================================================

/**
 * Notification settings
 */
export interface NotificationSettings {
  email: {
    collaborationInvites: boolean;
    comments: boolean;
    sermonShared: boolean;
    templateShared: boolean;
    reminders: boolean;
    system: boolean;
  };
  inApp: {
    collaborationInvites: boolean;
    comments: boolean;
    sermonShared: boolean;
    templateShared: boolean;
    reminders: boolean;
    system: boolean;
  };
}

/**
 * Activity log query params
 */
export interface ActivityLogQuery extends PaginationParams {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

/**
 * Notification query params
 */
export interface NotificationQuery extends PaginationParams {
  isRead?: boolean;
  type?: NotificationType;
}

// =============================================================================
// SEARCH & FILTERING TYPES
// =============================================================================

/**
 * Search request
 */
export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
}

/**
 * Search filters
 */
export interface SearchFilters {
  entityTypes?: ('sermon' | 'series' | 'template' | 'block')[];
  tags?: string[];
  categories?: string[];
  status?: (SermonStatus | SeriesStatus)[];
  createdBy?: string;
  dateRange?: {
    from?: string | Date;
    to?: string | Date;
  };
}

/**
 * Search result
 */
export interface SearchResult<T = unknown> {
  id: string;
  entityType: string;
  title: string;
  description?: string;
  content?: string;
  matchedFields: string[];
  highlights: { field: string; snippet: string }[];
  score: number;
  entity: T;
}

/**
 * Search response
 */
export interface SearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  facets?: {
    entityTypes?: { key: string; count: number }[];
    tags?: { key: string; count: number }[];
    categories?: { key: string; count: number }[];
    status?: { key: string; count: number }[];
  };
}

// =============================================================================
// ZOD SCHEMAS FOR VALIDATION
// =============================================================================

// User schemas
export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  churchName: z.string().optional(),
  denomination: z.string().optional(),
  role: z.nativeEnum(UserRole),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  isEmailVerified: z.boolean(),
  createdAt: z.date(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  churchName: z.string().optional(),
  denomination: z.string().optional(),
});

// Sermon schemas
export const createSermonSchema = z.object({
  title: z.string().min(1),
  scripture: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  seriesId: z.string().optional(),
  scheduledDate: z.string().or(z.date()).optional(),
  duration: z.number().positive().optional(),
  status: z.nativeEnum(SermonStatus).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export const updateSermonSchema = createSermonSchema.partial();

// Sermon block schemas
export const createSermonBlockSchema = z.object({
  sermonId: z.string(),
  parentId: z.string().optional(),
  type: z.nativeEnum(BlockType),
  content: z.string(),
  order: z.number().int().min(0),
});

export const updateSermonBlockSchema = createSermonBlockSchema
  .omit({ sermonId: true })
  .partial();

// Template schemas
export const templateBlockSchema: z.ZodType<TemplateBlock> = z.lazy(() =>
  z.object({
    type: z.nativeEnum(BlockType),
    content: z.string(),
    order: z.number().int().min(0),
    children: z.array(templateBlockSchema).optional(),
  })
);

export const templateStructureSchema = z.object({
  blocks: z.array(templateBlockSchema),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  structure: templateStructureSchema,
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

// Series schemas
export const createSeriesSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  coverImageUrl: z.string().optional(),
  status: z.nativeEnum(SeriesStatus).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export const updateSeriesSchema = createSeriesSchema.partial();

// AI research schemas
export const aiResearchQuerySchema = z.object({
  query: z.string().min(1),
  context: z.string().optional(),
  sermonId: z.string().optional(),
  maxResults: z.number().positive().optional(),
});

// Collaboration schemas
export const collaboratorInviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(CollaboratorRole),
  entityType: z.enum(['sermon', 'series']),
  entityId: z.string(),
  message: z.string().optional(),
});

// File upload schemas
export const fileUploadSchema = z.object({
  entityType: z.enum(['sermon', 'series', 'user']).optional(),
  entityId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// Search schemas
export const searchFiltersSchema = z.object({
  entityTypes: z
    .array(z.enum(['sermon', 'series', 'template', 'block']))
    .optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  status: z.array(z.union([z.nativeEnum(SermonStatus), z.nativeEnum(SeriesStatus)])).optional(),
  createdBy: z.string().optional(),
  dateRange: z
    .object({
      from: z.string().or(z.date()).optional(),
      to: z.string().or(z.date()).optional(),
    })
    .optional(),
});

export const searchRequestSchema = z.object({
  query: z.string().min(1),
  filters: searchFiltersSchema.optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
