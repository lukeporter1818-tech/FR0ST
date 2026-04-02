/**
 * Zod schemas for all user-supplied inputs.
 * Import these in API routes and server actions — never trust raw request data.
 */

import { z } from 'zod'

// ─── Shared ──────────────────────────────────────────────────────────────────

export const cuidSchema = z.string().cuid2().or(z.string().cuid())

// Trim and sanitize a plain text field
const text = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).optional()

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatPostSchema = z.object({
  body: text(2000),
  channel: z.string().trim().max(50).default('general'),
})

// ─── Technicians ─────────────────────────────────────────────────────────────

const techStatusEnum = z.enum(['ACTIVE', 'OFF', 'VACATION', 'SICK'])
const tradeEnum = z.enum(['HVAC', 'REFRIGERATION', 'PLUMBING', 'ELECTRICAL', 'MULTI', 'UNKNOWN'])

export const technicianCreateSchema = z.object({
  name: text(100),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[\d\s\+\-\(\)\.]+$/, 'Invalid phone number'),
  status: techStatusEnum.default('ACTIVE'),
  tradeType: text(50).optional().nullable(),
  skillTags: z.array(z.string().trim().max(50)).max(20).optional(),
  notes: optionalText(500).nullable(),
})

// ─── Board ───────────────────────────────────────────────────────────────────

const boardStatusEnum = z.enum(['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'WAITING', 'PARTS', 'PM', 'DONE', 'OUT'])

export const boardRowSchema = z.object({
  technicianId: z.string().min(1).max(100),
  assignment: z.string().trim().max(200).default(''),
  note: z.string().trim().max(500).default(''),
  status: boardStatusEnum.nullable().optional(),
})

export const saveBoardEntriesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  rows: z.array(boardRowSchema).max(50),
})

export const updateMyRowSchema = z.object({
  technicianId: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  status: boardStatusEnum.nullable().optional(),
  note: z.string().trim().max(500).default(''),
})

// ─── SMS ─────────────────────────────────────────────────────────────────────

export const smsSendSchema = z.object({
  technicianId: z.string().min(1).max(100),
  message: text(1600), // 10 SMS segments max
  jobId: z.string().min(1).max(100).optional().nullable(),
  aiDrafted: z.boolean().default(false),
})

// ─── Jobs ────────────────────────────────────────────────────────────────────

const jobTypeEnum = z.enum(['SERVICE', 'INSTALL', 'MAINTENANCE', 'CALLBACK', 'EMERGENCY', 'INSPECTION', 'ESTIMATE'])
const priorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'])
const jobStatusEnum = z.enum(['NEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'])

export const jobCreateSchema = z.object({
  customerName: text(100),
  customerPhone: optionalText(20).nullable(),
  address: text(200),
  city: optionalText(100).nullable(),
  state: optionalText(50).nullable(),
  zip: optionalText(10).nullable(),
  issueDescription: text(2000),
  jobType: jobTypeEnum.default('SERVICE'),
  priority: priorityEnum.default('NORMAL'),
  tradeClassification: tradeEnum.optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  timeWindow: optionalText(50).nullable(),
  assignedTechId: z.string().min(1).max(100).optional().nullable(),
  dispatcherNotes: optionalText(2000).nullable(),
  internalNotes: optionalText(2000).nullable(),
  tags: z.array(z.string().trim().max(50)).max(20).default([]),
})

export const jobStatusUpdateSchema = z.object({
  status: jobStatusEnum,
})

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiAskSchema = z.object({
  question: text(2000),
  // 5000 chars — schedule context for a full fleet (20+ techs × jobs) can
  // easily exceed the previous 1000-char cap, causing silent 400 errors.
  context: optionalText(5000),
})

export const aiAssistantSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().max(10000),
      })
    )
    .min(1)
    .max(20), // client sends at most 10 (slice(-9) + 1 new); 20 gives headroom without accepting huge payloads
  imageBase64: z.string().max(7_000_000).optional(), // ~5MB base64
})

export const extractWorkOrderSchema = z.object({
  imageBase64: z.string().min(1).max(7_000_000), // required — this endpoint is image-only
})

export const aiCleanNotesSchema = z.object({
  rawNotes: text(5000),
  context: optionalText(500),
})

export const aiDraftTextSchema = z.object({
  technicianName: text(100),
  intent: text(500),
  jobSummary: optionalText(500),
  tone: z.enum(['casual', 'direct', 'professional']).default('professional'),
})

export const aiSummarizeBoardSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  scheduleData: z
    .array(
      z.object({
        techName: z.string().trim().max(100),
        jobs: z
          .array(
            z.object({
              customer: z.string().trim().max(100),
              issue: z.string().trim().max(200),
              priority: z.string().trim().max(20),
            })
          )
          .max(20),
      })
    )
    .max(30),
})

export const aiTriageSchema = z.object({
  issueDescription: text(2000),
  customerName: optionalText(100),
  address: optionalText(200),
  existingNotes: optionalText(1000),
})

// ─── Users ───────────────────────────────────────────────────────────────────

const roleEnum = z.enum(['ADMIN', 'DISPATCHER', 'TECHNICIAN'])

export const userCreateSchema = z.object({
  name: text(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(100),
  role: roleEnum.default('TECHNICIAN'),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\d\s\+\-\(\)\.]+$/, 'Invalid phone number')
    .optional()
    .nullable(),
  technicianId: z.string().min(1).max(100).optional().nullable(),
})

export const userUpdateSchema = z.object({
  name: text(100).optional(),
  email: z.string().trim().email().max(200).optional(),
  role: roleEnum.optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  technicianId: z.string().min(1).max(100).optional().nullable(),
})

export const passwordResetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(100),
})

// ─── Technician Invitations ───────────────────────────────────────

const phoneField = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[\d\s\+\-\(\)\.]+$/, 'Invalid phone number')

export const technicianInviteSchema = z
  .object({
    name: text(100),
    inviteMethod: z.enum(['email', 'phone', 'both', 'manual']),
    email: z.string().trim().email().max(200).optional(),
    phone: phoneField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.inviteMethod === 'email' || data.inviteMethod === 'both') {
      if (!data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Email is required for this invite method',
        })
      }
    }
    if (data.inviteMethod === 'phone' || data.inviteMethod === 'both') {
      if (!data.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phone'],
          message: 'Phone is required for this invite method',
        })
      }
    }
    // manual: no additional fields required
  })
