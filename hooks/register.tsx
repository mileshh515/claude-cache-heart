import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CacheHit } from '../types'
import { COLD, WARM, heartRgba, heartSvg } from './pixels'

const last = atom({ plugin: 'cache-heart', key: 'last' } as const, null)
const now = atom({ plugin: 'cache-heart', key: 'now' } as const, 0)

const MINUTE = 60_000

export const register: Register = (on, options) => {
  const ttl = Number(options.ttlMinutes ?? '60') * MINUTE

  on('session.start', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, now, () => t)
    // Redraw every 30s, so the heart drains without a turn.
    $.clock.every(30_000, async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
    })

    return next(e)
  })

  // Every main-thread request reads or rewrites the cache: note when, and how.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage

    if (e.agentId === undefined && usage !== null) {
      const at = await $.clock.now()
      const hit: CacheHit = {
        at,
        read: usage.cache_read_input_tokens,
        written: usage.cache_creation_input_tokens,
        uncached: usage.input_tokens,
      }
      await update($, last, () => hit)
      await update($, now, () => at)
    }

    return result
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const heart = describeHeart(await read($, last), await read($, now), ttl)
    const palette = heart.isCold ? COLD : WARM
    const modes =
      e.props.modes.length > 0 ? `${e.props.modes.join(' & ')} · ` : ''

    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)

      return (
        <Box flexDirection="row" gap={1}>
          {modes !== '' && <Text dimColor>{modes}</Text>}
          <Image
            source={heartRgba(heart.level, palette)}
            columns={2}
            rows={1}
            alt={heart.level > 0 ? '♥' : '♡'}
          />
          <Text dimColor>{heart.label}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        {modes !== '' && <Text dimColor>{modes}</Text>}
        <Svg source={heartSvg(heart.level, palette)} alt={heart.alt} width={22} height={20} />
        <Text dimColor>{heart.label}</Text>
      </Box>
    )
  })
}

type Heart = { level: number; label: string; alt: string; isCold: boolean }

function describeHeart(hit: CacheHit | null, t: number, ttl: number): Heart {
  if (hit === null) {
    return { level: 0, label: 'cache', alt: 'Cache: no requests yet', isCold: true }
  }

  const left = hit.at + ttl - Math.max(t, hit.at)

  if (left <= 0) {
    return { level: 0, label: 'cold', alt: 'Cache: expired', isCold: true }
  }

  const minutes = Math.ceil(left / MINUTE)
  const total = hit.read + hit.written + hit.uncached
  const pct = total === 0 ? 0 : Math.round((100 * hit.read) / total)

  return {
    level: left / ttl,
    label: `${minutes}m · ${pct}%`,
    alt: `Cache warm: ${minutes} minutes left, ${pct}% hit`,
    isCold: false,
  }
}
