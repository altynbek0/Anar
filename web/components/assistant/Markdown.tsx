import React from 'react'

// Лёгкий Markdown-рендерер под вывод ассистента: заголовки (#/##/###),
// **жирный**, *курсив*, `код`, маркированные/нумерованные списки, --- и абзацы.
// Без внешних зависимостей — модель выдаёт ровно этот подмножество.

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) nodes.push(<strong key={key++} className="font-semibold text-gray-900">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono text-gray-800">{tok.slice(1, -1)}</code>)
    else nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let key = 0

  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => (
      <li key={i} className="leading-relaxed">{renderInline(it)}</li>
    ))
    blocks.push(
      list.ordered
        ? <ol key={key++} className="list-decimal pl-5 space-y-1">{items}</ol>
        : <ul key={key++} className="list-disc pl-5 space-y-1">{items}</ul>
    )
    list = null
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    if (/^\s*-{3,}\s*$/.test(line)) { flushList(); blocks.push(<hr key={key++} className="my-3 border-gray-100" />); continue }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushList()
      const size = h[1].length === 1 ? 'text-base' : h[1].length === 2 ? 'text-sm' : 'text-sm'
      blocks.push(<p key={key++} className={`${size} font-semibold text-gray-900 mt-1`}>{renderInline(h[2])}</p>)
      continue
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) { if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] } } list.items.push(ul[1]); continue }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ol) { if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] } } list.items.push(ol[1]); continue }

    if (line.trim() === '') { flushList(); continue }

    flushList()
    blocks.push(<p key={key++} className="leading-relaxed">{renderInline(line)}</p>)
  }
  flushList()

  return <div className="space-y-2">{blocks}</div>
}
