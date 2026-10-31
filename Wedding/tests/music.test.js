import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMusicController, createPreferenceStore, MUSIC_DEFAULT_VOLUME } from '../src/lib/musicController.js'

// Minimal stand-in for HTMLAudioElement: play() resolves or rejects like a browser.
class FakeAudio extends EventTarget {
  constructor(src, { refuse = null, ignoreVolume = false } = {}) {
    super()
    this.src = src
    this.paused = true
    this.refuse = refuse
    this.ignoreVolume = ignoreVolume
    this._volume = 1
    this.playCalls = 0
  }
  get volume() {
    return this._volume
  }
  set volume(v) {
    if (!this.ignoreVolume) this._volume = v
  }
  play() {
    this.playCalls++
    if (this.refuse) return Promise.reject(Object.assign(new Error('refused'), { name: this.refuse }))
    this.paused = false
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  pause() {
    if (this.paused) return
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
}

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), data }
}

function setup({ stored, audioOptions } = {}) {
  const storage = memoryStorage(stored ? { 'wedding.music': stored } : {})
  const created = []
  const controller = createMusicController({
    src: '/audio/wedding-background.mp3',
    preferences: createPreferenceStore(storage),
    createAudio: (src) => {
      const a = new FakeAudio(src, audioOptions)
      created.push(a)
      return a
    },
  })
  return { controller, storage, created }
}

