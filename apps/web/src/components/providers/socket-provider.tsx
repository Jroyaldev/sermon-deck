'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-provider';
import toast from 'react-hot-toast';
import { 
  CollaborationEvent, 
  CollaborationEventPayload, 
  CollaborationSession,
  CollaborationUser
} from '@sermonflow/types';

// Socket.IO connection URL
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io';

// Connection states
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Socket context interface
interface SocketContextType {
  socket: Socket | null;
  status: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinSession: (entityType: 'sermon' | 'series', entityId: string, displayName?: string) => Promise<void>;
  leaveSession: (entityType: 'sermon' | 'series', entityId: string) => Promise<void>;
  updateCursor: (entityType: 'sermon' | 'series', entityId: string, position: { blockId: string; position: number }) => void;
  editBlock: (entityType: 'sermon' | 'series', entityId: string, blockId: string, operation: { type: 'insert' | 'delete' | 'replace'; position?: number; length?: number; text?: string }) => void;
  createBlock: (entityType: 'sermon', entityId: string, blockData: { parentId?: string; type: string; content: string; order: number }) => void;
  deleteBlock: (entityType: 'sermon', entityId: string, blockId: string) => void;
  addComment: (entityType: 'sermon' | 'series', entityId: string, data: { blockId?: string; content: string }) => void;
  resolveComment: (entityType: 'sermon' | 'series', entityId: string, commentId: string) => void;
  activeSession: CollaborationSession | null;
  activeUsers: CollaborationUser[];
  addEventListener: <T = any>(event: string, handler: (data: T) => void) => () => void;
  error: Error | null;
}

// Create the context with a default value
const SocketContext = createContext<SocketContextType>({
  socket: null,
  status: 'disconnected',
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  joinSession: async () => {},
  leaveSession: async () => {},
  updateCursor: () => {},
  editBlock: () => {},
  createBlock: () => {},
  deleteBlock: () => {},
  addComment: () => {},
  resolveComment: () => {},
  activeSession: null,
  activeUsers: [],
  addEventListener: () => () => {},
  error: null,
});

