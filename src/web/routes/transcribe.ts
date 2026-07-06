import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { readBody, json, RequestBodyTooLargeError } from '../http-helpers.js'
import { logger } from '../../logger.js'
import { getEffectiveSettingValue } from '../../settings-store.js'
import {
  createAgentMessage,
  createTranscribeJob,
  finishTranscribeJob,
  getTranscribeJob,
  listTranscribeJobs,
  markTranscribeJobRunning,
  type TranscribeJob,
} from '../../db.js'
import type { RouteContext } from './types.js'

// Long-form transcription service over the WhisperX install (large-v3,
// optional pyannote speaker diarization). This deliberately complements --
// never replaces -- the fast faster-whisper voice-note path in voice.ts:
// that one answers in seconds inside the message-router's budget, this one
// handles meetings/long audio where a single job runs for MINUTES to HOURS
// on this CPU-only host (measured: model load ~5 min + ~4x realtime, and
// 15-20 min per 3 min audio with diarization). Hence: async job queue,
// MAX 1 concurrent child (CPU contention would degrade the whole fleet),
// nice-d subprocess, jobs persisted in SQLite and orphan-reaped on boot.

const ALLOWED_EXT = new Set(['.wav', '.mp3', '.ogg', '.oga', '.m4a', '.opus', '.flac', '.webm', '.mp4', '.aac'])
const ALLOWED_MODELS = new Set(['large-v3', 'medium', 'medium.en', 'small'])
const MAX_SRC_BYTES = 1024 * 1024 * 1024 // 1 GB
const MAX_STORED_TRANSCRIPT = 512 * 1024

function whisperxDir(): string {
  const v = getEffectiveSettingValue('WHISPERX_DIR')
  return typeof v === 'string' && v.trim() ? v.trim() : '/home/jocoo/whisperx-poc'
}

function defaultModel(): string {
  const v = getEffectiveSettingValue('WHISPERX_DEFAULT_MODEL')
  return typeof v === 'string' && ALLOWED_MODELS.has(v) ? v : 'large-v3'
}

function timeoutMs(): number {
  const v = Number(getEffectiveSettingValue('WHISPERX_TIMEOUT_MIN'))
  const min = Number.isFinite(v) && v >= 5 && v <= 1440 ? v : 120
  return min * 60 * 1000
}

/** Mirrors python pathlib.with_suffix on the basename: strip a trailing
 *  .suffix when one exists (never crossing a path separator), then append.
 *  Exported for tests -- it must track transcribe.py's pathlib semantics. */
export function replaceSuffix(p: string, newSuffix: string): string {
  return p.replace(/\.[^./\\]+$/, '') + newSuffix
}

function installState(): { installed: boolean; reason?: string } {
  const dir = whisperxDir()
  const py = join(dir, '.venv', 'bin', 'python')
  if (!existsSync(py)) return { installed: false, reason: `no venv python at ${py}` }
  if (!existsSync(join(dir, 'transcribe_only.py'))) return { installed: false, reason: `no transcribe_only.py in ${dir}` }
  return { installed: true }
}

/** Parse KEY=VALUE lines (the PoC .env holds HF_TOKEN for pyannote diarization). */
function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env -- diarization will report its own error */
  }
  return out
}

// --- single-worker in-process queue (persisted rows are the source of truth) ---
const queue: string[] = []
let workerBusy = false

function enqueueJob(id: string): void {
  queue.push(id)
  void drainQueue()
}

async function drainQueue(): Promise<void> {
  if (workerBusy) return
  workerBusy = true
  try {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await runJob(id)
      } catch (err) {
        // A store hiccup (e.g. SQLITE_BUSY from CLI writers) must neither
        // strand the job as 'running' nor kill the queue for the jobs behind it.
        logger.error(`[transcribe] job ${id} runner threw: ${err instanceof Error ? err.message : err}`)
        try {
          finishTranscribeJob(id, { status: 'failed', error: `runner error: ${err instanceof Error ? err.message : String(err)}` })
        } catch {
          /* row stays running; boot-time orphan reap is the backstop */
        }
      }
    }
  } finally {
    workerBusy = false
  }
}

