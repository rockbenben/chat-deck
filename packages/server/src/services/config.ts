import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import os from 'os'

function deriveKey(): Buffer {
  const fingerprint = `${os.hostname()}:${os.userInfo().username}:chat-deck`
  return crypto.createHash('sha256').update(fingerprint).digest()
}

function encrypt(text: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(encoded: string): string {
  if (!encoded.startsWith('enc:')) return encoded  // plaintext pre-migration
  const [, ivHex, tagHex, dataHex] = encoded.split(':')
  const key = deriveKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf-8')
}

export interface AppConfig {
  apiKeys: {
    gemini?: string
    openai?: string
    anthropic?: string
    qwen?: string
    deepseek?: string
    groq?: string
  }
  enabledProviders: Record<string, boolean>
}

const DEFAULT_CONFIG: AppConfig = {
  apiKeys: {},
  enabledProviders: {
    'claude-code': true,
    codex: true,
    gemini: true,
    qwen: true,
    deepseek: true,
    groq: true,
    ollama: true,
  },
}

export class ConfigService {
  private configPath: string
  private config: AppConfig = DEFAULT_CONFIG

  constructor(dataDir: string) {
    this.configPath = path.join(dataDir, 'config.json')
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const saved = JSON.parse(content)
      this.config = {
        apiKeys: { ...saved.apiKeys },
        enabledProviders: { ...DEFAULT_CONFIG.enabledProviders, ...saved.enabledProviders },
      }
      // Auto-migrate plaintext keys to encrypted form
      let needsSave = false
      for (const [k, v] of Object.entries(this.config.apiKeys)) {
        if (v && !v.startsWith('enc:')) {
          this.config.apiKeys[k as keyof typeof this.config.apiKeys] = encrypt(v)
          needsSave = true
        }
      }
      if (needsSave) await this.save()
    } catch {
      this.config = { ...DEFAULT_CONFIG, apiKeys: {}, enabledProviders: { ...DEFAULT_CONFIG.enabledProviders } }
    }
  }

  get(): AppConfig {
    return this.config
  }

  getMasked(): { apiKeys: Record<string, string>; enabledProviders: Record<string, boolean> } {
    const masked: Record<string, string> = {}
    for (const [key, val] of Object.entries(this.config.apiKeys)) {
      if (val) {
        const plain = decrypt(val)
        masked[key] = plain.length > 8 ? plain.slice(0, 4) + '...' + plain.slice(-4) : '****'
      } else {
        masked[key] = ''
      }
    }
    return { apiKeys: masked, enabledProviders: { ...this.config.enabledProviders } }
  }

  async updateApiKeys(keys: Record<string, string>): Promise<void> {
    for (const [key, val] of Object.entries(keys)) {
      if (['gemini', 'openai', 'anthropic', 'qwen', 'deepseek', 'groq'].includes(key)) {
        if (val && val.trim()) {
          (this.config.apiKeys as Record<string, string>)[key] = encrypt(val.trim())
        } else {
          delete (this.config.apiKeys as Record<string, string | undefined>)[key]
        }
      }
    }
    await this.save()
  }

  async updateEnabledProviders(enabled: Record<string, boolean>): Promise<void> {
    this.config.enabledProviders = { ...this.config.enabledProviders, ...enabled }
    await this.save()
  }

  isProviderEnabled(name: string): boolean {
    return this.config.enabledProviders[name] !== false
  }

  getApiKey(provider: string): string | undefined {
    const raw = (this.config.apiKeys as Record<string, string | undefined>)[provider]
    return raw ? decrypt(raw) : undefined
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
  }
}
