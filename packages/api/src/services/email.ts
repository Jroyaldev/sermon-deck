/**
 * Email Service
 * 
 * A comprehensive email service for SermonFlow that handles all email communications.
 * Features include templating, queuing, rate limiting, and robust error handling.
 */

import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { createTransport } from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import { Queue, QueueScheduler, Worker } from 'bullmq';
import Redis from 'ioredis';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import pino from 'pino';
import { promisify } from 'util';
import { ApiError, ErrorCodes } from '../utils/errors';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Email template names
 */
export enum EmailTemplate {
  WELCOME = 'welcome',
  EMAIL_VERIFICATION = 'email-verification',
  PASSWORD_RESET = 'password-reset',
  PASSWORD_CHANGED = 'password-changed',
  COLLABORATION_INVITE = 'collaboration-invite',
  SERMON_SHARED = 'sermon-shared',
  TEMPLATE_SHARED = 'template-shared',
  COMMENT_NOTIFICATION = 'comment-notification',
}

/**
 * Email message configuration
 */
export interface EmailMessage {
  /** Recipient email address */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** Template name to use */
  template: EmailTemplate | string;
  /** Context data for template rendering */
  context: Record<string, any>;
  /** Optional CC recipients */
  cc?: string | string[];
  /** Optional BCC recipients */
  bcc?: string | string[];
  /** Optional reply-to address */
  replyTo?: string;
  /** Optional from name override */
  fromName?: string;
  /** Optional from email override */
  fromEmail?: string;
  /** Optional attachments */
  attachments?: EmailAttachment[];
  /** Optional priority (1 = highest, 5 = lowest) */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** Optional tracking ID for logs */
  trackingId?: string;
}

/**
 * Email attachment configuration
 */
export interface EmailAttachment {
  /** Filename to display in the email */
  filename: string;
  /** Content type (e.g., application/pdf) */
  contentType: string;
  /** Content as string, Buffer, or path to file */
  content: string | Buffer | NodeJS.ReadableStream;
}

/**
 * Email queue job data
 */
interface EmailJob {
  /** Email message configuration */
  message: EmailMessage;
  /** Number of retry attempts */
  attempts: number;
}

/**
 * Email template cache entry
 */
interface TemplateCache {
  /** Compiled HTML template */
  html: HandlebarsTemplateDelegate;
  /** Compiled text template */
  text: HandlebarsTemplateDelegate;
  /** Last modified timestamp */
  lastModified: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(val => parseInt(val, 10)).default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().default('SermonFlow'),
  REDIS_URL: z.string().optional(),
  EMAIL_TEMPLATE_PATH: z.string().default('./src/templates/emails'),
  EMAIL_QUEUE_NAME: z.string().default('email-queue'),
  EMAIL_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).default('100'),
  EMAIL_RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val, 10)).default('3600'),
  EMAIL_MAX_RETRIES: z.string().transform(val => parseInt(val, 10)).default('3'),
  EMAIL_RETRY_DELAY: z.string().transform(val => parseInt(val, 10)).default('60000'),
});

// Parse environment variables
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid email service environment variables:', error);
  throw error;
}

// Initialize logger
const logger = pino({
  name: 'email-service',
  level: process.env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } } 
    : undefined,
});

// =============================================================================
// TEMPLATE SYSTEM
// =============================================================================

// Template cache to avoid reading files on every email
const templateCache = new Map<string, TemplateCache>();

/**
 * Register Handlebars helpers for email templates
 */
function registerHandlebarsHelpers() {
  // Format date helper
  handlebars.registerHelper('formatDate', function(date: Date | string, format?: string) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'Invalid date';
    }
    
    // Default format: Month Day, Year
    if (!format) {
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      return d.toLocaleDateString('en-US', options);
    }
    
    // Custom format using tokens
    return format
      .replace('YYYY', d.getFullYear().toString())
      .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', d.getDate().toString().padStart(2, '0'))
      .replace('HH', d.getHours().toString().padStart(2, '0'))
      .replace('mm', d.getMinutes().toString().padStart(2, '0'))
      .replace('ss', d.getSeconds().toString().padStart(2, '0'));
  });
  
  // Conditional helper
  handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
    switch (operator) {
      case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default: return options.inverse(this);
    }
  });
  
  // URL encode helper
  handlebars.registerHelper('urlEncode', function(text) {
    return encodeURIComponent(text);
  });
  
  // String truncation helper
  handlebars.registerHelper('truncate', function(text, length) {
    if (text.length <= length) {
      return text;
    }
    return text.substring(0, length) + '...';
  });
}

