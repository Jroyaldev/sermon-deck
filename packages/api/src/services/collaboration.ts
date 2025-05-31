/**
 * Real-time Collaboration Service
 * 
 * This service manages real-time collaboration features for SermonFlow,
 * including user presence, cursor tracking, and synchronized editing.
 * It uses Socket.IO for WebSocket communication and Redis for session management.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { 
  CollaborationEvent, 
  CollaborationEventPayload,
  CollaborationSession,
  CollaborationUser,
  UserRole,
  CollaboratorRole,
  SermonStatus
} from '@sermonflow/types';
import { ApiError, ErrorCodes } from '../utils/errors';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Socket authentication data
 */
interface SocketAuth {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * User cursor position
 */
interface CursorPosition {
  blockId: string;
  position: number;
}

/**
 * Block edit operation
 */
interface BlockEditOperation {
  type: 'insert' | 'delete' | 'replace';
  blockId: string;
  position?: number;
  length?: number;
  text?: string;
  userId: string;
  timestamp: number;
}

/**
 * Session metadata
 */
interface SessionMetadata {
  entityType: 'sermon' | 'series';
  entityId: string;
  lastActivity: Date;
  activeUsers: Record<string, CollaborationUser>;
  operations: BlockEditOperation[];
  locks: Record<string, { userId: string; expires: number }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Redis key prefixes
const REDIS_PREFIX = 'sermonflow:collab:';
const SESSION_PREFIX = `${REDIS_PREFIX}session:`;
const USER_SESSIONS_PREFIX = `${REDIS_PREFIX}user:`;
const LOCK_TIMEOUT = 30000; // 30 seconds
const SESSION_EXPIRY = 86400; // 24 hours in seconds
const PRESENCE_UPDATE_INTERVAL = 10000; // 10 seconds
const OPERATIONS_MAX_LENGTH = 100; // Maximum number of operations to keep in memory

// =============================================================================
// LOGGER
// =============================================================================

const logger = pino({
  name: 'collaboration-service',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } } 
    : undefined,
});

// =============================================================================
// COLLABORATION SERVICE
// =============================================================================

/**
 * Setup Socket.IO handlers for real-time collaboration
 * 
 * @param io Socket.IO server instance
 * @param prisma Prisma client instance
 * @param redis Redis client instance
 */
