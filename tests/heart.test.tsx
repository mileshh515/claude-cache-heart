import { expect, test } from 'claude-code/testing'

const MODE = {
  plugin: 'cache-heart',
  component: 'SessionMode',
  props: { modes: [] as string[] },
} as const

const MIN = 60_000

function seed(on: Parameters<Parameters<typeof test>[1]>[1], last: unknown, now: number) {
  on('state.get', (_, e) => ({
    value: { value: e.key === 'last' ? last : now, version: 1 },
  }))
}

test('an empty heart before the first response', async ($, on) => {
  seed(on, null, 0)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MODE, surface })
    expect((await ui.find({ type: 'Text', text: /cache/ }))?.text).toBe('cache')
    await ui.unmount()
  }
})

test('a full heart counts down the 1h TTL and shows the hit rate', async ($, on) => {
  seed(on, { at: 0, read: 90, written: 10, uncached: 0 }, 18 * MIN)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MODE, surface })
    expect((await ui.find({ type: 'Text', text: /m · / }))?.text).toBe('42m · 90%')
    await ui.unmount()
  }
})

test('the heart empties once the TTL has passed', async ($, on) => {
  seed(on, { at: 0, read: 90, written: 10, uncached: 0 }, 61 * MIN)
  const ui = await $.ui.mount({ ...MODE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /cold/ }))?.text).toBe('cold')
  await ui.unmount()
})

test('the engine modes stay beside the heart', async ($, on) => {
  seed(on, null, 0)
  const ui = await $.ui.mount({ ...MODE, props: { modes: ['focus'] }, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /focus/ })).toBeDefined()
  await ui.unmount()
})

test('the 5-minute TTL option', { options: { ttlMinutes: '5' } }, async ($, on) => {
  seed(on, { at: 0, read: 1, written: 0, uncached: 0 }, 1 * MIN)
  const ui = await $.ui.mount({ ...MODE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /m · / }))?.text).toBe('4m · 100%')
  await ui.unmount()
})

test('the heart is drawn as pixels on each surface', async ($, on) => {
  seed(on, { at: 0, read: 1, written: 0, uncached: 0 }, 30 * MIN)
  const term = await $.ui.mount({ ...MODE, surface: 'terminal' })
  expect(await term.find({ type: 'Image' })).toBeDefined()
  await term.unmount()
  const desk = await $.ui.mount({ ...MODE, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()
})