/**
 * SocketProvider component
 * 
 * Provides Socket.IO connection and real-time collaboration features
 * to the application with authentication integration.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const [activeSession, setActiveSession] = useState<CollaborationSession | null>(null);
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Determine if socket is connected
  const isConnected = status === 'connected';
  
  // Initialize socket connection
  const connect = useCallback(() => {
    if (!isAuthenticated || !user || socket) return;
    
    try {
      setStatus('connecting');
      
      // Get auth token
      const token = localStorage.getItem('sermonflow_auth_token');
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Create socket instance with auth
      const socketInstance = io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        transports: ['websocket', 'polling'],
      });
      
      // Setup event listeners
      socketInstance.on('connect', () => {
        if (!isMounted.current) return;
        
        setStatus('connected');
        setError(null);
        console.log('Socket connected:', socketInstance.id);
      });
      
      socketInstance.on('connect_error', (err) => {
        if (!isMounted.current) return;
        
        console.error('Socket connection error:', err);
        setStatus('error');
        setError(err instanceof Error ? err : new Error('Connection failed'));
        
        // Show error toast
        toast.error('Failed to connect to collaboration service');
      });
      
      socketInstance.on('disconnect', (reason) => {
        if (!isMounted.current) return;
        
        console.log('Socket disconnected:', reason);
        setStatus('disconnected');
        
        // Clear active session on disconnect
        setActiveSession(null);
        setActiveUsers([]);
        
        // Show notification for unexpected disconnects
        if (reason !== 'io client disconnect') {
          toast.error('Disconnected from collaboration service');
        }
      });
      
      socketInstance.on('reconnect', (attemptNumber) => {
        if (!isMounted.current) return;
        
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setStatus('connected');
        setError(null);
        
        // Show success toast
        toast.success('Reconnected to collaboration service');
        
        // Rejoin active session if any
        if (activeSession) {
          socketInstance.emit('join', {
            entityType: activeSession.entityType,
            entityId: activeSession.entityId,
            displayName: `${user.firstName} ${user.lastName}`,
          });
        }
      });
      
      socketInstance.on('reconnect_attempt', (attemptNumber) => {
        if (!isMounted.current) return;
        
        console.log('Socket reconnection attempt:', attemptNumber);
        setStatus('connecting');
      });
      
      socketInstance.on('reconnect_error', (err) => {
        if (!isMounted.current) return;
        
        console.error('Socket reconnection error:', err);
        setStatus('error');
        setError(err instanceof Error ? err : new Error('Reconnection failed'));
      });
      
      socketInstance.on('reconnect_failed', () => {
        if (!isMounted.current) return;
        
        console.error('Socket reconnection failed');
        setStatus('error');
        setError(new Error('Failed to reconnect after multiple attempts'));
        
        // Show error toast
        toast.error('Failed to reconnect to collaboration service');
      });
      
      socketInstance.on('error', (err) => {
        if (!isMounted.current) return;
        
        console.error('Socket error:', err);
        
        // Show error toast with message from server
        if (typeof err === 'object' && err && 'message' in err) {
          toast.error(`Error: ${(err as any).message}`);
        } else {
          toast.error('An error occurred in the collaboration service');
        }
      });
      
      // Handle session data
      socketInstance.on('session', (sessionData: CollaborationSession) => {
        if (!isMounted.current) return;
        
        console.log('Received session data:', sessionData);
        setActiveSession(sessionData);
        setActiveUsers(sessionData.activeUsers);
      });
      
      // Handle collaboration events
      socketInstance.on('collaboration', (payload: CollaborationEventPayload) => {
        if (!isMounted.current) return;
        
        console.log('Collaboration event:', payload.event, payload);
        
        switch (payload.event) {
          case CollaborationEvent.USER_JOINED:
            // Add user to active users
            setActiveUsers(prev => {
              const user = payload.data as CollaborationUser;
              // Avoid duplicates
              if (prev.some(u => u.id === user.id)) {
                return prev;
              }
              return [...prev, user];
            });
            break;
            
          case CollaborationEvent.USER_LEFT:
            // Remove user from active users
            setActiveUsers(prev => 
              prev.filter(u => u.id !== (payload.data as { userId: string }).userId)
            );
            break;
            
          case CollaborationEvent.CURSOR_MOVED:
            // Update user cursor position
            setActiveUsers(prev => {
              const { userId, position } = payload.data as { userId: string; position: { blockId: string; position: number } };
              return prev.map(user => 
                user.id === userId 
                  ? { ...user, cursor: position, lastActivity: new Date() }
                  : user
              );
            });
            break;
            
          // Other events will be handled by specific components
          default:
            break;
        }
      });
      
      setSocket(socketInstance);
    } catch (err) {
      console.error('Error initializing socket:', err);
      setStatus('error');
      setError(err instanceof Error ? err : new Error('Failed to initialize socket'));
      setSocket(null);
    }
  }, [isAuthenticated, user, socket, activeSession]);
  
  // Disconnect socket
  const disconnect = useCallback(() => {
    if (!socket) return;
    
    // Leave active session if any
    if (activeSession) {
      socket.emit('leave', {
        entityType: activeSession.entityType,
        entityId: activeSession.entityId,
      });
    }
    
    // Disconnect socket
    socket.disconnect();
    setSocket(null);
    setStatus('disconnected');
    setActiveSession(null);
    setActiveUsers([]);
  }, [socket, activeSession]);
  
  // Join a collaboration session
  const joinSession = useCallback(async (
    entityType: 'sermon' | 'series',
    entityId: string,
    displayName?: string
  ) => {
    if (!socket || !isConnected) {
      throw new Error('Socket not connected');
    }
    
    return new Promise<void>((resolve, reject) => {
      // Set up one-time error handler for this operation
      const errorHandler = (err: any) => {
        console.error('Error joining session:', err);
        reject(err);
      };
      
      socket.once('error', errorHandler);
      
      // Join the session
      socket.emit('join', {
        entityType,
        entityId,
        displayName: displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      });
      
      // Set up one-time session handler
      socket.once('session', (sessionData: CollaborationSession) => {
        // Remove error handler
        socket.off('error', errorHandler);
        
        // Update session state
        setActiveSession(sessionData);
        setActiveUsers(sessionData.activeUsers);
        
        resolve();
      });
      
      // Set timeout for join operation
      setTimeout(() => {
        socket.off('error', errorHandler);
        reject(new Error('Timeout joining session'));
      }, 10000);
    });
  }, [socket, isConnected, user]);
  
  // Leave a collaboration session
  const leaveSession = useCallback(async (
    entityType: 'sermon' | 'series',
    entityId: string
  ) => {
    if (!socket || !isConnected) {
      return Promise.resolve();
    }
    
    return new Promise<void>((resolve) => {
      // Leave the session
      socket.emit('leave', { entityType, entityId });
      
      // Clear session state
      setActiveSession(null);
      setActiveUsers([]);
      
      resolve();
    });
  }, [socket, isConnected]);
  
  // Update cursor position
  const updateCursor = useCallback((
    entityType: 'sermon' | 'series',
    entityId: string,
    position: { blockId: string; position: number }
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('cursor', { entityType, entityId, position });
  }, [socket, isConnected]);
  
  // Edit block content
  const editBlock = useCallback((
    entityType: 'sermon' | 'series',
    entityId: string,
    blockId: string,
    operation: { type: 'insert' | 'delete' | 'replace'; position?: number; length?: number; text?: string }
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('block:edit', { entityType, entityId, blockId, operation });
  }, [socket, isConnected]);
  
  // Create new block
  const createBlock = useCallback((
    entityType: 'sermon',
    entityId: string,
    blockData: { parentId?: string; type: string; content: string; order: number }
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('block:create', {
      entityType,
      entityId,
      ...blockData,
    });
  }, [socket, isConnected]);
  
  // Delete block
  const deleteBlock = useCallback((
    entityType: 'sermon',
    entityId: string,
    blockId: string
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('block:delete', { entityType, entityId, blockId });
  }, [socket, isConnected]);
  
  // Add comment
  const addComment = useCallback((
    entityType: 'sermon' | 'series',
    entityId: string,
    data: { blockId?: string; content: string }
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('comment:add', {
      entityType,
      entityId,
      ...data,
    });
  }, [socket, isConnected]);
  
  // Resolve comment
  const resolveComment = useCallback((
    entityType: 'sermon' | 'series',
    entityId: string,
    commentId: string
  ) => {
    if (!socket || !isConnected) return;
    
    socket.emit('comment:resolve', { entityType, entityId, commentId });
  }, [socket, isConnected]);
  
  // Add event listener helper
  const addEventListener = useCallback(<T = any>(
    event: string,
    handler: (data: T) => void
  ) => {
    if (!socket) return () => {};
    
    socket.on(event, handler);
    
    // Return cleanup function
    return () => {
      socket.off(event, handler);
    };
  }, [socket]);
  
  // Connect socket when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user && !socket) {
      connect();
    }
    
    // Disconnect when user logs out
    if (!isAuthenticated && socket) {
      disconnect();
    }
  }, [isAuthenticated, user, socket, connect, disconnect]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      if (socket) {
        // Leave active session if any
        if (activeSession) {
          socket.emit('leave', {
            entityType: activeSession.entityType,
            entityId: activeSession.entityId,
          });
        }
        
        // Disconnect socket
        socket.disconnect();
      }
    };
  }, [socket, activeSession]);
  
  // Provide the socket context to children
  return (
    <SocketContext.Provider
      value={{
        socket,
        status,
        isConnected,
        connect,
        disconnect,
        joinSession,
        leaveSession,
        updateCursor,
        editBlock,
        createBlock,
        deleteBlock,
        addComment,
        resolveComment,
        activeSession,
        activeUsers,
        addEventListener,
        error,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Custom hook to use the socket context
 * 
 * @returns SocketContextType
 * @throws Error if used outside of SocketProvider
 */