// Register helpers on module load
registerHandlebarsHelpers();

/**
 * Load and compile email templates
 * @param templateName Name of the template to load
 * @returns Compiled HTML and text templates
 */
async function loadTemplate(templateName: string): Promise<TemplateCache> {
  // Check if template is in cache and up to date
  const templateDir = path.resolve(process.cwd(), env.EMAIL_TEMPLATE_PATH);
  const htmlPath = path.join(templateDir, `${templateName}.html`);
  const textPath = path.join(templateDir, `${templateName}.txt`);
  
  try {
    // Get file stats to check last modified time
    const [htmlStat, textStat] = await Promise.all([
      fs.stat(htmlPath),
      fs.stat(textPath),
    ]);
    
    const lastModified = Math.max(
      htmlStat.mtimeMs,
      textStat.mtimeMs
    );
    
    // Check if we have a cached version that's still valid
    const cached = templateCache.get(templateName);
    if (cached && cached.lastModified >= lastModified) {
      return cached;
    }
    
    // Load and compile templates
    const [htmlSource, textSource] = await Promise.all([
      fs.readFile(htmlPath, 'utf8'),
      fs.readFile(textPath, 'utf8'),
    ]);
    
    const compiled = {
      html: handlebars.compile(htmlSource),
      text: handlebars.compile(textSource),
      lastModified,
    };
    
    // Cache the compiled templates
    templateCache.set(templateName, compiled);
    
    return compiled;
  } catch (error) {
    logger.error({ error, templateName }, 'Failed to load email template');
    
    // Fallback to a basic template if the requested one doesn't exist
    return {
      html: handlebars.compile('<html><body><h1>{{subject}}</h1><p>{{message}}</p></body></html>'),
      text: handlebars.compile('{{subject}}\n\n{{message}}'),
      lastModified: Date.now(),
    };
  }
}

/**
 * Render an email template with context data
 * @param templateName Name of the template to render
 * @param context Context data for template rendering
 * @returns Rendered HTML and text content
 */
async function renderTemplate(
  templateName: string,
  context: Record<string, any>
): Promise<{ html: string; text: string }> {
  try {
    // Load and compile the template
    const template = await loadTemplate(templateName);
    
    // Sanitize context data to prevent XSS
    const sanitizedContext = sanitizeContext(context);
    
    // Render both HTML and text versions
    const html = template.html(sanitizedContext);
    const text = template.text(sanitizedContext);
    
    return { html, text };
  } catch (error) {
    logger.error({ error, templateName }, 'Failed to render email template');
    
    // Fallback to a basic email if rendering fails
    const subject = context.subject || 'Important message from SermonFlow';
    const message = context.message || 'Please contact support for assistance.';
    
    return {
      html: `<html><body><h1>${subject}</h1><p>${message}</p></body></html>`,
      text: `${subject}\n\n${message}`,
    };
  }
}

/**
 * Sanitize context data to prevent XSS in templates
 * @param context Context data to sanitize
 * @returns Sanitized context data
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      // Sanitize HTML content in strings
      sanitized[key] = sanitizeHtml(value, {
        allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        allowedAttributes: {
          'a': ['href', 'target', 'rel'],
        },
        disallowedTagsMode: 'escape',
      });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeContext(value);
    } else {
      // Pass through non-string values
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// =============================================================================
// EMAIL TRANSPORT
// =============================================================================

// Nodemailer transporter instance
let transporter: Transporter | null = null;

/**
 * Initialize the email transporter
 */
