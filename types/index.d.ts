export type CacheHit = {
  at: number
  read: number
  written: number
  uncached: number
}

declare module 'claude-code' {
  interface PluginState {
    'cache-heart': { last: CacheHit | null; now: number }
  }
}
