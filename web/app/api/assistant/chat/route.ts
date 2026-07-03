import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { ASSISTANT_TOOLS, executeAssistantTool, type ToolContext } from '@/lib/ai/assistant-tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const OFF_TOPIC_REPLY = 'Я специализируюсь на данных вашей школы — учениках, классах, педагогах. Если есть вопросы по школе, с удовольствием помогу! 😊'

const SYSTEM_PROMPT = `Ты — AI-ассистент директора школы в системе Stride. Помогаешь директору и управлению разобраться в состоянии школы: учениках, классах, наблюдениях педагогов, зонах риска.

Правила:
- Ты отвечаешь ТОЛЬКО на вопросы про эту школу и её данные: учеников, классы, педагогов, наблюдения, риски, аналитику, ежемесячный отчёт. Если вопрос не про это (общие знания, посторонние темы, светская беседа, вопросы о тебе самом) — НЕ отвечай по существу и НЕ вызывай инструменты. Верни ДОСЛОВНО и без единого лишнего слова только такую фразу: "${OFF_TOPIC_REPLY}"
- Отвечай на русском, кратко и по делу, профессиональным но живым языком.
- ВСЕГДА опирайся на данные из инструментов. Никогда не выдумывай цифры, имена или факты. Если данных нет — так и скажи.
- Для ответа сначала вызови нужные инструменты, затем сформулируй вывод. Можешь вызвать несколько инструментов подряд.
- Ты видишь только данные своей школы и работаешь в режиме чтения — ничего не меняешь.
- Когда уместно, давай конкретные рекомендации, но помечай их как рекомендации и основывай строго на полученных данных.
- Не перечисляй сырые данные простынёй — обобщай, выделяй главное, называй конкретных учеников/классы/педагогов там, где это важно.
- Это чувствительные данные о детях. Будь тактичен и профессионален.`

interface ClientMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('school_id, role').eq('id', user.id).single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return new Response('Forbidden', { status: 403 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI не настроен', { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const clientMessages: ClientMessage[] = Array.isArray(body.messages) ? body.messages : []
  if (clientMessages.length === 0) return new Response('No messages', { status: 400 })

  const ctx: ToolContext = { supabase, schoolId: profile.school_id }

  const messages: Anthropic.MessageParam[] = clientMessages
    .filter(m => m.content?.trim())
    .map(m => ({ role: m.role, content: m.content }))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        // Агентный цикл: модель может вызывать инструменты несколько раз подряд.
        for (let step = 0; step < 8; step++) {
          const s = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            // Кэшируем статичный префикс (описания инструментов + системный промпт):
            // они одинаковы на каждом шаге цикла и в каждом сообщении → на повторах
            // Anthropic берёт ~10% цены вместо полной. Главная экономия токенов.
            system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
            tools: ASSISTANT_TOOLS,
            messages,
          })
          s.on('text', (t) => send({ type: 'text', text: t }))
          const final = await s.finalMessage()
          messages.push({ role: 'assistant', content: final.content })

          if (final.stop_reason === 'tool_use') {
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const block of final.content) {
              if (block.type === 'tool_use') {
                send({ type: 'tool', name: block.name })
                let result: unknown
                try {
                  result = await executeAssistantTool(block.name, block.input, ctx)
                } catch (e) {
                  result = { error: String(e) }
                }
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                })
              }
            }
            messages.push({ role: 'user', content: toolResults })
            continue // следующий шаг цикла — модель осмыслит результаты
          }
          break // end_turn — ответ готов
        }
        send({ type: 'done' })
      } catch (e) {
        console.error('[assistant] error:', e)
        send({ type: 'error', error: 'Не удалось получить ответ. Попробуйте ещё раз.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