export function setupCollaborationHandlers(
  io: SocketIOServer,
  prisma: PrismaClient,
  redis: Redis | null
): void {
  // Skip setup if real-time collaboration is disabled
  if (process.env.ENABLE_REALTIME_COLLAB === 'false') {
    logger.info('Real-time collaboration is disabled');
    return;
  }

  // Warn if Redis is not available
  if (!redis) {
    logger.warn('Redis is not available. Collaboration features will be limited.');
  }

  // Setup authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth or query
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(
        token as string,
        process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
      ) as { sub: string; email: string; role: UserRole };
      
      // Attach user data to socket
      socket.data.auth = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      logger.error({ error }, 'Socket authentication error');
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket) => {
    const auth = socket.data.auth as SocketAuth;
    
    logger.info({
      userId: auth.userId,
      socketId: socket.id
    }, 'User connected to collaboration service');
    
    // Handle joining a collaboration session
    socket.on('join', async (data: { entityType: 'sermon' | 'series'; entityId: string; displayName?: string }) => {
      try {
        const { entityType, entityId, displayName } = data;
        
        // Validate access permission
        const hasAccess = await checkCollaborationAccess(
          prisma,
          auth.userId,
          entityType,
          entityId
        );
        
        if (!hasAccess) {
          socket.emit('error', {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to access this collaboration session'
          });
          return;
        }
        
        // Create session room ID
        const roomId = `${entityType}:${entityId}`;
        
        // Join the room
        await socket.join(roomId);
        
        // Get user profile
        const user = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true
          }
        });
        
        if (!user) {
          socket.emit('error', {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          });
          return;
        }
        
        // Create collaboration user object
        const collaborationUser: CollaborationUser = {
          id: user.id,
          name: displayName || `${user.firstName} ${user.lastName}`,
          avatarUrl: user.avatarUrl || undefined,
          lastActivity: new Date()
        };
        
        // Store session data in Redis if available
        if (redis) {
          // Get or create session
          const sessionKey = `${SESSION_PREFIX}${roomId}`;
          const sessionData = await redis.get(sessionKey);
          
          let session: SessionMetadata;
          
          if (sessionData) {
            // Update existing session
            session = JSON.parse(sessionData);
            session.activeUsers[auth.userId] = collaborationUser;
            session.lastActivity = new Date();
          } else {
            // Create new session
            session = {
              entityType,
              entityId,
              lastActivity: new Date(),
              activeUsers: {
                [auth.userId]: collaborationUser
              },
              operations: [],
              locks: {}
            };
          }
          
          // Save session data
          await redis.set(
            sessionKey,
            JSON.stringify(session),
            'EX',
            SESSION_EXPIRY
          );
          
          // Add session to user's active sessions
          await redis.sadd(
            `${USER_SESSIONS_PREFIX}${auth.userId}`,
            roomId
          );
          
          // Set expiry on user's sessions set
          await redis.expire(
            `${USER_SESSIONS_PREFIX}${auth.userId}`,
            SESSION_EXPIRY
          );
        }
        
        // Notify room about new user
        const joinPayload: CollaborationEventPayload<CollaborationUser> = {
          event: CollaborationEvent.USER_JOINED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: collaborationUser
        };
        
        socket.to(roomId).emit('collaboration', joinPayload);
        
        // Send current session state to the joining user
        if (redis) {
          const sessionKey = `${SESSION_PREFIX}${roomId}`;
          const sessionData = await redis.get(sessionKey);
          
          if (sessionData) {
            const session: SessionMetadata = JSON.parse(sessionData);
            
            // Convert active users to array
            const activeUsers = Object.values(session.activeUsers);
            
            socket.emit('session', {
              id: roomId,
              entityType,
              entityId,
              activeUsers,
              lastActivity: session.lastActivity
            });
          }
        } else {
          // Without Redis, just send minimal session data
          socket.emit('session', {
            id: roomId,
            entityType,
            entityId,
            activeUsers: [collaborationUser],
            lastActivity: new Date()
          });
        }
        
        logger.info({
          userId: auth.userId,
          socketId: socket.id,
          roomId
        }, 'User joined collaboration session');
      } catch (error) {
        logger.error({ error }, 'Error joining collaboration session');
        socket.emit('error', {
          code: 'JOIN_ERROR',
          message: 'Failed to join collaboration session'
        });
      }
    });
    
    // Handle leaving a collaboration session
    socket.on('leave', async (data: { entityType: 'sermon' | 'series'; entityId: string }) => {
      try {
        const { entityType, entityId } = data;
        const roomId = `${entityType}:${entityId}`;
        
        // Leave the room
        await socket.leave(roomId);
        
        // Update session data in Redis if available
        if (redis) {
          const sessionKey = `${SESSION_PREFIX}${roomId}`;
          const sessionData = await redis.get(sessionKey);
          
          if (sessionData) {
            const session: SessionMetadata = JSON.parse(sessionData);
            
            // Remove user from active users
            if (session.activeUsers[auth.userId]) {
              delete session.activeUsers[auth.userId];
            }
            
            // Remove any locks held by this user
            Object.keys(session.locks).forEach(blockId => {
              if (session.locks[blockId].userId === auth.userId) {
                delete session.locks[blockId];
              }
            });
            
            // Update session data
            if (Object.keys(session.activeUsers).length > 0) {
              // Other users still in session, update it
              await redis.set(
                sessionKey,
                JSON.stringify(session),
                'EX',
                SESSION_EXPIRY
              );
            } else {
              // No users left, remove session
              await redis.del(sessionKey);
            }
            
            // Remove session from user's active sessions
            await redis.srem(
              `${USER_SESSIONS_PREFIX}${auth.userId}`,
              roomId
            );
          }
        }
        
        // Notify room about user leaving
        const leavePayload: CollaborationEventPayload<{ userId: string }> = {
          event: CollaborationEvent.USER_LEFT,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: { userId: auth.userId }
        };
        
        io.to(roomId).emit('collaboration', leavePayload);
        
        logger.info({
          userId: auth.userId,
          socketId: socket.id,
          roomId
        }, 'User left collaboration session');
      } catch (error) {
        logger.error({ error }, 'Error leaving collaboration session');
      }
    });
    
    // Handle cursor position updates
    socket.on('cursor', async (data: { 
      entityType: 'sermon' | 'series';
      entityId: string;
      position: CursorPosition;
    }) => {
      try {
        const { entityType, entityId, position } = data;
        const roomId = `${entityType}:${entityId}`;
        
        // Update user's cursor position in Redis if available
        if (redis) {
          const sessionKey = `${SESSION_PREFIX}${roomId}`;
          const sessionData = await redis.get(sessionKey);
          
          if (sessionData) {
            const session: SessionMetadata = JSON.parse(sessionData);
            
            if (session.activeUsers[auth.userId]) {
              session.activeUsers[auth.userId].cursor = position;
              session.activeUsers[auth.userId].lastActivity = new Date();
              
              await redis.set(
                sessionKey,
                JSON.stringify(session),
                'EX',
                SESSION_EXPIRY
              );
            }
          }
        }
        
        // Broadcast cursor position to other users in the room
        const cursorPayload: CollaborationEventPayload<{
          userId: string;
          position: CursorPosition;
        }> = {
          event: CollaborationEvent.CURSOR_MOVED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: {
            userId: auth.userId,
            position
          }
        };
        
        socket.to(roomId).emit('collaboration', cursorPayload);
      } catch (error) {
        logger.error({ error }, 'Error updating cursor position');
      }
    });
    
    // Handle block edit operations
    socket.on('block:edit', async (data: {
      entityType: 'sermon' | 'series';
      entityId: string;
      blockId: string;
      operation: Omit<BlockEditOperation, 'userId' | 'timestamp'>;
    }) => {
      try {
        const { entityType, entityId, blockId, operation } = data;
        const roomId = `${entityType}:${entityId}`;
        
        // Check if block is locked by another user
        if (redis) {
          const sessionKey = `${SESSION_PREFIX}${roomId}`;
          const sessionData = await redis.get(sessionKey);
          
          if (sessionData) {
            const session: SessionMetadata = JSON.parse(sessionData);
            
            // Check if block is locked
            if (
              session.locks[blockId] &&
              session.locks[blockId].userId !== auth.userId &&
              session.locks[blockId].expires > Date.now()
            ) {
              // Block is locked by another user
              socket.emit('error', {
                code: 'BLOCK_LOCKED',
                message: 'This block is currently being edited by another user',
                details: {
                  blockId,
                  lockedBy: session.locks[blockId].userId
                }
              });
              return;
            }
            
            // Lock the block for this user
            session.locks[blockId] = {
              userId: auth.userId,
              expires: Date.now() + LOCK_TIMEOUT
            };
            
            // Add operation to history
            const fullOperation: BlockEditOperation = {
              ...operation,
              blockId,
              userId: auth.userId,
              timestamp: Date.now()
            };
            
            session.operations.push(fullOperation);
            
            // Limit operations history length
            if (session.operations.length > OPERATIONS_MAX_LENGTH) {
              session.operations = session.operations.slice(-OPERATIONS_MAX_LENGTH);
            }
            
            // Update session
            await redis.set(
              sessionKey,
              JSON.stringify(session),
              'EX',
              SESSION_EXPIRY
            );
          }
        }
        
        // Apply the edit to the database
        try {
          // For insert/delete operations, we need to get the current content first
          const block = await prisma.sermonBlock.findUnique({
            where: { id: blockId }
          });
          
          if (!block) {
            throw new Error(`Block not found: ${blockId}`);
          }
          
          let newContent = block.content;
          
          switch (operation.type) {
            case 'insert':
              if (operation.position !== undefined && operation.text) {
                newContent = 
                  newContent.substring(0, operation.position) +
                  operation.text +
                  newContent.substring(operation.position);
              }
              break;
              
            case 'delete':
              if (operation.position !== undefined && operation.length) {
                newContent = 
                  newContent.substring(0, operation.position) +
                  newContent.substring(operation.position + operation.length);
              }
              break;
              
            case 'replace':
              if (operation.text !== undefined) {
                newContent = operation.text;
              }
              break;
          }
          
          // Update the block content
          await prisma.sermonBlock.update({
            where: { id: blockId },
            data: { 
              content: newContent,
              updatedAt: new Date()
            }
          });
          
          // Create a version history entry
          await prisma.sermonBlockVersion.create({
            data: {
              blockId,
              content: newContent,
              createdById: auth.userId
            }
          });
          
          // Broadcast the edit to other users in the room
          const editPayload: CollaborationEventPayload<{
            blockId: string;
            operation: BlockEditOperation;
            content: string;
          }> = {
            event: CollaborationEvent.BLOCK_UPDATED,
            sessionId: roomId,
            userId: auth.userId,
            timestamp: new Date(),
            data: {
              blockId,
              operation: {
                ...operation,
                blockId,
                userId: auth.userId,
                timestamp: Date.now()
              },
              content: newContent
            }
          };
          
          io.to(roomId).emit('collaboration', editPayload);
          
          logger.info({
            userId: auth.userId,
            roomId,
            blockId,
            operationType: operation.type
          }, 'Block edit operation applied');
        } catch (error) {
          logger.error({ error }, 'Error applying block edit to database');
          
          // Notify user of the error
          socket.emit('error', {
            code: 'EDIT_ERROR',
            message: 'Failed to apply edit operation',
            details: {
              blockId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
          
          // Release the lock
          if (redis) {
            const sessionKey = `${SESSION_PREFIX}${roomId}`;
            const sessionData = await redis.get(sessionKey);
            
            if (sessionData) {
              const session: SessionMetadata = JSON.parse(sessionData);
              
              if (session.locks[blockId]?.userId === auth.userId) {
                delete session.locks[blockId];
                
                await redis.set(
                  sessionKey,
                  JSON.stringify(session),
                  'EX',
                  SESSION_EXPIRY
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error processing block edit operation');
        socket.emit('error', {
          code: 'EDIT_ERROR',
          message: 'Failed to process edit operation'
        });
      }
    });
    
    // Handle block creation
    socket.on('block:create', async (data: {
      entityType: 'sermon';
      entityId: string;
      parentId?: string;
      type: string;
      content: string;
      order: number;
    }) => {
      try {
        const { entityType, entityId, parentId, type, content, order } = data;
        
        if (entityType !== 'sermon') {
          throw new Error('Block creation is only supported for sermons');
        }
        
        const roomId = `${entityType}:${entityId}`;
        
        // Create the block in the database
        const newBlock = await prisma.sermonBlock.create({
          data: {
            sermonId: entityId,
            parentId,
            type: type as any,
            content,
            order,
            createdById: auth.userId
          }
        });
        
        // Broadcast the new block to all users in the room
        const createPayload: CollaborationEventPayload<{
          block: {
            id: string;
            sermonId: string;
            parentId?: string;
            type: string;
            content: string;
            order: number;
            createdById: string;
            createdAt: Date;
            updatedAt: Date;
          };
        }> = {
          event: CollaborationEvent.BLOCK_CREATED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: {
            block: {
              id: newBlock.id,
              sermonId: newBlock.sermonId,
              parentId: newBlock.parentId || undefined,
              type: newBlock.type,
              content: newBlock.content,
              order: newBlock.order,
              createdById: newBlock.createdById,
              createdAt: newBlock.createdAt,
              updatedAt: newBlock.updatedAt
            }
          }
        };
        
        io.to(roomId).emit('collaboration', createPayload);
        
        logger.info({
          userId: auth.userId,
          roomId,
          blockId: newBlock.id,
          blockType: type
        }, 'New block created');
      } catch (error) {
        logger.error({ error }, 'Error creating new block');
        socket.emit('error', {
          code: 'CREATE_ERROR',
          message: 'Failed to create new block'
        });
      }
    });
    
    // Handle block deletion
    socket.on('block:delete', async (data: {
      entityType: 'sermon';
      entityId: string;
      blockId: string;
    }) => {
      try {
        const { entityType, entityId, blockId } = data;
        
        if (entityType !== 'sermon') {
          throw new Error('Block deletion is only supported for sermons');
        }
        
        const roomId = `${entityType}:${entityId}`;
        
        // Check if block exists and user has permission
        const block = await prisma.sermonBlock.findUnique({
          where: { id: blockId },
          include: {
            sermon: {
              select: {
                createdById: true,
                collaborators: {
                  where: { userId: auth.userId },
                  select: { role: true }
                }
              }
            }
          }
        });
        
        if (!block) {
          throw new Error(`Block not found: ${blockId}`);
        }
        
        // Check permissions
        const isCreator = block.sermon.createdById === auth.userId;
        const isEditor = block.sermon.collaborators.some(c => 
          c.role === CollaboratorRole.EDITOR
        );
        
        if (!isCreator && !isEditor && auth.role !== UserRole.ADMIN) {
          throw new Error('You do not have permission to delete this block');
        }
        
        // Delete the block
        await prisma.sermonBlock.delete({
          where: { id: blockId }
        });
        
        // Broadcast the deletion to all users in the room
        const deletePayload: CollaborationEventPayload<{
          blockId: string;
        }> = {
          event: CollaborationEvent.BLOCK_DELETED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: {
            blockId
          }
        };
        
        io.to(roomId).emit('collaboration', deletePayload);
        
        logger.info({
          userId: auth.userId,
          roomId,
          blockId
        }, 'Block deleted');
      } catch (error) {
        logger.error({ error }, 'Error deleting block');
        socket.emit('error', {
          code: 'DELETE_ERROR',
          message: 'Failed to delete block',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Handle comment creation
    socket.on('comment:add', async (data: {
      entityType: 'sermon' | 'series';
      entityId: string;
      blockId?: string;
      content: string;
    }) => {
      try {
        const { entityType, entityId, blockId, content } = data;
        const roomId = `${entityType}:${entityId}`;
        
        // Create the comment in the database
        const comment = await prisma.comment.create({
          data: {
            content,
            createdById: auth.userId,
            ...(entityType === 'sermon' ? { sermonId: entityId } : {}),
            ...(blockId ? { blockId } : {})
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        });
        
        // Broadcast the comment to all users in the room
        const commentPayload: CollaborationEventPayload<{
          comment: {
            id: string;
            content: string;
            createdAt: Date;
            createdBy: {
              id: string;
              firstName: string;
              lastName: string;
              avatarUrl: string | null;
            };
            sermonId?: string;
            blockId?: string;
          };
        }> = {
          event: CollaborationEvent.COMMENT_ADDED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: {
            comment: {
              id: comment.id,
              content: comment.content,
              createdAt: comment.createdAt,
              createdBy: comment.createdBy,
              sermonId: comment.sermonId || undefined,
              blockId: comment.blockId || undefined
            }
          }
        };
        
        io.to(roomId).emit('collaboration', commentPayload);
        
        // Create notifications for other collaborators
        if (entityType === 'sermon') {
          const sermon = await prisma.sermon.findUnique({
            where: { id: entityId },
            include: {
              collaborators: {
                include: {
                  user: true
                }
              },
              createdBy: true
            }
          });
          
          if (sermon) {
            // Notify all collaborators except the comment author
            const usersToNotify = [
              ...sermon.collaborators.map(c => c.user),
              sermon.createdBy
            ].filter(user => user.id !== auth.userId);
            
            for (const user of usersToNotify) {
              await prisma.notification.create({
                data: {
                  userId: user.id,
                  type: 'COMMENT',
                  message: `New comment from ${comment.createdBy.firstName} ${comment.createdBy.lastName} on "${sermon.title}"`,
                  entityType: 'comment',
                  entityId: comment.id
                }
              });
            }
          }
        }
        
        logger.info({
          userId: auth.userId,
          roomId,
          commentId: comment.id,
          blockId
        }, 'New comment added');
      } catch (error) {
        logger.error({ error }, 'Error adding comment');
        socket.emit('error', {
          code: 'COMMENT_ERROR',
          message: 'Failed to add comment'
        });
      }
    });
    
    // Handle comment resolution
    socket.on('comment:resolve', async (data: {
      entityType: 'sermon' | 'series';
      entityId: string;
      commentId: string;
    }) => {
      try {
        const { entityType, entityId, commentId } = data;
        const roomId = `${entityType}:${entityId}`;
        
        // Update the comment in the database
        const comment = await prisma.comment.update({
          where: { id: commentId },
          data: {
            resolved: true
          }
        });
        
        // Broadcast the resolution to all users in the room
        const resolvePayload: CollaborationEventPayload<{
          commentId: string;
          resolvedBy: string;
        }> = {
          event: CollaborationEvent.COMMENT_RESOLVED,
          sessionId: roomId,
          userId: auth.userId,
          timestamp: new Date(),
          data: {
            commentId,
            resolvedBy: auth.userId
          }
        };
        
        io.to(roomId).emit('collaboration', resolvePayload);
        
        logger.info({
          userId: auth.userId,
          roomId,
          commentId
        }, 'Comment resolved');
      } catch (error) {
        logger.error({ error }, 'Error resolving comment');
        socket.emit('error', {
          code: 'RESOLVE_ERROR',
          message: 'Failed to resolve comment'
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        logger.info({
          userId: auth.userId,
          socketId: socket.id
        }, 'User disconnected from collaboration service');
        
        if (redis) {
          // Get user's active sessions
          const userSessionsKey = `${USER_SESSIONS_PREFIX}${auth.userId}`;
          const activeSessions = await redis.smembers(userSessionsKey);
          
          // Update each session to remove the user
          for (const roomId of activeSessions) {
            const sessionKey = `${SESSION_PREFIX}${roomId}`;
            const sessionData = await redis.get(sessionKey);
            
            if (sessionData) {
              const session: SessionMetadata = JSON.parse(sessionData);
              
              // Remove user from active users
              if (session.activeUsers[auth.userId]) {
                delete session.activeUsers[auth.userId];
              }
              
              // Remove any locks held by this user
              Object.keys(session.locks).forEach(blockId => {
                if (session.locks[blockId].userId === auth.userId) {
                  delete session.locks[blockId];
                }
              });
              
              // Update session data
              if (Object.keys(session.activeUsers).length > 0) {
                // Other users still in session, update it
                await redis.set(
                  sessionKey,
                  JSON.stringify(session),
                  'EX',
                  SESSION_EXPIRY
                );
                
                // Notify room about user leaving
                const leavePayload: CollaborationEventPayload<{ userId: string }> = {
                  event: CollaborationEvent.USER_LEFT,
                  sessionId: roomId,
                  userId: auth.userId,
                  timestamp: new Date(),
                  data: { userId: auth.userId }
                };
                
                io.to(roomId).emit('collaboration', leavePayload);
              } else {
                // No users left, remove session
                await redis.del(sessionKey);
              }
            }
          }
          
          // Clear user's sessions set
          await redis.del(userSessionsKey);
        }
      } catch (error) {
        logger.error({ error }, 'Error handling socket disconnect');
      }
    });
  });
  
  // Setup periodic cleanup of stale sessions and locks
  if (redis) {
    setInterval(async () => {
      try {
        // Get all session keys
        const sessionKeys = await redis.keys(`${SESSION_PREFIX}*`);
        
        for (const sessionKey of sessionKeys) {
          const sessionData = await redis.get(sessionKey);
          
          if (sessionData) {
            const session: SessionMetadata = JSON.parse(sessionData);
            
            // Clean up expired locks
            let lockUpdated = false;
            Object.keys(session.locks).forEach(blockId => {
              if (session.locks[blockId].expires < Date.now()) {
                delete session.locks[blockId];
                lockUpdated = true;
              }
            });
            
            // Update session if locks were removed
            if (lockUpdated) {
              await redis.set(
                sessionKey,
                JSON.stringify(session),
                'EX',
                SESSION_EXPIRY
              );
            }
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error in session cleanup');
      }
    }, 60000); // Run every minute
  }
  
  logger.info('Collaboration service initialized');
}

/**
 * Check if a user has access to a collaboration session
 * 
 * @param prisma Prisma client instance
 * @param userId User ID
 * @param entityType Entity type (sermon or series)
 * @param entityId Entity ID
 * @returns Whether the user has access
 */
async function checkCollaborationAccess(
  prisma: PrismaClient,
  userId: string,
  entityType: 'sermon' | 'series',
  entityId: string
): Promise<boolean> {
  try {
    if (entityType === 'sermon') {
      // Check sermon access
      const sermon = await prisma.sermon.findUnique({
        where: { id: entityId },
        include: {
          collaborators: {
            where: { userId }
          }
        }
      });
      
      if (!sermon) {
        return false;
      }
      
      // User is the creator or a collaborator
      return sermon.createdById === userId || sermon.collaborators.length > 0;
    } else if (entityType === 'series') {
      // Check series access
      const series = await prisma.series.findUnique({
        where: { id: entityId },
        include: {
          collaborators: {
            where: { userId }
          }
        }
      });
      
      if (!series) {
        return false;
      }
      
      // User is the creator or a collaborator
      return series.createdById === userId || series.collaborators.length > 0;
    }
    
    return false;
  } catch (error) {
    logger.error({ error }, 'Error checking collaboration access');
    return false;
  }
}

/**
 * Get active collaboration sessions
 * 
 * @param redis Redis client instance
 * @returns List of active sessions
 */
export async function getActiveSessions(
  redis: Redis | null
): Promise<CollaborationSession[]> {
  if (!redis) {
    return [];
  }
  
  try {
    // Get all session keys
    const sessionKeys = await redis.keys(`${SESSION_PREFIX}*`);
    const sessions: CollaborationSession[] = [];
    
    for (const sessionKey of sessionKeys) {
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const session: SessionMetadata = JSON.parse(sessionData);
        
        // Extract entity type and ID from key
        const keyParts = sessionKey.replace(SESSION_PREFIX, '').split(':');
        const entityType = keyParts[0] as 'sermon' | 'series';
        const entityId = keyParts[1];
        
        sessions.push({
          id: `${entityType}:${entityId}`,
          entityType,
          entityId,
          activeUsers: Object.values(session.activeUsers),
          lastActivity: new Date(session.lastActivity)
        });
      }
    }
    
    return sessions;
  } catch (error) {
    logger.error({ error }, 'Error getting active sessions');
    return [];
  }
}

/**
 * Get active users for a specific session
 * 
 * @param redis Redis client instance
 * @param entityType Entity type (sermon or series)
 * @param entityId Entity ID
 * @returns List of active users
 */
export async function getSessionUsers(
  redis: Redis | null,
  entityType: 'sermon' | 'series',
  entityId: string
): Promise<CollaborationUser[]> {
  if (!redis) {
    return [];
  }
  
  try {
    const roomId = `${entityType}:${entityId}`;
    const sessionKey = `${SESSION_PREFIX}${roomId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session: SessionMetadata = JSON.parse(sessionData);
      return Object.values(session.activeUsers);
    }
    
    return [];
  } catch (error) {
    logger.error({ error }, 'Error getting session users');
    return [];
  }
}

/**
 * Shutdown the collaboration service
 * 
 * @param io Socket.IO server instance
 */
export async function shutdownCollaborationService(
  io: SocketIOServer
): Promise<void> {
  try {
    // Disconnect all clients
    const sockets = await io.fetchSockets();
    
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    
    // Close Socket.IO server
    io.close();
    
    logger.info('Collaboration service shutdown complete');
  } catch (error) {
    logger.error({ error }, 'Error during collaboration service shutdown');
  }
}
