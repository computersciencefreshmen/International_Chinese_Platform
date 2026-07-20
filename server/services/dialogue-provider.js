import { z } from 'zod'

const generatedSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    turns: z
      .array(
        z.object({
          speaker: z.enum(['student', 'tutor', 'system']),
          content: z.string().trim().min(1).max(4000)
        })
      )
      .min(2)
      .max(20)
  })
  .strict()

const replySchema = z
  .object({ reply: z.string().trim().min(1).max(4000) })
  .strict()

const MAX_PROVIDER_RESPONSE_BYTES = 128 * 1024

function localTitle(keywords) {
  return `${keywords.slice(0, 3).join(' · ')} 对话练习`
}

function localDialogue(keywords) {
  const topic = keywords.join('、')
  const focus = keywords[0]
  return {
    title: localTitle(keywords),
    turns: [
      {
        speaker: 'system',
        content: `本次练习围绕“${topic}”展开，请尽量使用完整中文句子。`
      },
      {
        speaker: 'tutor',
        content: `你好！今天我们来练习“${topic}”。你能先用“${focus}”说一句话吗？`
      }
    ]
  }
}

function localReply({ keywords, message }) {
  const focus = keywords.find((keyword) => message.includes(keyword))
  if (focus) {
    return `很好，你已经正确使用了“${focus}”。可以再补充时间、地点或原因，让句子更完整吗？`
  }

  return `我明白了。试着把“${keywords[0]}”放进刚才的句子里，再说一遍吧。`
}

async function requestExternal({ apiUrl, apiKey, payload, schema }) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000)
  })

  if (!response.ok) {
    throw new Error(`AI provider returned HTTP ${response.status}`)
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new Error('AI provider response exceeds the size limit')
  }

  const responseText = await response.text()
  if (
    new TextEncoder().encode(responseText).byteLength >
    MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new Error('AI provider response exceeds the size limit')
  }

  return schema.parse(JSON.parse(responseText))
}

export function createDialogueProvider({
  apiUrl = '',
  apiKey = '',
  logger
} = {}) {
  const externalEnabled = Boolean(apiUrl)

  return Object.freeze({
    async generate({ keywords, title }) {
      if (externalEnabled) {
        try {
          const generated = await requestExternal({
            apiUrl,
            apiKey,
            payload: {
              task: 'generate-dialogue',
              language: 'zh-CN',
              keywords,
              title: title || undefined
            },
            schema: generatedSchema
          })
          return {
            provider: 'external',
            title: title || generated.title || localTitle(keywords),
            turns: generated.turns
          }
        } catch (error) {
          logger?.warn?.(
            { err: error },
            'AI provider unavailable; using local dialogue'
          )
        }
      }

      const generated = localDialogue(keywords)
      return {
        provider: 'local',
        title: title || generated.title,
        turns: generated.turns
      }
    },

    async reply({ keywords, history, message }) {
      if (externalEnabled) {
        try {
          const generated = await requestExternal({
            apiUrl,
            apiKey,
            payload: {
              task: 'continue-dialogue',
              language: 'zh-CN',
              keywords,
              history,
              message
            },
            schema: replySchema
          })
          return { provider: 'external', content: generated.reply }
        } catch (error) {
          logger?.warn?.(
            { err: error },
            'AI provider unavailable; using local reply'
          )
        }
      }

      return {
        provider: 'local',
        content: localReply({ keywords, message })
      }
    }
  })
}

export default createDialogueProvider