async function runJob(id: string): Promise<void> {
  const job = getTranscribeJob(id)
  if (!job || job.status !== 'queued') return
  markTranscribeJobRunning(id)
  const dir = whisperxDir()
  const py = join(dir, '.venv', 'bin', 'python')
  const script = job.diarize ? 'transcribe.py' : 'transcribe_only.py'
  const env: NodeJS.ProcessEnv = { ...process.env, ...(job.diarize ? readEnvFile(join(dir, '.env')) : {}) }
  logger.info(`[transcribe] job ${id} starting: ${script} ${job.src_path} --model ${job.model}`)

  const budgetMs = timeoutMs()
  const outcome = await new Promise<{ code: number; stderrTail: string; timedOut: boolean }>((resolve) => {
    const proc = spawn('nice', ['-n', '10', py, join(dir, script), job.src_path, '--model', job.model], {
      cwd: dir,
      env,
      shell: false,
    })
    let stderrTail = ''
    let timedOut = false
    const keepTail = (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-4000)
    }
    proc.stdout.on('data', keepTail)
    proc.stderr.on('data', keepTail)
    const timer = setTimeout(() => {
      timedOut = true
      logger.error(`[transcribe] job ${id} timed out after ${Math.round(budgetMs / 60000)} min, SIGKILL`)
      proc.kill('SIGKILL')
    }, budgetMs)
    proc.on('close', (code) => {
      clearTimeout(timer)
      // A python traceback in the tail could echo environment content; make
      // sure the diarization HF token never lands in a DB row or API response.
      const hf = env.HF_TOKEN
      if (hf) stderrTail = stderrTail.split(hf).join('<redacted>')
      resolve({ code: code ?? 1, stderrTail, timedOut })
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      stderrTail += `\nspawn error: ${err.message}`
      resolve({ code: 127, stderrTail, timedOut })
    })
  })

  const result = collectJobResult(job, outcome)
  finishTranscribeJob(id, result)
  logger.info(`[transcribe] job ${id} ${result.status}${result.error ? `: ${result.error}` : ''}`)
  if (job.notify_agent) {
    // Control characters in a (hostile) filename must not fabricate extra
    // lines/directives inside another agent's prompt stream.
    const safePath = job.src_path.replace(/[\r\n\t\x00-\x1f]/g, ' ')
    const summary =
      result.status === 'done'
        ? `[transcribe] Job ${id} kész: ${safePath} átirata elérhető. GET /api/transcribe/${id} vagy fájl: ${result.transcriptPath ?? 'n/a'}`
        : `[transcribe] Job ${id} FAILED (${safePath}): ${result.error ?? 'unknown error'}`
    try {
      createAgentMessage('transcribe', job.notify_agent, summary)
    } catch (err) {
      logger.error(`[transcribe] notify_agent failed for job ${id}: ${err instanceof Error ? err.message : err}`)
    }
  }
}

function collectJobResult(
  job: TranscribeJob,
  outcome: { code: number; stderrTail: string; timedOut: boolean },
): { status: 'done' | 'failed'; transcript?: string; transcriptPath?: string; error?: string } {
  // transcribe_only.py writes Path(audio).with_suffix('.whisper.json');
  // transcribe.py (diarize) writes Path(audio).with_suffix('').with_suffix(
  // '.transcript.md'/'.json') -- for multi-dot names the SECOND with_suffix
  // replaces the residual suffix (rec.2024.01.wav -> rec.2024.transcript.md),
  // so the node side must mirror pathlib exactly (replaceSuffix twice).
  const mdPath = replaceSuffix(replaceSuffix(job.src_path, ''), '.transcript.md')
  const jsonPath = job.diarize
    ? replaceSuffix(replaceSuffix(job.src_path, ''), '.transcript.json')
    : replaceSuffix(job.src_path, '.whisper.json')
  if (outcome.timedOut) {
    return { status: 'failed', error: `timed out after ${Math.round(timeoutMs() / 60000)} min (WHISPERX_TIMEOUT_MIN); tail: ${outcome.stderrTail.slice(-800)}` }
  }
  if (outcome.code !== 0) {
    return { status: 'failed', error: `exit ${outcome.code}; tail: ${outcome.stderrTail.slice(-1500)}` }
  }
  try {
    if (job.diarize && existsSync(mdPath)) {
      return {
        status: 'done',
        transcript: readFileSync(mdPath, 'utf-8').slice(0, MAX_STORED_TRANSCRIPT),
        transcriptPath: mdPath,
      }
    }
    if (existsSync(jsonPath)) {
      const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      const segments: Array<{ text?: string }> = parsed?.segments ?? []
      const text = segments.map((s) => (s.text ?? '').trim()).filter(Boolean).join('\n')
      return { status: 'done', transcript: text.slice(0, MAX_STORED_TRANSCRIPT), transcriptPath: jsonPath }
    }
    return { status: 'failed', error: `pipeline exited 0 but produced no output file (looked for ${jsonPath})` }
  } catch (err) {
    return { status: 'failed', error: `could not read pipeline output: ${err instanceof Error ? err.message : err}` }
  }
}