export const useSocket = () => {
  const context = useContext(SocketContext);
  
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  
  return context;
};

/**
 * Custom hook to join and leave a collaboration session
 * 
 * Automatically joins the session on mount and leaves on unmount
 * 
 * @param entityType Type of entity (sermon or series)
 * @param entityId ID of the entity
 * @param displayName Optional display name for the user
 * @returns SocketContextType with active session data
 */
export const useCollaborationSession = (
  entityType: 'sermon' | 'series',
  entityId: string,
  displayName?: string
) => {
  const socket = useSocket();
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<Error | null>(null);
  
  // Join session on mount
  useEffect(() => {
    if (!entityType || !entityId || !socket.isConnected) return;
    
    const joinSession = async () => {
      try {
        setIsJoining(true);
        setJoinError(null);
        await socket.joinSession(entityType, entityId, displayName);
      } catch (err) {
        console.error('Error joining session:', err);
        setJoinError(err instanceof Error ? err : new Error('Failed to join session'));
      } finally {
        setIsJoining(false);
      }
    };
    
    joinSession();
    
    // Leave session on unmount
    return () => {
      socket.leaveSession(entityType, entityId).catch(err => {
        console.error('Error leaving session:', err);
      });
    };
  }, [socket, entityType, entityId, displayName]);
  
  return {
    ...socket,
    isJoining,
    joinError,
  };
};
