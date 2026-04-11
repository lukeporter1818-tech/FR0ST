'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const CARDS = [
  {
    icon: '🔧',
    title: 'Welcome to FR0ST',
    body: 'Your field operations app. Everything you need for the day — schedule, chat, and your AI field partner — all in one place.',
  },
  {
    icon: '📋',
    title: 'Your day starts here',
    body: 'Check your store assignment every morning. Tap your row to update your status as the day moves. Your dispatcher sees it in real time.',
  },
  {
    icon: '💬',
    title: 'Stay connected',
    body: 'Team Chat is how we communicate. Check it throughout the day. If something comes up on a job, this is where you say it.',
  },
  {
    icon: '🤖',
    title: 'Your AI field partner',
    body: 'Ask FR0ST anything — troubleshooting, parts identification, how equipment works. The more issues you log after a job, the smarter it gets for every tech after you.',
  },
]

interface OnboardingFlowProps {
  userId: string
  onComplete: () => void
}

export function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [card, setCard] = useState(0)
  const [exiting, setExiting] = useState(false)

  const finish = () => {
    localStorage.setItem(`frost_onboarded_${userId}`, '1')
    onComplete()
  }

  const advance = () => {
    if (card < CARDS.length - 1) {
      setExiting(true)
      setTimeout(() => {
        setCard((c) => c + 1)
        setExiting(false)
      }, 200)
    } else {
      finish()
    }
  }

  const isLast = card === CARDS.length - 1
  const current = CARDS[card]

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-between bg-gray-950 px-6 pb-10 pt-14 select-none">
      {/* Top branding */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🔧</span>
        <span className="text-base font-bold tracking-widest text-amber-400 uppercase">FR0ST</span>
      </div>

      {/* Card */}
      <div
        className={cn(
          'flex flex-col items-center gap-6 text-center transition-opacity duration-200',
          exiting ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-5xl">
          {current.icon}
        </div>
        <div className="space-y-3 max-w-xs">
          <h2 className="text-xl font-bold text-gray-100">{current.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{current.body}</p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Progress dots */}
        <div className="flex gap-2">
          {CARDS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === card ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20',
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <button
          type="button"
          onClick={advance}
          className="w-full py-4 rounded-2xl bg-amber-500 text-gray-950 font-semibold text-base active:bg-amber-400 transition-colors"
        >
          {isLast ? "Let's go" : 'Next'}
        </button>

        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="text-sm text-gray-500 py-2 active:text-gray-300 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

interface OnboardingGateProps {
  userId: string
  userRole: string
}

export function OnboardingGate({ userId, userRole }: OnboardingGateProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (userRole !== 'TECHNICIAN') return
    const key = `frost_onboarded_${userId}`
    if (!localStorage.getItem(key)) {
      setShow(true)
    }
  }, [userId, userRole])

  if (!show) return null

  return <OnboardingFlow userId={userId} onComplete={() => setShow(false)} />
}