async function initializeTransporter(): Promise<Transporter> {
  // If we already have a transporter, return it
  if (transporter) {
    return transporter;
  }
  
  // In development mode without SMTP config, use ethereal.email
  if (env.NODE_ENV === 'development' && !env.SMTP_HOST) {
    logger.info('Creating test account with Ethereal Email');
    const testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    logger.info(
      { user: testAccount.user, pass: testAccount.pass },
      'Created test email account. View emails at https://ethereal.email'
    );
    
    return transporter;
  }
  
  // Use configured SMTP server
  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASSWORD ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      } : undefined,
    });
    
    // Verify the connection
    try {
      await transporter.verify();
      logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP connection verified');
    } catch (error) {
      logger.error({ error }, 'Failed to verify SMTP connection');
      throw new ApiError(
        500,
        'Failed to initialize email service',
        ErrorCodes.EMAIL_SERVICE_ERROR,
        { message: 'SMTP connection failed' }
      );
    }
    
    return transporter;
  }
  
  // Fallback to console transport for development
  transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
  
  logger.warn('Using console transport for emails. No actual emails will be sent.');
  
  return transporter;
}

// =============================================================================
// EMAIL QUEUE SYSTEM
// =============================================================================

// Queue instances
let emailQueue: Queue<EmailJob> | null = null;
let emailQueueScheduler: QueueScheduler | null = null;
let emailQueueWorker: Worker<EmailJob> | null = null;

/**
 * Initialize the email queue system
 */
async function initializeQueue(): Promise<Queue<EmailJob>> {
  // If queue is already initialized, return it
  if (emailQueue) {
    return emailQueue;
  }
  
  // If Redis URL is not provided, return null (queue disabled)
  if (!env.REDIS_URL) {
    logger.warn('Redis URL not provided. Email queue disabled.');
    return null;
  }
  
  try {
    // Create Redis connection
    const connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    
    // Create queue
    emailQueue = new Queue<EmailJob>(env.EMAIL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: env.EMAIL_MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: env.EMAIL_RETRY_DELAY,
        },
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs
      },
    });
    
    // Create scheduler for delayed jobs and retries
    emailQueueScheduler = new QueueScheduler(env.EMAIL_QUEUE_NAME, {
      connection,
    });
    
    // Create worker to process email jobs
    emailQueueWorker = new Worker<EmailJob>(
      env.EMAIL_QUEUE_NAME,
      async (job) => {
        const { message, attempts } = job.data;
        
        logger.info(
          { 
            jobId: job.id, 
            to: message.to, 
            subject: message.subject, 
            template: message.template,
            attempt: attempts + 1,
            trackingId: message.trackingId,
          },
          'Processing email job'
        );
        
        try {
          // Send the email directly
          await sendEmailDirectly(message);
          
          logger.info(
            { 
              jobId: job.id, 
              to: message.to, 
              trackingId: message.trackingId 
            },
            'Email sent successfully'
          );
          
          return { success: true, sentAt: new Date() };
        } catch (error) {
          // Log the error
          logger.error(
            { 
              error, 
              jobId: job.id, 
              to: message.to, 
              subject: message.subject,
              attempt: attempts + 1,
              trackingId: message.trackingId,
            },
            'Failed to send email'
          );
          
          // Update job data for the next attempt
          await job.updateData({
            message,
            attempts: attempts + 1,
          });
          
          // Rethrow to trigger retry
          throw error;
        }
      },
      { connection, concurrency: 5 }
    );
    
    // Handle worker events
    emailQueueWorker.on('completed', (job) => {
      logger.debug(
        { jobId: job.id, trackingId: job.data.message.trackingId },
        'Email job completed'
      );
    });
    
    emailQueueWorker.on('failed', (job, error) => {
      const attempts = job ? job.data.attempts : 0;
      const maxRetries = env.EMAIL_MAX_RETRIES;
      
      if (attempts >= maxRetries) {
        logger.error(
          { 
            error, 
            jobId: job?.id, 
            to: job?.data.message.to,
            trackingId: job?.data.message.trackingId,
          },
          `Email delivery failed after ${maxRetries} attempts`
        );
      }
    });
    
    // Log queue initialization
    logger.info(
      { queueName: env.EMAIL_QUEUE_NAME },
      'Email queue initialized'
    );
    
    return emailQueue;
  } catch (error) {
    logger.error(
      { error },
      'Failed to initialize email queue'
    );
    
    throw new ApiError(
      500,
      'Failed to initialize email service',
      ErrorCodes.EMAIL_SERVICE_ERROR,
      { message: 'Queue initialization failed' }
    );
  }
}

