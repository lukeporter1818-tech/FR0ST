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

// Named export — keeps the 'use client' proxy happy in Next.js App Router.
// Compound-component property assignment (Wrapper.Button = ...) is a runtime
// mutation that Next.js does NOT forward through its server-side module proxy,
// causing "Element type is invalid: got undefined" in Server Components.
export function InviteModalTriggerButton({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(InviteModalContext)
  if (!ctx) {
    throw new Error('InviteModalTriggerButton must be used within InviteModalWrapper')
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
