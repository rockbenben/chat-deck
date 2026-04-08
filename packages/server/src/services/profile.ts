import { v4 as uuid } from 'uuid'
import type { Profile, CreateProfileInput, UpdateProfileInput } from '@chat-deck/shared'
import type { StorageService } from './storage.js'

export class ProfileService {
  constructor(private storage: StorageService) {}

  async create(input: CreateProfileInput): Promise<Profile> {
    const now = new Date().toISOString()
    const profile: Profile = {
      id: uuid(),
      name: input.name,
      systemPrompt: input.systemPrompt,
      cliProvider: input.cliProvider,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
    }
    await this.storage.writeJSON('profiles', profile.id, profile)
    return profile
  }

  async list(): Promise<Profile[]> {
    return this.storage.listJSON<Profile>('profiles')
  }

  async getById(id: string): Promise<Profile | null> {
    return this.storage.readJSON<Profile>('profiles', id)
  }

  async update(id: string, input: UpdateProfileInput): Promise<Profile | null> {
    const existing = await this.getById(id)
    if (!existing) return null
    // Only apply known mutable fields — preserve id/createdAt
    if (input.name !== undefined) existing.name = input.name
    if (input.systemPrompt !== undefined) existing.systemPrompt = input.systemPrompt
    if (input.cliProvider !== undefined) existing.cliProvider = input.cliProvider
    if (input.icon !== undefined) existing.icon = input.icon
    existing.updatedAt = new Date().toISOString()
    await this.storage.writeJSON('profiles', id, existing)
    return existing
  }

  async delete(id: string): Promise<void> {
    await this.storage.deleteJSON('profiles', id)
  }
}
