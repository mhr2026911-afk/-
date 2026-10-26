import { NavLink } from 'react-router-dom'
import Icon from './Icons'

const TABS = [
  { to: '/chats', label: 'المحادثات', icon: 'chat' },
  { to: '/stories', label: 'الحالات', icon: 'stories' },
  { to: '/calls', label: 'المكالمات', icon: 'phone' },
  { to: '/groups', label: 'المجموعات', icon: 'users' },
  { to: '/settings', label: 'الإعدادات', icon: 'settings' },
]

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-line/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex items-stretch justify-between px-1.5 py-1.5">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-medium transition ${
                  isActive ? 'text-brand' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                      isActive ? 'bg-brand-soft' : ''
                    }`}
                  >
                    <Icon name={tab.icon} size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
