import { v4 as uuid } from 'uuid'
import type { Template, CreateTemplateInput, UpdateTemplateInput } from '@chat-deck/shared'
import type { StorageService } from './storage.js'

export class TemplateService {
  constructor(private storage: StorageService) {}

  async list(): Promise<Template[]> {
    return this.storage.listJSON<Template>('templates')
  }

  async getById(id: string): Promise<Template | null> {
    return this.storage.readJSON<Template>('templates', id)
  }

  async create(input: CreateTemplateInput): Promise<Template> {
    const template: Template = {
      id: uuid(),
      ...input,
      createdAt: new Date().toISOString(),
    }
    await this.storage.writeJSON('templates', template.id, template)
    return template
  }

  async update(id: string, input: UpdateTemplateInput): Promise<Template | null> {
    const template = await this.getById(id)
    if (!template) return null
    // Only apply known mutable fields — prevent overwriting id/createdAt
    if (input.name !== undefined) template.name = input.name
    if (input.description !== undefined) template.description = input.description
    if (input.systemPrompt !== undefined) template.systemPrompt = input.systemPrompt
    if (input.firstMessage !== undefined) template.firstMessage = input.firstMessage
    if (input.category !== undefined) template.category = input.category
    await this.storage.writeJSON('templates', id, template)
    return template
  }

  async delete(id: string): Promise<void> {
    await this.storage.deleteJSON('templates', id)
  }
}