describe('background music', () => {
  it('creates no audio (and downloads nothing) until the guest opts in', () => {
    const { controller, created } = setup()
    assert.equal(created.length, 0)
    assert.deepEqual(controller.getSnapshot(), { status: 'idle', preference: null, volume: MUSIC_DEFAULT_VOLUME, volumeAdjustable: true })
  })

  it('plays one looping track at a gentle volume and remembers the choice', async () => {
    const { controller, created, storage } = setup()
    assert.equal(await controller.enable(), true)
    assert.equal(created.length, 1)
    assert.equal(created[0].loop, true)
    assert.equal(created[0].src, '/audio/wedding-background.mp3')
    assert.ok(created[0].volume >= 0.25 && created[0].volume <= 0.35)
    assert.equal(controller.getSnapshot().status, 'playing')
    assert.equal(storage.data['wedding.music'], 'on')
  })

  it('never creates a second audio element or overlaps playback', async () => {
    const { controller, created } = setup()
    await controller.enable()
    await controller.enable()
    controller.disable()
    await controller.toggle()
    await controller.autoplay()
    assert.equal(created.length, 1)
    assert.equal(controller.getSnapshot().status, 'playing')
  })

  it('"continue without music" is remembered and creates nothing', () => {
    const { controller, created, storage } = setup()
    controller.disable()
    assert.equal(created.length, 0)
    assert.equal(controller.getSnapshot().preference, 'off')
    assert.equal(storage.data['wedding.music'], 'off')
  })

  it('a remembered "off" is never autoplayed', async () => {
    const { controller, created } = setup({ stored: 'off' })
    assert.equal(await controller.autoplay(), false)
    assert.equal(created.length, 0)
  })

  it('autoplays by default without recording a choice for the guest', async () => {
    const { controller, created, storage } = setup()
    assert.equal(await controller.autoplay(), true)
    assert.equal(created.length, 1)
    assert.equal(created[0].volume, 0.3)
    assert.equal(controller.getSnapshot().status, 'playing')
    assert.equal(storage.data['wedding.music'], undefined)
  })

  it('a blocked autoplay is retried (same element) on the next interaction', async () => {
    const { controller, created } = setup({ audioOptions: { refuse: 'NotAllowedError' } })
    assert.equal(await controller.autoplay(), false)
    assert.equal(controller.getSnapshot().status, 'blocked')
    created[0].refuse = null // the guest has now interacted
    assert.equal(await controller.autoplay(), true)
    assert.equal(created.length, 1)
    assert.equal(controller.getSnapshot().status, 'playing')
  })

  it('overlapping attempts share one play() call', async () => {
    const { controller, created } = setup()
    await Promise.all([controller.autoplay(), controller.autoplay(), controller.enable()])
    assert.equal(created.length, 1)
    assert.equal(created[0].playCalls, 1)
  })

  it('never autoplays again after the guest paused, this visit or the next', async () => {
    const { controller, created, storage } = setup()
    await controller.autoplay()
    controller.toggle()
    assert.equal(await controller.autoplay(), false)
    assert.equal(created[0].paused, true)
    const next = setup({ stored: storage.data['wedding.music'] })
    assert.equal(await next.controller.autoplay(), false)
  })

  it('a pause from outside (OS, video) is not undone by autoplay', async () => {
    const { controller, created } = setup()
    await controller.autoplay()
    created[0].pause()
    assert.equal(await controller.autoplay(), false)
    assert.equal(created[0].paused, true)
  })

  it('toggle pauses and then resumes', async () => {
    const { controller, created } = setup()
    await controller.enable()
    controller.toggle()
    assert.equal(controller.getSnapshot().status, 'paused')
    assert.equal(created[0].paused, true)
    await controller.toggle()
    assert.equal(controller.getSnapshot().status, 'playing')
  })

  it('steps aside for a video and returns afterwards', async () => {
    const { controller, created } = setup()
    await controller.enable()
    controller.pauseForMedia()
    assert.equal(created[0].paused, true)
    assert.equal(controller.getSnapshot().status, 'paused')
    assert.equal(await controller.resumeAfterMedia(), true)
    assert.equal(controller.getSnapshot().status, 'playing')
    // A second "video stopped" signal (pause + ended + unmount) does nothing more.
    assert.equal(await controller.resumeAfterMedia(), false)
  })

  it('does not resume after a video if the guest had paused the music', async () => {
    const { controller, created } = setup()
    await controller.enable()
    controller.disable()
    controller.pauseForMedia()
    assert.equal(await controller.resumeAfterMedia(), false)
    assert.equal(created[0].paused, true)
  })

  it('does not resume after a video if the guest paused during it', async () => {
    const { controller } = setup()
    await controller.enable()
    controller.pauseForMedia()
    controller.disable()
    assert.equal(await controller.resumeAfterMedia(), false)
    assert.equal(controller.getSnapshot().status, 'paused')
  })

  it('a video never starts music that was not playing', async () => {
    const { controller, created } = setup()
    controller.pauseForMedia()
    assert.equal(await controller.resumeAfterMedia(), false)
    assert.equal(created.length, 0)
  })

  it('reports a browser autoplay refusal as "blocked", without throwing', async () => {
    const { controller } = setup({ audioOptions: { refuse: 'NotAllowedError' } })
    assert.equal(await controller.enable(), false)
    assert.equal(controller.getSnapshot().status, 'blocked')
  })

  it('reports an unplayable file as "error"', async () => {
    const { controller } = setup({ audioOptions: { refuse: 'NotSupportedError' } })
    await controller.enable()
    assert.equal(controller.getSnapshot().status, 'error')
  })

  it('tracks pauses made outside the site (OS, headphones)', async () => {
    const { controller, created } = setup()
    await controller.enable()
    created[0].pause()
    assert.equal(controller.getSnapshot().status, 'paused')
  })

  it('clamps volume, and hides the slider where the browser ignores it (iPhone)', async () => {
    const { controller, created } = setup()
    await controller.enable()
    controller.setVolume(5)
    assert.equal(created[0].volume, 1)
    controller.setVolume(-1)
    assert.equal(controller.getSnapshot().volume, 0)

    const ios = setup({ audioOptions: { ignoreVolume: true } })
    await ios.controller.enable()
    assert.equal(ios.controller.getSnapshot().volumeAdjustable, false)
  })

  it('survives blocked storage (private browsing)', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    const prefs = createPreferenceStore(broken)
    assert.equal(prefs.get(), null)
    assert.doesNotThrow(() => prefs.set('on'))
  })

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { controller } = setup()
    let calls = 0
    const off = controller.subscribe(() => calls++)
    await controller.enable()
    const seen = calls
    assert.ok(seen > 0)
    off()
    controller.disable()
    assert.equal(calls, seen)
  })
})
