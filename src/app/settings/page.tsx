import Link from 'next/link'
import { BookOpen, Building2, MessageSquare, Sparkles, Users } from 'lucide-react'

const sections = [
  {
    title: 'User Management',
    description: 'Add, edit, and deactivate dispatchers, technicians, and admin users.',
    icon: Users,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    href: '/settings/users',
  },
  {
    title: 'Company Info',
    description: 'Business name, address, contact details, and service area configuration.',
    icon: Building2,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    href: null,
  },
  {
    title: 'Twilio SMS',
    description: 'Phone number, API credentials, and message templates.',
    icon: MessageSquare,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    href: null,
  },
  {
    title: 'AI Configuration',
    description: 'Anthropic API key, triage prompts, and AI behavior preferences.',
    icon: Sparkles,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    href: null,
  },
  {
    title: 'Frost Learning Log',
    description: 'Review Frost interactions, technician feedback, and logged fixes.',
    icon: BookOpen,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    href: '/settings/ai-interactions',
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure your FieldCommand instance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(({ title, description, icon: Icon, iconBg, iconColor, href }) => {
          const content = (
            <div className="flex items-start gap-4">
              <div className={`flex w-10 h-10 items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
                <Icon className={`size-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                  {!href && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            </div>
          )

          return href ? (
            <Link
              key={title}
              href={href}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 hover:shadow-md transition-all"
            >
              {content}
            </Link>
          ) : (
            <div key={title} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 opacity-60">
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
