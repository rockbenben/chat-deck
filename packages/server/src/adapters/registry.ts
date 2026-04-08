import type { CLIAdapter } from './types.js'
import type { ProviderInfo } from '@chat-deck/shared'

export class AdapterRegistry {
  private adapters = new Map<string, CLIAdapter>()
  private providerCache: ProviderInfo[] | null = null

  register(adapter: CLIAdapter): void {
    this.adapters.set(adapter.name, adapter)
  }

  get(name: string): CLIAdapter | undefined {
    return this.adapters.get(name)
  }

  getAll(): CLIAdapter[] {
    return [...this.adapters.values()]
  }

  /** Check all adapters once at startup, cache the result. */
  async buildProviderCache(): Promise<void> {
    this.providerCache = await Promise.all(
      [...this.adapters.values()].map(async (adapter) => ({
        name: adapter.name,
        displayName: adapter.displayName,
        command: adapter.command,
        installed: await adapter.checkInstalled(),
        enabled: true, // Actual enabled status is set by the route layer from config
        models: adapter.models,
        defaultModel: adapter.defaultModel,
      }))
    )
  }

  /** Return cached provider list. Falls back to live check if cache not built. */
  async listProviders(): Promise<ProviderInfo[]> {
    if (this.providerCache) return this.providerCache
    await this.buildProviderCache()
    return this.providerCache!
  }
}
