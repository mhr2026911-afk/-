import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import Sheet from '../components/Sheet'
import { api, mediaUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRelative } from '../lib/format'
import { onSocket } from '../lib/socket'

const BACKGROUNDS = ['#0f6b57', '#0c2f27', '#7c2d12', '#1e3a8a', '#831843', '#3f3f46', '#b45309']

export default function StoriesPage() {
  const { user } = useAuth()
  const [feed, setFeed] = useState(null)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [text, setText] = useState('')
  const [background, setBackground] = useState(BACKGROUNDS[0])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [viewersList, setViewersList] = useState(null)
  const [viewersOpen, setViewersOpen] = useState(false)
  const fileInput = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/stories')
      setFeed(data.feed)
    } catch (err) {
      setError(err.message)
      setFeed([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => onSocket((event) => event.type === 'story:new' && load()), [load])

  const groups = feed || []
  const currentGroup = viewer ? groups[viewer.gi] : null
  const currentStory = currentGroup?.stories?.[viewer?.si] || null

  const closeViewer = () => {
    setViewer(null)
    setViewersOpen(false)
  }

  const advance = useCallback(
    (direction = 1) => {
      setViewer((current) => {
        if (!current) return current
        const group = groups[current.gi]
        if (!group) return null
        const nextIndex = current.si + direction
        if (nextIndex >= 0 && nextIndex < group.stories.length) {
          return { gi: current.gi, si: nextIndex }
        }
        if (direction > 0) {
          if (current.gi + 1 < groups.length) return { gi: current.gi + 1, si: 0 }
          return null
        }
        if (current.gi > 0) {
          const previousGroup = groups[current.gi - 1]
          return { gi: current.gi - 1, si: previousGroup.stories.length - 1 }
        }
        return current
      })
    },
    [groups],
  )

  useEffect(() => {
    if (!currentStory) return undefined
    api.post(`/api/stories/${currentStory.id}/view`).catch(() => {})
    const timer = setTimeout(() => advance(1), 5200)
    return () => clearTimeout(timer)
  }, [currentStory, advance])

  useEffect(() => {
    if (!currentStory) return
    setFeed((prev) =>
      (prev || []).map((group) => ({
        ...group,
        stories: group.stories.map((story) =>
          story.id === currentStory.id ? { ...story, viewed: true } : story,
        ),
      })),
    )
  }, [currentStory?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const openViewer = (groupIndex, storyIndex = 0) => {
    setViewer({ gi: groupIndex, si: storyIndex })
  }

  const openViewers = async () => {
    if (!currentStory) return
    setViewersOpen(true)
    setViewersList(null)
    try {
      const data = await api.get(`/api/stories/${currentStory.id}/viewers`)
      setViewersList(data.viewers)
    } catch (err) {
      setError(err.message)
      setViewersList([])
    }
  }

  const deleteStory = async () => {
    if (!currentStory) return
    try {
      await api.del(`/api/stories/${currentStory.id}`)
      closeViewer()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const pickImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const publish = async () => {
    if (!text.trim() && !imageFile) {
      setError('أضف نصًا أو صورة إلى حالتك')
      return
    }
    setPublishing(true)
    setError('')
    try {
      let mediaId
      if (imageFile) {
        const { media } = await api.upload(imageFile)
        mediaId = media.id
      }
      await api.post('/api/stories', {
        text: text.trim(),
        media_id: mediaId,
        background,
      })
      setCreateOpen(false)
      setText('')
      setImageFile(null)
      setImagePreview('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  const myGroup = groups.find((group) => group.is_me)

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-[17px] font-extrabold text-ink">الحالات</h1>
          <p className="text-[11px] text-muted">تختفي الحالات تلقائيًا بعد ٢٤ ساعة</p>
        </div>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-[12.5px]"
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size={16} />
          حالة جديدة
        </button>
      </header>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => (myGroup ? openViewer(groups.indexOf(myGroup)) : setCreateOpen(true))}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-right shadow-card"
        >
          <span className="relative">
            <Avatar user={user} size="lg" />
            <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand text-white">
              <Icon name="plus" size={13} strokeWidth={2.6} />
            </span>
          </span>
          <span className="flex-1">
            <span className="block text-[14.5px] font-bold text-ink">حالتي</span>
            <span className="block text-[11.5px] text-muted">
              {myGroup
                ? `${myGroup.stories.length} حالة · ${formatRelative(myGroup.stories[0].created_at)}`
                : 'أضف تحديثًا يظهر لجهات اتصالك'}
            </span>
          </span>
          <Icon name="chevron" size={18} className="text-muted" />
        </button>
      </div>

      <h2 className="px-4 pb-2 pt-2 text-[12px] font-bold uppercase tracking-wide text-muted">
        تحديثات جهات الاتصال
      </h2>

      {feed === null ? (
        <div className="space-y-3 px-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex animate-pulse items-center gap-3">
              <span className="h-14 w-14 rounded-full bg-line" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 rounded bg-line" />
                <span className="block h-3 w-1/2 rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.filter((group) => !group.is_me).length === 0 ? (
        <EmptyState
          icon="stories"
          title="لا حالات جديدة"
          description="عندما ينشر من في جهات اتصالك حالة ستجدها هنا، ويمكنك نشر حالتك أنت أيضًا."
          action={
            <button type="button" className="btn-primary px-5" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={17} />
              انشر حالتك الأولى
            </button>
          }
        />
      ) : (
        <ul className="space-y-2 px-3">
          {groups.map((group, groupIndex) =>
            group.is_me ? null : (
              <li key={group.user.id}>
                <button
                  type="button"
                  onClick={() => openViewer(groupIndex)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-right shadow-sm"
                >
                  <span
                    className={`rounded-full p-[2.5px] ${
                      group.unseen ? 'bg-gradient-to-tr from-brand to-gold' : 'bg-line'
                    }`}
                  >
                    <span className="block rounded-full bg-white p-[2px]">
                      <Avatar user={group.user} size="md" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink">
                      {group.user.name || group.user.phone}
                    </span>
                    <span className="block text-[11.5px] text-muted">
                      {group.stories.length} تحديث · {formatRelative(group.stories[0].created_at)}
                    </span>
                  </span>
                  {group.unseen ? (
                    <span className="chip bg-brand text-white">{group.unseen} جديد</span>
                  ) : (
                    <span className="chip bg-canvas text-muted">تمت المشاهدة</span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="حالة جديدة">
        <div className="pb-4">
          <div
            className="relative mb-3 flex min-h-[190px] items-center justify-center overflow-hidden rounded-2xl p-4"
            style={{ backgroundColor: background }}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="معاينة الحالة" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="اكتب حالة…"
              maxLength={500}
              rows={3}
              className="relative z-10 w-full resize-none bg-transparent text-center text-[16px] font-bold leading-7 text-white placeholder:text-white/60 focus:outline-none"
            />
          </div>
          <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {BACKGROUNDS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`خلفية ${color}`}
                onClick={() => setBackground(color)}
                className={`h-8 w-8 shrink-0 rounded-full border-2 ${
                  background === color ? 'border-brand' : 'border-white'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              type="button"
              className="mr-auto shrink-0 rounded-full bg-brand-tint px-3 py-1.5 text-[11.5px] font-semibold text-brand"
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="image" size={15} className="inline" /> صورة
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickImage} />
          <button type="button" className="btn-primary w-full" onClick={publish} disabled={publishing}>
            {publishing ? 'جارٍ النشر…' : 'نشر الحالة'}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            تظهر حالتك لمن في جهات اتصالك وتُحذف تلقائيًا بعد ٢٤ ساعة.
          </p>
        </div>
      </Sheet>

      {currentStory ? (
        <div className="fixed inset-0 z-[70] bg-black">
          <div className="relative mx-auto flex h-full max-w-[480px] flex-col">
            <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-2 pt-2">
              {currentGroup.stories.map((story, index) => (
                <span key={story.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className={`block h-full bg-white ${
                      index < viewer.si ? 'w-full' : index === viewer.si ? 'story-progress' : 'w-0'
                    }`}
                  />
                </span>
              ))}
            </div>

            <div className="relative z-20 flex items-center gap-2 px-3 pt-5">
              <Avatar user={currentGroup.user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-white">
                  {currentGroup.user.name || currentGroup.user.phone}
                </p>
                <p className="text-[10.5px] text-white/70">
                  {formatRelative(currentStory.created_at)}
                </p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
                onClick={closeViewer}
                aria-label="إغلاق الحالة"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <button
              type="button"
              className="absolute inset-y-0 right-0 z-10 w-1/3"
              onClick={() => advance(-1)}
              aria-label="الحالة السابقة"
            />
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-1/3"
              onClick={() => advance(1)}
              aria-label="الحالة التالية"
            />

            <div className="flex flex-1 items-center justify-center overflow-hidden">
              {currentStory.media_id ? (
                <img
                  src={mediaUrl(currentStory.media_id)}
                  alt={currentStory.text || 'حالة'}
                  className="max-h-full w-full object-contain"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center p-8"
                  style={{ backgroundColor: currentStory.background }}
                >
                  <p className="text-center text-xl font-bold leading-9 text-white">
                    {currentStory.text}
                  </p>
                </div>
              )}
            </div>

            {currentStory.media_id && currentStory.text ? (
              <p className="absolute inset-x-0 bottom-20 z-20 px-6 text-center text-[13px] font-medium text-white">
                {currentStory.text}
              </p>
            ) : null}

            <div className="relative z-20 flex items-center justify-between px-5 pb-6 pt-4">
              {currentGroup.is_me ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-[11.5px] font-semibold text-white"
                    onClick={openViewers}
                  >
                    <Icon name="eye" size={16} />
                    المشاهدات
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-[11.5px] font-semibold text-white"
                    onClick={deleteStory}
                  >
                    <Icon name="trash" size={16} />
                    حذف
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-white/60">
                  تختفي هذه الحالة بعد ٢٤ ساعة من نشرها
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Sheet open={viewersOpen} onClose={() => setViewersOpen(false)} title="من شاهد الحالة">
        <div className="pb-4">
          {viewersList === null ? (
            <p className="py-6 text-center text-[12.5px] text-muted">جارٍ التحميل…</p>
          ) : viewersList.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted">لم يشاهد أحد الحالة بعد.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {viewersList.map((viewerItem) => (
                <li key={viewerItem.id} className="flex items-center gap-3 py-2.5">
                  <Avatar user={viewerItem} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">
                      {viewerItem.name || viewerItem.phone}
                    </p>
                    <p className="text-[11px] text-muted">{formatRelative(viewerItem.viewed_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  )
}
