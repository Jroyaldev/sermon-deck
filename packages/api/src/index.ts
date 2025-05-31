/**
 * SermonFlow API Server
 * 
 * Main entry point for the SermonFlow API server.
 * Sets up Express with middleware, database connections, authentication,
 * real-time collaboration, and API routes.
 */

import 'express-async-errors'; // Must be imported before express
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import pino from 'pino';
import pinoHttp from 'pino-http';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import sermonRoutes from './routes/sermons';
import seriesRoutes from './routes/series';
import templateRoutes from './routes/templates';
import researchRoutes from './routes/research';
import collaborationRoutes from './routes/collaboration';
import fileRoutes from './routes/files';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';
import { setupCollaborationHandlers } from './services/collaboration';
import { ApiError } from './utils/errors';

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val, 10)).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val, 10)).default('100'),
  RATE_LIMIT_SKIP_AUTHENTICATED: z.string().transform(val => val === 'true').default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  ENABLE_REQUEST_LOGGING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_QUERY_LOGGING: z.string().transform(val => val === 'true').default('false'),
  ENABLE_REALTIME_COLLAB: z.string().transform(val => val === 'true').default('true'),
  SOCKET_IO_PATH: z.string().default('/socket.io'),
});

// Validate environment variables
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Initialize logger
const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.LOG_FORMAT === 'pretty' 
    ? { target: 'pino-pretty', options: { colorize: true } } 
    : undefined,
});

// Initialize Prisma client
const prisma = new PrismaClient({
  log: env.ENABLE_QUERY_LOGGING 
    ? ['query', 'info', 'warn', 'error'] 
    : ['warn', 'error'],
});

// Initialize Redis client (if configured)
let redis: Redis | null = null;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.info(`Redis connection retry attempt ${times} in ${delay}ms`);
      return delay;
    },
  });
  
  redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });
  
  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });
}

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time collaboration (if enabled)
let io: SocketIOServer | null = null;
if (env.ENABLE_REALTIME_COLLAB) {
  io = new SocketIOServer(server, {
    path: env.SOCKET_IO_PATH,
    cors: {
      origin: env.CORS_ORIGIN === '*' 
        ? true 
        : env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  
  // Setup collaboration handlers
  setupCollaborationHandlers(io, prisma, redis);
  
  logger.info('Real-time collaboration enabled');
}

// Setup Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SermonFlow API',
      version: '0.1.0',
      description: 'API documentation for SermonFlow',
      license: {
        name: 'MIT',
      },
      contact: {
        name: 'SermonFlow Support',
        email: 'support@sermonflow.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/models/*.ts',
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Configure middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for authenticated users if configured
  skip: (req) => env.RATE_LIMIT_SKIP_AUTHENTICATED && req.headers.authorization !== undefined,
});
app.use(limiter);

app.use(compression()); // Compress responses
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Request logging
if (env.ENABLE_REQUEST_LOGGING) {
  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(pinoHttp({ logger }));
  }
}

// Make Prisma and Redis available in request
declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
      redis: Redis | null;
      logger: pino.Logger;
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.prisma = prisma;
  req.redis = redis;
  req.logger = logger.child({ requestId: req.id });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const dbStatus = { ok: true, message: 'Connected' };
  const redisStatus = redis ? { ok: true, message: 'Connected' } : { ok: false, message: 'Not configured' };
  
  // Check database connection
  prisma.$queryRaw`SELECT 1`
    .then(() => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: dbStatus,
        redis: redisStatus,
        version: process.env.npm_package_version || '0.1.0',
      });
    })
    .catch((err) => {
      req.logger.error({ err }, 'Database health check failed');
      dbStatus.ok = false;
      dbStatus.message = 'Connection error';
      
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: dbStatus,
        redis: redisStatus,
        version: process.env.npm_package_version || '0.1.0',
      });
    });
});

// API documentation route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sermons', authenticate, sermonRoutes);
app.use('/api/v1/series', authenticate, seriesRoutes);
app.use('/api/v1/templates', authenticate, templateRoutes);
app.use('/api/v1/research', authenticate, researchRoutes);
app.use('/api/v1/collaboration', authenticate, collaborationRoutes);
app.use('/api/v1/files', authenticate, fileRoutes);
app.use('/api/v1/search', authenticate, searchRoutes);
app.use('/api/v1/notifications', authenticate, notificationRoutes);
app.use('/api/v1/admin', authenticate, adminRoutes);

// Static files for uploads (development only)
if (env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Resource not found'));
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = env.PORT;
const server_instance = server.listen(PORT, () => {
  logger.info(`✅ Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/api/docs`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server_instance.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connection
      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      // Close Redis connection if exists
      if (redis) {
        await redis.quit();
        logger.info('Redis connection closed');
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  gracefulShutdown('unhandledRejection');
});

export { app, server, prisma, redis, logger };
