'use client'

import { useState, ReactNode, createContext, useContext } from 'react'
import { InviteModal } from './InviteModal'

interface InviteModalContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const InviteModalContext = createContext<InviteModalContextType | null>(null)

export function InviteModalWrapper({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <InviteModalContext.Provider value={{ isOpen, setIsOpen }}>
        {children}
      </InviteModalContext.Provider>
      <InviteModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

function TriggerButton({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(InviteModalContext)
  if (!ctx) {
    throw new Error('TriggerButton must be used within InviteModalWrapper')
  }

  return (
    <button
      onClick={() => ctx.setIsOpen(true)}
      className={
        className ||
        'inline-flex items-center gap-2 rounded-lg bg-amber-400 text-gray-900 px-4 py-2 text-sm font-medium hover:bg-amber-500 transition-colors'
      }
    >
      {children}
    </button>
  )
}

InviteModalWrapper.TriggerButton = TriggerButton
