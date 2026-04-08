import type { Message } from '@chat-deck/shared'
import { BaseAdapter, type ApiRequest } from './base.js'

export abstract class OpenAICompatAdapter extends BaseAdapter {
  abstract apiUrl: string

  buildApiRequest(messages: Message[], systemPrompt: string, model: string): ApiRequest {
    const apiKey = this.getApiKey()!
    const body = {
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...this.formatMessages(messages),
      ],
    }
    return {
      url: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  }

  parseStreamChunk(data: Record<string, unknown>): string | null {
    const choices = data.choices as Array<{ delta?: { content?: string } }> | undefined
    return choices?.[0]?.delta?.content || null
  }
}