export async function tryHandleTranscribe(ctx: RouteContext): Promise<boolean> {
  const { req, res, path, method } = ctx

  if (path === '/api/transcribe/status' && method === 'GET') {
    const state = installState()
    json(res, {
      ...state,
      dir: whisperxDir(),
      defaultModel: defaultModel(),
      busy: workerBusy,
      queued: queue.length,
      recent: listTranscribeJobs(10).map((j) => ({ id: j.id, status: j.status, src: j.src_path, created_at: j.created_at })),
    })
    return true
  }

  if (path === '/api/transcribe' && method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, { maxBytes: 64 * 1024 })).toString())
      const srcPath = body?.path
      if (typeof srcPath !== 'string' || !srcPath.startsWith('/')) {
        json(res, { error: 'Missing "path": absolute path of an audio file on this host (e.g. a download_attachment inbox file)' }, 400)
        return true
      }
      if (!ALLOWED_EXT.has(extname(srcPath).toLowerCase())) {
        json(res, { error: `Unsupported extension "${extname(srcPath)}"; allowed: ${[...ALLOWED_EXT].join(' ')}` }, 400)
        return true
      }
      if (!existsSync(srcPath)) {
        json(res, { error: `File not found: ${srcPath}` }, 404)
        return true
      }
      if (statSync(srcPath).size > MAX_SRC_BYTES) {
        json(res, { error: 'File exceeds 1 GB' }, 413)
        return true
      }
      const state = installState()
      if (!state.installed) {
        json(res, { error: `WhisperX not installed: ${state.reason}` }, 503)
        return true
      }
      const model = typeof body?.model === 'string' ? body.model : defaultModel()
      if (!ALLOWED_MODELS.has(model)) {
        json(res, { error: `Unknown model "${model}"; allowed: ${[...ALLOWED_MODELS].join(', ')}` }, 400)
        return true
      }
      const diarize = body?.diarize === true
      if (diarize && !existsSync(join(whisperxDir(), 'transcribe.py'))) {
        json(res, { error: `diarize:true needs transcribe.py in ${whisperxDir()}` }, 503)
        return true
      }
      if (diarize && !readEnvFile(join(whisperxDir(), '.env')).HF_TOKEN) {
        json(res, { error: 'diarize:true needs HF_TOKEN in the WhisperX .env (pyannote licence)' }, 400)
        return true
      }
      const job = createTranscribeJob({
        id: randomUUID(),
        requester: typeof body?.requester === 'string' ? body.requester : undefined,
        srcPath,
        model,
        diarize,
        notifyAgent: typeof body?.notify_agent === 'string' ? body.notify_agent : undefined,
      })
      enqueueJob(job.id)
      json(res, { ok: true, job_id: job.id, status: 'queued', hint: `poll GET /api/transcribe/${job.id}; expect minutes (model load ~5 min + ~4x realtime; diarize much longer)` }, 202)
    } catch (err) {
      const status = err instanceof RequestBodyTooLargeError ? 413 : 400
      json(res, { error: err instanceof Error ? err.message : 'Invalid request' }, status)
    }
    return true
  }

  const jobMatch = path.match(/^\/api\/transcribe\/([a-z0-9-]{4,40})$/)
  if (jobMatch && method === 'GET') {
    const job = getTranscribeJob(jobMatch[1])
    if (!job) {
      json(res, { error: `No transcribe job ${jobMatch[1]}` }, 404)
      return true
    }
    json(res, { job })
    return true
  }

  return false
}
