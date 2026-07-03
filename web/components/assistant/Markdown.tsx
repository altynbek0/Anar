import React from 'react'

// Лёгкий Markdown-рендерер под вывод ассистента: заголовки (#/##/###),
// **жирный**, *курсив*, `код`, маркированные/нумерованные списки, таблицы,
// --- и абзацы. Без внешних зависимостей — модель выдаёт это подмножество.

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

const splitRow = (l: string): string[] =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())

// Строка-разделитель таблицы: |---|:--:|---| (тире, двоеточия, пайпы, пробелы) + хотя бы одно тире
const isTableSep = (l: string): boolean => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-')

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '')

    // Таблица: строка с | и следующая строка-разделитель
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushList()
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2 // пропускаем заголовок и разделитель
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      i-- // компенсируем i++ в for
      blocks.push(
        <div key={key++} className="overflow-x-auto -mx-1">
          <table className="w-full text-xs border-collapse my-1">
            <thead>
              <tr>
                {header.map((h, j) => (
                  <th key={j} className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-gray-200 px-2 py-1.5 text-gray-700 align-top">{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (/^\s*-{3,}\s*$/.test(line)) { flushList(); blocks.push(<hr key={key++} className="my-3 border-gray-100" />); continue }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushList()
      const size = h[1].length === 1 ? 'text-base' : 'text-sm'
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
