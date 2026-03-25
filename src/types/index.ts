import type {
  Job,
  Technician,
  ScheduleEntry,
  Note,
  User,
} from '@/generated/prisma'

// Re-export all enums from Prisma
export {
  Role,
  TechStatus,
  JobType,
  Trade,
  Priority,
  JobStatus,
  ScheduleStatus,
  SmsDirection,
} from '@/generated/prisma'

// ── Relation Types ──

export type JobWithRelations = Job & {
  assignedTech: Technician | null
  scheduleEntry: ScheduleEntry | null
  notes: Note[]
}

export type TechnicianWithRelations = Technician & {
  scheduleEntries: (ScheduleEntry & { job: Job })[]
  jobs: Job[]
  user: User | null
}

export type ScheduleEntryWithRelations = ScheduleEntry & {
  job: Job
  technician: Technician
}

// ── Dispatch Board ──

export type DispatchBoard = {
  date: string
  technicians: Array<{
    technician: TechnicianWithRelations
    entries: ScheduleEntryWithRelations[]
  }>
  unassigned: JobWithRelations[]
}

// ── AI Types ──

export type AITriageResult = {
  summary: string
  tradeClassification: string
  urgency: 'low' | 'normal' | 'high' | 'emergency'
  riskFlags: string[]
  followUpQuestions: string[]
  suggestedJobType: string
  reasoning: string
}

export type AIDraftTextRequest = {
  recipientName: string
  recipientPhone: string
  context: string
  purpose: 'eta' | 'scheduling' | 'follow_up' | 'confirmation' | 'custom'
  customInstructions?: string
}

export type AIDraftTextResult = {
  draftMessage: string
  tone: string
  characterCount: number
}

export type AICleanNotesResult = {
  cleanedNotes: string
  originalLength: number
  cleanedLength: number
  corrections: string[]
}

export type AIBoardSummary = {
  date: string
  totalJobs: number
  assignedJobs: number
  unassignedJobs: number
  technicianCount: number
  emergencyJobs: number
  riskFlags: string[]
  narrative: string
}
