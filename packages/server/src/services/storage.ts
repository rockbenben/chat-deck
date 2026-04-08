import fs from 'fs/promises'
import path from 'path'

const SAFE_NAME_RE = /^[a-zA-Z0-9_.-]+$/

export class StorageService {
  constructor(private dataDir: string) {}

  private validateId(id: string): void {
    if (!SAFE_NAME_RE.test(id)) throw new Error(`Invalid id: ${id}`)
  }

  private validateSubdir(subdir: string): void {
    if (!SAFE_NAME_RE.test(subdir)) throw new Error(`Invalid subdir: ${subdir}`)
  }

  async init(): Promise<void> {
    await Promise.all([
      fs.mkdir(path.join(this.dataDir, 'profiles'), { recursive: true }),
      fs.mkdir(path.join(this.dataDir, 'sessions'), { recursive: true }),
      fs.mkdir(path.join(this.dataDir, 'templates'), { recursive: true }),
    ])
  }

  async writeJSON(subdir: string, id: string, data: unknown): Promise<void> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}.json`)
    const tmpPath = filePath + '.tmp'
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    try {
      await fs.rename(tmpPath, filePath)
    } catch {
      // On Windows, rename can fail if target is locked; clean up tmp
      try { await fs.unlink(tmpPath) } catch { /* best effort */ }
      throw new Error(`Failed to write ${subdir}/${id}`)
    }
  }

  async readJSON<T = unknown>(subdir: string, id: string): Promise<T | null> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}.json`)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null
      // File exists but is corrupt — log and treat as missing
      console.error(`Corrupt JSON file ${filePath}:`, err?.message)
      return null
    }
  }

  async listJSON<T = unknown>(subdir: string): Promise<T[]> {
    this.validateSubdir(subdir)
    const dirPath = path.join(this.dataDir, subdir)
    try {
      const files = await fs.readdir(dirPath)
      // Filter out .tmp leftovers from interrupted writes
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))

      // Concurrency-limited reads to avoid fd exhaustion with many files
      const results: (T | null)[] = []
      const BATCH = 50
      for (let i = 0; i < jsonFiles.length; i += BATCH) {
        const batch = jsonFiles.slice(i, i + BATCH)
        const batchResults = await Promise.all(
          batch.map(file =>
            fs.readFile(path.join(dirPath, file), 'utf-8')
              .then(content => JSON.parse(content) as T)
              .catch(() => null as T | null)
          )
        )
        results.push(...batchResults)
      }
      return results.filter((item): item is T => item !== null)
    } catch {
      return []
    }
  }

  async deleteJSON(subdir: string, id: string): Promise<void> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}.json`)
    try {
      await fs.unlink(filePath)
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err
    }
  }

  getFilePath(subdir: string, id: string): string {
    this.validateSubdir(subdir)
    this.validateId(id)
    return path.join(this.dataDir, subdir, `${id}.json`)
  }

  get basePath(): string {
    return this.dataDir
  }

  // --- JSONL helpers ---

  async appendLine(subdir: string, id: string, ext: string, data: unknown): Promise<void> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}${ext}`)
    const line = JSON.stringify(data) + '\n'
    await fs.appendFile(filePath, line, 'utf-8')
  }

  async readLines<T>(subdir: string, id: string, ext: string): Promise<T[]> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}${ext}`)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line) as T)
    } catch (err: any) {
      if (err.code === 'ENOENT') return []
      throw err
    }
  }

  async readLinesPaginated<T>(subdir: string, id: string, ext: string, offset: number, limit: number): Promise<{ items: T[]; total: number }> {
    const all = await this.readLines<T>(subdir, id, ext)
    return { items: all.slice(offset, offset + limit), total: all.length }
  }

  async truncateLines(subdir: string, id: string, ext: string, keepCount: number): Promise<void> {
    this.validateSubdir(subdir)
    this.validateId(id)
    const filePath = path.join(this.dataDir, subdir, `${id}${ext}`)
    const all = await this.readLines<unknown>(subdir, id, ext)
    const kept = all.slice(0, keepCount)
    const content = kept.map(item => JSON.stringify(item)).join('\n') + (kept.length ? '\n' : '')
    const tmp = filePath + '.tmp'
    await fs.writeFile(tmp, content, 'utf-8')
    await fs.rename(tmp, filePath)
  }

  async deleteFile(subdir: string, id: string, ext: string): Promise<void> {
    this.validateSubdir(subdir)
    this.validateId(id)
    try {
      await fs.unlink(path.join(this.dataDir, subdir, `${id}${ext}`))
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
