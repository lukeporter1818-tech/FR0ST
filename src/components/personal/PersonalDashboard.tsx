'use client'

import { useState, useTransition, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { upsertPersonalLog } from '@/lib/actions/personal'
import type { PersonalLogData } from '@/lib/actions/personal'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'tasks' | 'train' | 'food' | 'sleep' | 'plan'

const TABS: { id: Tab; label: string }[] = [
  { id: 'home',  label: 'HOME'  },
  { id: 'tasks', label: 'TASKS' },
  { id: 'train', label: 'TRAIN' },
  { id: 'food',  label: 'FOOD'  },
  { id: 'sleep', label: 'SLEEP' },
  { id: 'plan',  label: 'PLAN'  },
]

interface TaskItem { id: string; title: string; done: boolean }
interface Exercise  { name: string; sets: string; reps: string; weight: string }
interface FoodEntry { name: string; cals: number; protein: number; carbs: number; fat: number }

interface Props {
  userId: string
  tasks:     PersonalLogData[]
  workouts:  PersonalLogData[]
  nutrition: PersonalLogData[]
  sleep:     PersonalLogData[]
  plans:     PersonalLogData[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10) }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asObj(v: unknown): Record<string, any> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArr<T>(v: unknown): T[] { return Array.isArray(v) ? v as T[] : [] }

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-white/5 border border-blue-500/20 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/50'
const cardCls  = 'rounded-xl border border-white/8 bg-white/[0.03] p-3'
const saveBtnCls = 'w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40'

// ── HOME tab ─────────────────────────────────────────────────────────────────

function HomeTab({ tasks, workouts, nutrition, sleep }: Omit<Props, 'userId' | 'plans'>) {
  const taskLog  = tasks.find((l) => l.key === 'all')
  const items    = asArr<TaskItem>(asObj(taskLog?.data).items)
  const doneCount = items.filter((t) => t.done).length

  const todayWorkout  = workouts.find((l) => l.key === todayStr())
  const exercises     = asArr<Exercise>(asObj(todayWorkout?.data).exercises)

  const todayFood = nutrition.find((l) => l.key === todayStr())
  const foodItems = asArr<FoodEntry>(asObj(todayFood?.data).entries)
  const totalCals = foodItems.reduce((s, e) => s + (Number(e.cals) || 0), 0)

  const lastSleep = [...sleep].sort((a, b) => b.key.localeCompare(a.key))[0]
  const sleepHours = lastSleep ? asObj(lastSleep.data).hours : null

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest">{todayStr()}</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'TASKS', value: `${doneCount}/${items.length}`, sub: 'completed' },
          { label: 'TRAIN', value: exercises.length > 0 ? `${exercises.length} ex` : '—', sub: exercises.length > 0 ? 'logged today' : 'not logged' },
          { label: 'FOOD',  value: totalCals > 0 ? `${totalCals}` : '—', sub: 'kcal today' },
          { label: 'SLEEP', value: sleepHours != null ? `${sleepHours}h` : '—', sub: lastSleep ? `last: ${lastSleep.key}` : 'not logged' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-[9px] font-bold tracking-[0.15em] text-blue-400/50 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-700 text-center pt-2">Refresh page to update stats after logging</p>
    </div>
  )
}

// ── TASKS tab ────────────────────────────────────────────────────────────────

function TasksTab({ userId, initLogs }: { userId: string; initLogs: PersonalLogData[] }) {
  const taskLog = initLogs.find((l) => l.key === 'all')
  const [items, setItems] = useState<TaskItem[]>(() => asArr<TaskItem>(asObj(taskLog?.data).items))
  const [newTitle, setNewTitle] = useState('')
  const [pending, startTransition] = useTransition()

  function saveItems(next: TaskItem[]) {
    setItems(next)
    startTransition(async () => {
      await upsertPersonalLog(userId, 'task', 'all', { items: next })
    })
  }

  function addTask() {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    saveItems([...items, { id: `${Date.now()}`, title, done: false }])
  }

  const open = items.filter((t) => !t.done)
  const done = items.filter((t) => t.done)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className={cn(inputCls, 'flex-1')}
          placeholder="Add task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <button
          onClick={addTask}
          disabled={!newTitle.trim() || pending}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {open.map((t) => (
          <TaskRow
            key={t.id}
            item={t}
            onToggle={() => saveItems(items.map((x) => x.id === t.id ? { ...x, done: true } : x))}
            onDelete={() => saveItems(items.filter((x) => x.id !== t.id))}
          />
        ))}
        {open.length === 0 && <p className="text-xs text-gray-700 text-center py-6">All clear ✓</p>}
      </div>

      {done.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-700 uppercase tracking-widest">Done ({done.length})</p>
          {done.map((t) => (
            <TaskRow
              key={t.id}
              item={t}
              onToggle={() => saveItems(items.map((x) => x.id === t.id ? { ...x, done: false } : x))}
              onDelete={() => saveItems(items.filter((x) => x.id !== t.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ item, onToggle, onDelete }: { item: TaskItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2.5 group py-1">
      <button onClick={onToggle} className="shrink-0">
        {item.done
          ? <CheckCircle2 className="size-4 text-blue-500" />
          : <Circle className="size-4 text-gray-600" />}
      </button>
      <span className={cn('flex-1 text-sm', item.done ? 'line-through text-gray-600' : 'text-gray-200')}>
        {item.title}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 hover:text-red-400 shrink-0"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// ── TRAIN tab ────────────────────────────────────────────────────────────────

function TrainTab({ userId, initLogs }: { userId: string; initLogs: PersonalLogData[] }) {
  const [date, setDate] = useState(todayStr())
  const [logs, setLogs] = useState<PersonalLogData[]>(initLogs)
  const [pending, startTransition] = useTransition()
  const [exForm, setExForm] = useState({ name: '', sets: '', reps: '', weight: '' })
  const [notes, setNotes] = useState('')

  const dayLog   = logs.find((l) => l.key === date)
  const exercises = asArr<Exercise>(asObj(dayLog?.data).exercises)

  // Sync notes textarea when date changes
  useEffect(() => {
    setNotes((asObj(logs.find((l) => l.key === date)?.data).notes as string) || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function persistWorkout(exs: Exercise[], n: string) {
    const data = { exercises: exs, notes: n }
    const entry: PersonalLogData = { id: date, key: date, data, createdAt: new Date().toISOString() }
    setLogs((prev) => [...prev.filter((l) => l.key !== date), entry])
    startTransition(async () => { await upsertPersonalLog(userId, 'workout', date, data) })
  }

  function addExercise() {
    if (!exForm.name.trim()) return
    persistWorkout([...exercises, { ...exForm }], notes)
    setExForm({ name: '', sets: '', reps: '', weight: '' })
  }

  function removeExercise(i: number) {
    persistWorkout(exercises.filter((_, idx) => idx !== i), notes)
  }

  return (
    <div className="space-y-4">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

      {/* Add exercise form */}
      <div className="grid grid-cols-2 gap-2">
        <input className={cn(inputCls, 'col-span-2')} placeholder="Exercise name" value={exForm.name} onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addExercise()} />
        <input className={inputCls} placeholder="Sets" value={exForm.sets} onChange={(e) => setExForm((f) => ({ ...f, sets: e.target.value }))} />
        <input className={inputCls} placeholder="Reps" value={exForm.reps} onChange={(e) => setExForm((f) => ({ ...f, reps: e.target.value }))} />
        <input className={cn(inputCls, 'col-span-2')} placeholder="Weight (lbs / kg)" value={exForm.weight} onChange={(e) => setExForm((f) => ({ ...f, weight: e.target.value }))} />
      </div>
      <button onClick={addExercise} disabled={!exForm.name.trim() || pending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40">
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add Exercise
      </button>

      {/* Exercise list */}
      <div className="space-y-2">
        {exercises.map((ex, i) => (
          <div key={i} className={cn(cardCls, 'flex items-center justify-between')}>
            <div>
              <p className="text-sm font-semibold text-gray-100">{ex.name}</p>
              <p className="text-xs text-gray-500">{ex.sets && `${ex.sets} sets`}{ex.reps && ` × ${ex.reps} reps`}{ex.weight && ` @ ${ex.weight}`}</p>
            </div>
            <button onClick={() => removeExercise(i)} className="text-gray-700 hover:text-red-400 ml-2 shrink-0">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {exercises.length === 0 && <p className="text-xs text-gray-700 text-center py-4">No exercises for this day</p>}
      </div>

      {/* Notes */}
      <textarea
        className={cn(inputCls, 'resize-none')}
        rows={3}
        placeholder="Session notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button onClick={() => persistWorkout(exercises, notes)} disabled={pending} className={saveBtnCls}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Save Notes
      </button>
    </div>
  )
}

// ── FOOD tab ─────────────────────────────────────────────────────────────────

function FoodTab({ userId, initLogs }: { userId: string; initLogs: PersonalLogData[] }) {
  const [date, setDate] = useState(todayStr())
  const [logs, setLogs] = useState<PersonalLogData[]>(initLogs)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', cals: '', protein: '', carbs: '', fat: '' })

  const dayLog = logs.find((l) => l.key === date)
  const entries = asArr<FoodEntry>(asObj(dayLog?.data).entries)
  const totals  = entries.reduce(
    (s, e) => ({ cals: s.cals + (Number(e.cals) || 0), protein: s.protein + (Number(e.protein) || 0), carbs: s.carbs + (Number(e.carbs) || 0), fat: s.fat + (Number(e.fat) || 0) }),
    { cals: 0, protein: 0, carbs: 0, fat: 0 }
  )

  function persist(next: FoodEntry[]) {
    const data = { entries: next }
    const entry: PersonalLogData = { id: date, key: date, data, createdAt: new Date().toISOString() }
    setLogs((prev) => [...prev.filter((l) => l.key !== date), entry])
    startTransition(async () => { await upsertPersonalLog(userId, 'nutrition', date, data) })
  }

  function addEntry() {
    if (!form.name.trim()) return
    persist([...entries, { name: form.name, cals: Number(form.cals) || 0, protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0 }])
    setForm({ name: '', cals: '', protein: '', carbs: '', fat: '' })
  }

  return (
    <div className="space-y-4">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

      {/* Macro totals */}
      {entries.length > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'KCAL', value: String(totals.cals) },
            { label: 'PROT', value: `${totals.protein}g` },
            { label: 'CARB', value: `${totals.carbs}g` },
            { label: 'FAT',  value: `${totals.fat}g` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-blue-500/20 bg-blue-500/5 py-2">
              <p className="text-[9px] font-bold tracking-widest text-blue-400/50">{label}</p>
              <p className="text-sm font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="space-y-2">
        <input className={inputCls} placeholder="Food / meal name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addEntry()} />
        <div className="grid grid-cols-4 gap-2">
          <input className={inputCls} placeholder="kcal" type="number" value={form.cals} onChange={(e) => setForm((f) => ({ ...f, cals: e.target.value }))} />
          <input className={inputCls} placeholder="prot" type="number" value={form.protein} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} />
          <input className={inputCls} placeholder="carb" type="number" value={form.carbs} onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} />
          <input className={inputCls} placeholder="fat"  type="number" value={form.fat} onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} />
        </div>
        <button onClick={addEntry} disabled={!form.name.trim() || pending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add Entry
        </button>
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className={cn(cardCls, 'flex items-center justify-between')}>
            <div>
              <p className="text-sm text-gray-100">{e.name}</p>
              <p className="text-xs text-gray-600">{e.cals} kcal · {e.protein}g P · {e.carbs}g C · {e.fat}g F</p>
            </div>
            <button onClick={() => persist(entries.filter((_, idx) => idx !== i))} className="text-gray-700 hover:text-red-400 ml-2 shrink-0">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-gray-700 text-center py-4">No entries for this day</p>}
      </div>
    </div>
  )
}

// ── SLEEP tab ────────────────────────────────────────────────────────────────

function SleepTab({ userId, initLogs }: { userId: string; initLogs: PersonalLogData[] }) {
  const [date, setDate] = useState(todayStr())
  const [logs, setLogs] = useState<PersonalLogData[]>(initLogs)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ bedtime: '', wake: '', quality: 7, notes: '' })

  // Sync form when date changes
  useEffect(() => {
    const log = logs.find((l) => l.key === date)
    const d = asObj(log?.data)
    setForm({ bedtime: String(d.bedtime || ''), wake: String(d.wake || ''), quality: Number(d.quality) || 7, notes: String(d.notes || '') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function calcHours(bed: string, wake: string): number | null {
    if (!bed || !wake) return null
    const [bh, bm] = bed.split(':').map(Number)
    let [wh, wm] = wake.split(':').map(Number)
    if (wh < bh) wh += 24
    return Math.round(((wh * 60 + wm - bh * 60 - bm) / 60) * 10) / 10
  }

  const hours = calcHours(form.bedtime, form.wake)

  function save() {
    const data = { ...form, hours }
    const entry: PersonalLogData = { id: date, key: date, data, createdAt: new Date().toISOString() }
    setLogs((prev) => [...prev.filter((l) => l.key !== date), entry])
    startTransition(async () => { await upsertPersonalLog(userId, 'sleep', date, data) })
  }

  return (
    <div className="space-y-4">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

      {hours !== null && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-center">
          <p className="text-4xl font-bold text-white">{hours}h</p>
          <p className="text-xs text-blue-400/50 mt-1 tracking-widest">SLEEP DURATION</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-600 mb-1 tracking-widest uppercase">Bedtime</label>
          <input type="time" className={inputCls} value={form.bedtime} onChange={(e) => setForm((f) => ({ ...f, bedtime: e.target.value }))} />
        </div>
        <div>
          <label className="block text-[10px] text-gray-600 mb-1 tracking-widest uppercase">Wake</label>
          <input type="time" className={inputCls} value={form.wake} onChange={(e) => setForm((f) => ({ ...f, wake: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <label className="text-[10px] text-gray-600 uppercase tracking-widest">Quality</label>
          <span className="text-xs font-bold text-blue-400">{form.quality}/10</span>
        </div>
        <input type="range" min={1} max={10} value={form.quality} onChange={(e) => setForm((f) => ({ ...f, quality: Number(e.target.value) }))} className="w-full accent-blue-500" />
      </div>

      <textarea className={cn(inputCls, 'resize-none')} rows={3} placeholder="Notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

      <button onClick={save} disabled={pending} className={saveBtnCls}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Save Sleep Log
      </button>

      {/* Recent entries */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-700 uppercase tracking-widest">Recent</p>
        {[...logs].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 7).map((l) => {
          const d = asObj(l.data)
          return (
            <div key={l.key} className={cn(cardCls, 'flex items-center justify-between cursor-pointer hover:bg-white/5')} onClick={() => setDate(l.key)}>
              <span className="text-xs text-gray-500">{l.key}</span>
              <span className="text-xs text-gray-600">{String(d.bedtime || '—')} → {String(d.wake || '—')}</span>
              <span className="text-sm font-bold text-blue-400">{d.hours != null ? `${d.hours}h` : '—'}</span>
            </div>
          )
        })}
        {logs.length === 0 && <p className="text-xs text-gray-700 text-center py-2">No sleep logs yet</p>}
      </div>
    </div>
  )
}

// ── PLAN tab ──────────────────────────────────────────────────────────────────

function PlanTab({ userId, initLogs }: { userId: string; initLogs: PersonalLogData[] }) {
  const [date, setDate] = useState(todayStr())
  const [logs, setLogs] = useState<PersonalLogData[]>(initLogs)
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState(() => String(asObj(initLogs.find((l) => l.key === todayStr())?.data).text || ''))

  // Sync text when date changes
  useEffect(() => {
    setText(String(asObj(logs.find((l) => l.key === date)?.data).text || ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function save() {
    const data = { text }
    const entry: PersonalLogData = { id: date, key: date, data, createdAt: new Date().toISOString() }
    setLogs((prev) => [...prev.filter((l) => l.key !== date), entry])
    startTransition(async () => { await upsertPersonalLog(userId, 'plan', date, data) })
  }

  return (
    <div className="space-y-4">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

      <textarea
        className={cn(inputCls, 'resize-none font-mono text-xs leading-relaxed')}
        rows={14}
        placeholder={'# Goals\n\n# Priorities\n\n# Notes\n\n# Reflection'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button onClick={save} disabled={pending} className={saveBtnCls}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Save Plan
      </button>

      {/* Previous plan dates */}
      {logs.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-700 uppercase tracking-widest">Previous</p>
          <div className="flex flex-wrap gap-1.5">
            {[...logs].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 14).map((l) => (
              <button
                key={l.key}
                onClick={() => setDate(l.key)}
                className={cn(
                  'text-[10px] px-2.5 py-1 rounded-full border transition-colors',
                  l.key === date
                    ? 'border-blue-500/60 bg-blue-500/10 text-blue-400'
                    : 'border-white/8 text-gray-600 hover:text-gray-400 hover:border-white/15'
                )}
              >
                {l.key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PersonalDashboard(props: Props) {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="min-h-full" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <h1 className="text-base font-bold tracking-[0.25em] text-white">PR0JECT33</h1>
        <p className="text-[10px] mt-0.5 tracking-widest" style={{ color: '#3b82f640' }}>PERSONAL COMMAND CENTER</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b px-2 overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-3 text-[10px] font-bold tracking-[0.15em] border-b-2 transition-colors shrink-0',
              tab === t.id
                ? 'text-blue-400'
                : 'border-transparent text-gray-600 hover:text-gray-400'
            )}
            style={tab === t.id ? { borderBottomColor: '#3b82f6' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — all tabs always mounted to preserve state */}
      <div className="px-4 py-5 max-w-lg mx-auto">
        <div className={tab !== 'home'  ? 'hidden' : ''}><HomeTab  tasks={props.tasks} workouts={props.workouts} nutrition={props.nutrition} sleep={props.sleep} /></div>
        <div className={tab !== 'tasks' ? 'hidden' : ''}><TasksTab userId={props.userId} initLogs={props.tasks} /></div>
        <div className={tab !== 'train' ? 'hidden' : ''}><TrainTab userId={props.userId} initLogs={props.workouts} /></div>
        <div className={tab !== 'food'  ? 'hidden' : ''}><FoodTab  userId={props.userId} initLogs={props.nutrition} /></div>
        <div className={tab !== 'sleep' ? 'hidden' : ''}><SleepTab userId={props.userId} initLogs={props.sleep} /></div>
        <div className={tab !== 'plan'  ? 'hidden' : ''}><PlanTab  userId={props.userId} initLogs={props.plans} /></div>
      </div>
    </div>
  )
}
