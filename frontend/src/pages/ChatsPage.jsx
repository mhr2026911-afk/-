import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Brand from '../components/Brand'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { messagePreview, formatRelative } from '../lib/format'
import { onSocket } from '../lib/socket'

function StoryRing({ item }) {
  const unseen = item?.unseen > 0
  return (
    <Link to="/stories" className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
      <span
        className={`relative flex h-[62px] w-[62px] items-center justify-center rounded-full p-[2.5px] ${
          unseen ? 'bg-gradient-to-tr from-brand via-emerald-400 to-gold' : 'bg-line'
        }`}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
          <Avatar user={item?.user} size="md" className="!h-full !w-full" />
        </span>
        {unseen ? (
          <span className="absolute -top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {item.unseen}
          </span>
        ) : null}
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium text-ink/80">
        {item?.is_me ? 'حالتي' : item?.user?.name || item?.user?.phone}
      </span>
    </Link>
  )
}

export default function ChatsPage() {
  const { user } = useAuth()
  const [chats, setChats] = useState(null)
  const [feed, setFeed] = useState([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const [chatsData, storiesData] = await Promise.all([
        api.get('/api/chats'),
        api.get('/api/stories'),
      ])
      setChats(chatsData.chats)
      setFeed(storiesData.feed)
    } catch (err) {
      setError(err.message)
      setChats([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(
    () =>
      onSocket((event) => {
        if (
          ['message:new', 'receipt', 'conversation:updated', 'conversation:deleted', 'story:new', 'socket:open'].includes(
            event.type,
          )
        ) {
          load()
        }
      }),
    [load],
  )

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const myStory = feed.find((item) => item.is_me)
  const otherStories = feed.filter((item) => !item.is_me)
  const visibleChats = (chats || []).filter((chat) => {
    if (!query.trim()) return true
    const needle = query.trim()
    return (
      chat.title?.includes(needle) ||
      chat.peer?.phone?.includes(needle) ||
      chat.peer?.name?.includes(needle)
    )
  })

  return (
    <div className="pb-2">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand size="sm" withName={false} />
          <div className="flex-1 px-3">
            <p className="text-[17px] font-extrabold leading-tight text-ink">مرسال</p>
            <p className="text-[11px] text-muted">
              {user?.name ? `أهلًا ${user.name.split(' ')[0]}` : 'محادثاتك'}
            </p>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSearchOpen((value) => !value)}
              aria-label="بحث"
            >
              <Icon name="search" size={20} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => navigate('/contacts')}
              aria-label="محادثة جديدة"
            >
              <Icon name="plus" size={22} />
            </button>
          </div>
        </div>
        {searchOpen ? (
          <div className="px-3 pb-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في محادثاتك"
              className="field py-2.5 text-[13.5px]"
              autoFocus
            />
          </div>
        ) : null}
      </header>

      <div className="border-b border-line/60 bg-gradient-to-b from-brand-tint to-white px-3 py-3">
        <div className="flex items-start gap-3 overflow-x-auto no-scrollbar">
          <Link to="/stories" className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
            <span className="relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-[2.5px] border-dashed border-brand/40 bg-white">
              <Avatar user={myStory?.user || user} size="md" className="!h-[52px] !w-[52px]" />
              <span className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand text-white">
                <Icon name="plus" size={12} strokeWidth={2.6} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-ink/80">حالتي</span>
          </Link>
          {otherStories.map((item) => (
            <StoryRing key={item.user.id} item={item} />
          ))}
          {otherStories.length === 0 ? (
            <div className="flex h-[62px] flex-1 items-center px-2 text-[11.5px] leading-5 text-muted">
              حالات من تضيفهم إلى جهات اتصالك ستظهر هنا.
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {chats === null ? (
        <div className="space-y-3 px-4 py-5">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex animate-pulse items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-line" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 rounded bg-line" />
                <span className="block h-3 w-2/3 rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleChats.length === 0 ? (
        <EmptyState
          title={query ? 'لا نتائج للبحث' : 'لا توجد محادثات بعد'}
          description={
            query
              ? 'جرّب اسمًا أو رقمًا آخر.'
              : 'أضف جهة اتصال برقم هاتفها المسجّل في مرسال ثم ابدأ أول محادثة.'
          }
          action={
            !query ? (
              <Link to="/contacts" className="btn-primary px-5">
                <Icon name="plus" size={17} />
                إضافة مستخدم مسجّل
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="divide-y divide-line/70">
          {visibleChats.map((chat) => {
            const last = chat.last_message
            const isMine = last && last.sender_id === user?.id
            return (
              <li key={chat.id}>
                <Link to={`/chats/${chat.id}`} className="row-item">
                  {chat.kind === 'group' ? (
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Icon name="users" size={22} />
                    </span>
                  ) : (
                    <Avatar user={chat.peer} size="md" online={chat.peer?.online} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14.5px] font-bold text-ink">{chat.title}</p>
                      <span className="shrink-0 text-[10.5px] text-muted">
                        {formatRelative(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] text-muted">
                        {last?.kind === 'system' ? (
                          <span className="italic">{last.body}</span>
                        ) : (
                          <>
                            {isMine ? <span className="text-brand/80">أنت: </span> : null}
                            {messagePreview(last) || 'ابدأ المحادثة'}
                          </>
                        )}
                      </p>
                      {chat.unread > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10.5px] font-bold text-white">
                          {chat.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
