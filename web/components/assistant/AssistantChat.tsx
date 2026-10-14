'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { Send, Loader2, X } from 'lucide-react'
import { Markdown } from './Markdown'

interface Msg { role: 'user' | 'assistant'; content: string }

const TOOL_LABELS: Record<string, string> = {
  get_school_overview: 'смотрю сводку по школе',
  list_at_risk_students: 'смотрю зону риска',
  get_class_stats: 'считаю статистику классов',
  find_students: 'ищу учеников',
  get_student_details: 'открываю профиль ученика',
  search_observations: 'ищу по наблюдениям',
  get_teacher_activity: 'смотрю активность педагогов',
  get_latest_school_report: 'открываю месячный отчёт',
}

const SUGGESTIONS = [
  'Как дела в школе в целом?',
  'Кто сейчас в зоне риска и почему?',
  'Сравни классы по активности за месяц',
  'Какие педагоги давно не писали наблюдений?',
]

export function AssistantChat({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, toolStatus])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const history = [...messages, { role: 'user' as const, content: q }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)
    setToolStatus(null)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) {
        let errText = 'Не удалось получить ответ.'
        if (res.status === 403) errText = 'Нет доступа к ассистенту.'
        else if (res.status === 429) {
          const j = await res.json().catch(() => null)
          errText = j?.message ?? 'Достигнут дневной лимит запросов для вашей школы.'
        }
        setMessages(m => appendToLast(m, errText))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotText = false

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          let evt: { type: string; text?: string; name?: string; error?: string }
          try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }

          if (evt.type === 'text' && evt.text) {
            gotText = true
            setToolStatus(null)
            setMessages(m => appendToLast(m, evt.text!))
          } else if (evt.type === 'tool') {
            setToolStatus(TOOL_LABELS[evt.name ?? ''] ?? 'обращаюсь к данным')
          } else if (evt.type === 'error') {
            setMessages(m => appendToLast(m, evt.error ?? 'Ошибка.'))
          }
        }
      }
      if (!gotText) setMessages(m => appendToLast(m, 'Пустой ответ. Попробуйте переформулировать.'))
    } catch {
      setMessages(m => appendToLast(m, 'Ошибка соединения. Попробуйте ещё раз.'))
    } finally {
      setBusy(false)
      setToolStatus(null)
    }
  }

  const empty = messages.length === 0

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <Image src="/icon.png" alt="Anar" width={32} height={32} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 truncate">AI-ассистент директора</h1>
          <p className="text-[11px] text-gray-400 truncate">Отвечает по данным вашей школы</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5 space-y-4">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Image src="/icon.png" alt="Anar" width={48} height={48} className="w-12 h-12 rounded-2xl object-cover mb-3" />
            <p className="text-sm text-gray-600 font-medium">Спросите что угодно о вашей школе</p>
            <p className="text-xs text-gray-400 mt-1 mb-5">Ученики, классы, наблюдения, зоны риска</p>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs text-gray-600 bg-gray-50 hover:bg-[#F3F4F6] hover:text-[#111827] border border-gray-100 rounded-xl px-3 py-2.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const isLast = i === messages.length - 1
            if (m.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-[#111827] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] text-sm text-gray-800">
                  {m.content ? (
                    <Markdown text={m.content} />
                  ) : (busy && isLast && (
                    <span className="inline-flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {toolStatus ?? 'думаю…'}
                    </span>
                  ))}
                  {m.content && busy && isLast && toolStatus && (
                    <span className="inline-flex items-center gap-1.5 text-gray-400 text-xs mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />{toolStatus}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100 focus-within:border-[#111827]/40 transition-colors">
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
            }}
            rows={1}
            placeholder="Спросите об учениках, классах, рисках…"
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 max-h-32 py-1"
            disabled={busy}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="w-8 h-8 rounded-xl bg-[#111827] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#030712] transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-300 text-center mt-1.5">Ассистент опирается на данные школы и может ошибаться. Проверяйте важное.</p>
      </div>
    </div>
  )
}

function appendToLast(messages: Msg[], text: string): Msg[] {
  const copy = [...messages]
  const last = copy[copy.length - 1]
  if (last && last.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + text }
  return copy
}
