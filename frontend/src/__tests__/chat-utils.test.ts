import { describe, it, expect } from 'vitest'
import { CHAT_BATCH_SIZE, sanitizeChatContent } from '@/lib/chat-utils'

describe('sanitizeChatContent', () => {
  it('échappe < et > et trim', () => {
    expect(sanitizeChatContent('  <b>Salut</b>  ')).toEqual({
      ok: true,
      content: '&lt;b&gt;Salut&lt;/b&gt;',
    })
  })

  it('refuse un contenu vide après trim', () => {
    expect(sanitizeChatContent('   ')).toEqual({
      ok: false,
      error: 'Le message ne peut pas être vide.',
    })
  })

  it('refuse quand la longueur APRÈS échappement dépasse 2048', () => {
    // 2040 caractères bruts, mais 10 × < devient 10 × &lt; = 2070 après échappement
    const content = '<'.repeat(10) + 'a'.repeat(2030)
    expect(sanitizeChatContent(content)).toEqual({
      ok: false,
      error: 'Le message est trop long.',
    })
  })

  it('accepte un message nominal de 2048 exactement', () => {
    const content = 'a'.repeat(2048)
    expect(sanitizeChatContent(content)).toEqual({ ok: true, content })
  })
})

describe('CHAT_BATCH_SIZE', () => {
  it('vaut 50 (contrat de lot du chantier chats)', () => {
    expect(CHAT_BATCH_SIZE).toBe(50)
  })
})
