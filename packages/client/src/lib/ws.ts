interface WsOutgoing {
  type: string
  sessionId: string
  content?: string
  providers?: string[]
  regenerate?: boolean
  provider?: string
  model?: string
  comparison?: Record<string, unknown>
  stateless?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic event data; consumers narrow the type
type MessageHandler = (data: any) => void

const MAX_RECONNECT_ATTEMPTS = 10

export class ChatWebSocket {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private reconnectAttempts = 0
  private closedIntentionally = false

  connect(): void {
    this.closedIntentionally = false

    // Detach old socket handlers so its onclose won't trigger reconnect
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/chat`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectDelay = 1000
      this.reconnectAttempts = 0
      this.handlers.get('__connected')?.forEach(fn => fn({ type: '__connected' }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const type = data?.type as string | undefined
        if (type) {
          this.handlers.get(type)?.forEach(fn => fn(data))
          this.handlers.get('*')?.forEach(fn => fn(data))
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      this.handlers.get('__disconnected')?.forEach(fn => fn({ type: '__disconnected' }))
      if (this.ws === ws && !this.closedIntentionally) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  send(data: WsOutgoing): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    }
    return false
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false
  }

  disconnect(): void {
    this.closedIntentionally = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
  }
}

export const chatWs = new ChatWebSocket()