/**
 * Add an email to the queue
 * @param message Email message configuration
 * @returns Job ID if queued, or null if sent directly
 */
async function queueEmail(message: EmailMessage): Promise<string | null> {
  try {
    // Initialize queue if needed
    const queue = await initializeQueue();
    
    // If queue is disabled, send directly
    if (!queue) {
      await sendEmailDirectly(message);
      return null;
    }
    
    // Generate tracking ID if not provided
    const trackingId = message.trackingId || generateTrackingId();
    const messageWithTracking = { ...message, trackingId };
    
    // Add to queue
    const job = await queue.add(
      'send-email',
      { message: messageWithTracking, attempts: 0 },
      {
        priority: message.priority ? 6 - message.priority : 3, // Convert 1-5 to 5-1 (higher number = higher priority)
        jobId: trackingId,
      }
    );
    
    logger.info(
      { 
        jobId: job.id, 
        to: message.to, 
        subject: message.subject,
        template: message.template,
        trackingId,
      },
      'Email added to queue'
    );
    
    return job.id;
  } catch (error) {
    logger.error(
      { 
        error, 
        to: message.to, 
        subject: message.subject,
        template: message.template,
      },
      'Failed to queue email'
    );
    
    // Fallback to direct sending
    try {
      await sendEmailDirectly(message);
      return null;
    } catch (sendError) {
      logger.error(
        { error: sendError },
        'Failed to send email directly after queue failure'
      );
      
      throw new ApiError(
        500,
        'Failed to send email',
        ErrorCodes.EMAIL_SERVICE_ERROR,
        { message: 'Both queue and direct send failed' }
      );
    }
  }
}

/**
 * Generate a unique tracking ID for email
 */
function generateTrackingId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Send an email directly without queuing
 * @param message Email message configuration
 */
