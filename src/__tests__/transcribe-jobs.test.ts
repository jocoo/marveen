import { describe, it, expect, beforeAll } from 'vitest'
import {
  initDatabase,
  createTranscribeJob,
  getTranscribeJob,
  listTranscribeJobs,
  markTranscribeJobRunning,
  finishTranscribeJob,
  markOrphanedTranscribeJobsFailed,
} from '../db.js'

beforeAll(() => {
  initDatabase(':memory:')
})

describe('transcribe_jobs', () => {
  it('walks queued -> running -> done and persists the transcript', () => {
    const job = createTranscribeJob({ id: 'job1', srcPath: '/tmp/a.wav', model: 'large-v3', diarize: false, requester: 'kronk' })
    expect(job.status).toBe('queued')
    expect(job.diarize).toBe(0)

    markTranscribeJobRunning('job1')
    expect(getTranscribeJob('job1')?.status).toBe('running')
    expect(getTranscribeJob('job1')?.started_at).not.toBeNull()

    finishTranscribeJob('job1', { status: 'done', transcript: 'hello world', transcriptPath: '/tmp/a.whisper.json' })
    const done = getTranscribeJob('job1')!
    expect(done.status).toBe('done')
    expect(done.transcript).toBe('hello world')
    expect(done.transcript_path).toBe('/tmp/a.whisper.json')
    expect(done.finished_at).not.toBeNull()
  })

  it('records failures with the error surface', () => {
    createTranscribeJob({ id: 'job2', srcPath: '/tmp/b.wav', model: 'small', diarize: true, notifyAgent: 'cuzcoo' })
    finishTranscribeJob('job2', { status: 'failed', error: 'exit 1; tail: boom' })
    const failed = getTranscribeJob('job2')!
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('boom')
    expect(failed.notify_agent).toBe('cuzcoo')
  })

  it('reaps queued/running jobs as failed on boot, leaving finished ones alone', () => {
    createTranscribeJob({ id: 'job3', srcPath: '/tmp/c.wav', model: 'large-v3', diarize: false })
    createTranscribeJob({ id: 'job4', srcPath: '/tmp/d.wav', model: 'large-v3', diarize: false })
    markTranscribeJobRunning('job4')

    const reaped = markOrphanedTranscribeJobsFailed()
    // returns the orphaned rows so boot can notify their notify_agent
    expect(reaped.map((j) => j.id).sort()).toEqual(['job3', 'job4'])
    expect(getTranscribeJob('job3')?.status).toBe('failed')
    expect(getTranscribeJob('job4')?.error).toContain('orphaned')
    // finished jobs from earlier tests untouched
    expect(getTranscribeJob('job1')?.status).toBe('done')
    expect(listTranscribeJobs().length).toBeGreaterThanOrEqual(4)
  })
})

describe('replaceSuffix (pathlib.with_suffix mirror)', () => {
  it('matches transcribe.py output derivation for multi-dot and plain names', async () => {
    const { replaceSuffix } = await import('../web/routes/transcribe.js')
    // transcribe_only.py: Path(x).with_suffix('.whisper.json')
    expect(replaceSuffix('/tmp/rec.2024.01.wav', '.whisper.json')).toBe('/tmp/rec.2024.01.whisper.json')
    // transcribe.py: with_suffix('') then with_suffix('.transcript.md') REPLACES the residual suffix
    expect(replaceSuffix(replaceSuffix('/tmp/rec.2024.01.wav', ''), '.transcript.md')).toBe('/tmp/rec.2024.transcript.md')
    expect(replaceSuffix(replaceSuffix('/tmp/audio.wav', ''), '.transcript.md')).toBe('/tmp/audio.transcript.md')
    // a dot in a DIRECTORY name must never be treated as an extension
    expect(replaceSuffix('/tmp/dir.d/audio', '.whisper.json')).toBe('/tmp/dir.d/audio.whisper.json')
  })
})