async function sendEmailDirectly(message: EmailMessage): Promise<void> {
  try {
    // Initialize transporter if needed
    const transport = await initializeTransporter();
    
    // Validate email addresses
    validateEmailAddresses(message);
    
    // Render email templates
    const { html, text } = await renderTemplate(message.template, message.context);
    
    // Prepare email options
    const mailOptions: SendMailOptions = {
      from: {
        name: message.fromName || env.SMTP_FROM_NAME,
        address: message.fromEmail || env.SMTP_FROM_EMAIL || 'noreply@sermonflow.com',
      },
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      subject: message.subject,
      html,
      text,
      attachments: message.attachments?.map(attachment => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
      headers: message.trackingId ? {
        'X-SermonFlow-Tracking-ID': message.trackingId,
      } : undefined,
    };
    
    // Send email
    const info = await transport.sendMail(mailOptions);
    
    // Log success
    logger.info(
      {
        messageId: info.messageId,
        to: message.to,
        subject: message.subject,
        template: message.template,
        trackingId: message.trackingId,
      },
      'Email sent successfully'
    );
    
    // In development with Ethereal, log preview URL
    if (env.NODE_ENV === 'development' && info.messageId) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info({ previewUrl }, 'Email preview URL');
      }
    }
  } catch (error) {
    logger.error(
      {
        error,
        to: message.to,
        subject: message.subject,
        template: message.template,
        trackingId: message.trackingId,
      },
      'Failed to send email'
    );
    
    throw new ApiError(
      500,
      'Failed to send email',
      ErrorCodes.EMAIL_SERVICE_ERROR,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Validate email addresses in the message
 * @param message Email message configuration
 */
function validateEmailAddresses(message: EmailMessage): void {
  const emailSchema = z.string().email();
  const emailsSchema = z.union([
    emailSchema,
    z.array(emailSchema),
  ]);
  
  try {
    // Validate to, cc, bcc, and replyTo fields
    if (message.to) {
      emailsSchema.parse(message.to);
    } else {
      throw new Error('Recipient (to) is required');
    }
    
    if (message.cc) {
      emailsSchema.parse(message.cc);
    }
    
    if (message.bcc) {
      emailsSchema.parse(message.bcc);
    }
    
    if (message.replyTo) {
      emailSchema.parse(message.replyTo);
    }
    
    if (message.fromEmail) {
      emailSchema.parse(message.fromEmail);
    }
  } catch (error) {
    logger.error({ error }, 'Invalid email address');
    throw new ApiError(
      400,
      'Invalid email address',
      ErrorCodes.VALIDATION_ERROR,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

// Rate limiter for email sending
const emailRateLimiter = {
  windowMs: env.EMAIL_RATE_LIMIT_WINDOW * 1000, // Convert to milliseconds
  maxRequests: env.EMAIL_RATE_LIMIT,
  current: 0,
  resetTime: Date.now() + env.EMAIL_RATE_LIMIT_WINDOW * 1000,
  
  /**
   * Check if rate limit is exceeded
   * @returns Whether the rate limit is exceeded
   */
  isRateLimited(): boolean {
    // Reset counter if window has passed
    if (Date.now() > this.resetTime) {
      this.current = 0;
      this.resetTime = Date.now() + this.windowMs;
    }
    
    // Check if limit is exceeded
    return this.current >= this.maxRequests;
  },
  
  /**
   * Increment the rate limiter counter
   */
  increment(): void {
    // Reset counter if window has passed
    if (Date.now() > this.resetTime) {
      this.current = 0;
      this.resetTime = Date.now() + this.windowMs;
    }
    
    // Increment counter
    this.current++;
  },
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Send an email
 * @param message Email message configuration
 * @returns Promise that resolves when the email is sent or queued
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    // Check rate limit
    if (emailRateLimiter.isRateLimited()) {
      logger.warn(
        {
          to: message.to,
          subject: message.subject,
          template: message.template,
        },
        'Email rate limit exceeded'
      );
      
      throw new ApiError(
        429,
        'Email rate limit exceeded',
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        { message: 'Too many emails sent. Please try again later.' }
      );
    }
    
    // Increment rate limiter
    emailRateLimiter.increment();
    
    // Queue or send the email
    await queueEmail(message);
  } catch (error) {
    // Re-throw ApiErrors
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Wrap other errors
    logger.error(
      {
        error,
        to: message.to,
        subject: message.subject,
        template: message.template,
      },
      'Failed to send email'
    );
    
    throw new ApiError(
      500,
      'Failed to send email',
      ErrorCodes.EMAIL_SERVICE_ERROR,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Gracefully shut down the email service
 */
export async function shutdownEmailService(): Promise<void> {
  logger.info('Shutting down email service');
  
  try {
    // Close worker
    if (emailQueueWorker) {
      await emailQueueWorker.close();
      logger.info('Email queue worker closed');
    }
    
    // Close scheduler
    if (emailQueueScheduler) {
      await emailQueueScheduler.close();
      logger.info('Email queue scheduler closed');
    }
    
    // Close queue
    if (emailQueue) {
      await emailQueue.close();
      logger.info('Email queue closed');
    }
    
    // Close transporter
    if (transporter) {
      if (typeof (transporter as any).close === 'function') {
        await promisify((transporter as any).close.bind(transporter))();
      }
      transporter = null;
      logger.info('Email transporter closed');
    }
    
    logger.info('Email service shutdown complete');
  } catch (error) {
    logger.error({ error }, 'Error during email service shutdown');
  }
}

/**
 * Get queue statistics
 * @returns Queue statistics
 */
export async function getEmailQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  rateLimited: boolean;
  rateLimitReset: Date;
}> {
  if (!emailQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      rateLimited: emailRateLimiter.isRateLimited(),
      rateLimitReset: new Date(emailRateLimiter.resetTime),
    };
  }
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    rateLimited: emailRateLimiter.isRateLimited(),
    rateLimitReset: new Date(emailRateLimiter.resetTime),
  };
}

// Initialize on module load
(async () => {
  try {
    // Only initialize in production or if explicitly enabled
    if (env.NODE_ENV === 'production' || process.env.INIT_EMAIL_SERVICE === 'true') {
      await initializeTransporter();
      await initializeQueue();
      logger.info('Email service initialized');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to initialize email service');
  }
})();
