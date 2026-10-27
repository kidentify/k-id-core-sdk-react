import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react'

import { format, type AgeSignal, type KidError, type KidStrings, type PermissionName } from '@kid/core-sdk-js'
import {
  collectSlots,
  useAgeGateController,
  useAgeGateState,
  useKidJurisdictions,
  useKidPermission,
  useKidStrings,
  useSessionVerifyAgeController,
} from '@kid/core-sdk-js/react'
import { useEl } from './styles'

export type WebAgeMethod = 'date-of-birth' | 'age-slider'

const DEFAULT_AGE_METHOD_PREFERENCE: WebAgeMethod[] = ['age-slider', 'date-of-birth']

function isWebAgeMethod(method: string): method is WebAgeMethod {
  return method === 'date-of-birth' || method === 'age-slider'
}

export function KidSelectJurisdiction({ onSelect }: { onSelect?: (code: string) => void } = {}) {
  const controller = useAgeGateController()
  const state = useAgeGateState()
  const t = useKidStrings().jurisdiction
  const jurisdictions = useKidJurisdictions()
  const el = useEl()
  const [code, setCode] = useState('')

  if (state.step !== 'jurisdiction') return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code) return
    controller.setJurisdiction(code)
    onSelect?.(code)
  }

  return (
    <form {...el('card', 'selectJurisdiction')} onSubmit={submit}>
      <label {...el('label')} htmlFor="kid-jurisdiction">
        {t.label}
      </label>
      <select {...el('input')} id="kid-jurisdiction" value={code} onChange={(e) => setCode(e.target.value)} required>
        <option value="" disabled>
          {t.placeholder}
        </option>
        {jurisdictions.map((j) => (
          <option key={j.code} value={j.code}>
            {j.name}
          </option>
        ))}
      </select>
      <button {...el('button')} type="submit" disabled={!code}>
        {t.submit}
      </button>
    </form>
  )
}

const MAX_SLIDER_AGE = 35

export function KidCollectAge({
  methods,
  onSubmit,
}: { methods?: WebAgeMethod[]; onSubmit?: (signal: AgeSignal) => void } = {}) {
  const controller = useAgeGateController()
  const state = useAgeGateState()
  const t = useKidStrings().age
  const el = useEl()
  const [dob, setDob] = useState('')
  const [age, setAge] = useState<number>()

  if (state.step !== 'age') return null

  const approved = state.requirements?.approvedAgeCollectionMethods?.filter(isWebAgeMethod)
  if (!approved) return null
  const preferred = (methods ?? DEFAULT_AGE_METHOD_PREFERENCE).filter((m) => approved.includes(m))
  const method = preferred[0] ?? approved[0]
  if (!method) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    let signal: AgeSignal
    if (method === 'date-of-birth') signal = { dateOfBirth: dob }
    else if (age !== undefined) signal = { age }
    else return
    controller.setAge(signal)
    onSubmit?.(signal)
  }

  return (
    <form {...el('card', 'collectAge')} onSubmit={submit}>
      {method === 'date-of-birth' ? (
        <>
          <label {...el('label')} htmlFor="kid-dob">
            {t.dateOfBirthLabel}
          </label>
          <input
            {...el('input')}
            id="kid-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
          <button {...el('button')} type="submit" disabled={!dob}>
            {t.submit}
          </button>
        </>
      ) : (
        <>
          <label {...el('label')} htmlFor="kid-age">
            {format(t.ageLabel, { age: age === undefined ? '-' : age === MAX_SLIDER_AGE ? `${age}+` : age })}
          </label>
          <input
            {...el('input')}
            id="kid-age"
            type="range"
            min={1}
            max={MAX_SLIDER_AGE}
            value={age ?? 1}
            onChange={(e) => setAge(Number(e.target.value))}
            onPointerUp={(e) => setAge(Number(e.currentTarget.value))}
          />
          <button {...el('button')} type="submit" disabled={age === undefined}>
            {t.submit}
          </button>
        </>
      )}
    </form>
  )
}

type EmailStrings = KidStrings['askAnAdult'] | KidStrings['verifyAge']
type Submit = () => Promise<{ ok: boolean; error?: KidError }>

export function ChallengeEmailForm({
  strings: t,
  id,
  name,
  setEmail: commitEmail,
  submit: send,
  onSent,
}: {
  strings: EmailStrings
  id: string
  name: 'askAnAdult' | 'verifyAge'
  setEmail: (email: string) => void
  submit: Submit
  onSent?: (info: { email: string }) => void
}) {
  const el = useEl()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    commitEmail(email)
    try {
      const res = await send()
      if (res.ok) onSent?.({ email })
      else setError(res.error?.code === 'invalid_request' ? t.invalidEmail : t.error)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form {...el('card', name)} onSubmit={submit}>
      <label {...el('label')} htmlFor={id}>
        {t.title}
      </label>
      <p {...el('muted')}>{t.description}</p>
      <input
        {...el('input')}
        id={id}
        type="email"
        autoComplete="email"
        placeholder={t.emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button {...el('button')} type="submit" disabled={busy || !email}>
        {busy ? t.submitting : t.submit}
      </button>
      {error ? (
        <p role="alert" {...el('danger')}>
          {error}
        </p>
      ) : null}
    </form>
  )
}

function GateEmailForm({
  step,
  strings,
  id,
  name,
  onSent,
}: {
  step: 'parentalConsent' | 'ageAssurance'
  strings: EmailStrings
  id: string
  name: 'askAnAdult' | 'verifyAge'
  onSent?: (info: { email: string }) => void
}) {
  const controller = useAgeGateController()
  const state = useAgeGateState()
  if (state.step !== step || state.emailProvided) return null
  return (
    <ChallengeEmailForm
      strings={strings}
      id={id}
      name={name}
      setEmail={controller.setEmail}
      submit={controller.submit}
      onSent={onSent}
    />
  )
}

export function KidAskAnAdult({ onSent }: { onSent?: (info: { email: string }) => void } = {}) {
  const t = useKidStrings().askAnAdult
  return <GateEmailForm step="parentalConsent" strings={t} id="kid-adult-email" name="askAnAdult" onSent={onSent} />
}

export function KidVerifyAge({ onSent }: { onSent?: (info: { email: string }) => void } = {}) {
  const t = useKidStrings().verifyAge
  return <GateEmailForm step="ageAssurance" strings={t} id="kid-verify-email" name="verifyAge" onSent={onSent} />
}

export function KidSessionVerifyAgePending({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidSessionVerifyAgeFail({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidSessionVerifyAgePass({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidSessionVerifyAgeError({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/** Verifies the player is an adult (the civil age of their jurisdiction) on the established session: the email form
 * while it needs the player's email, then the slot matching the outcome. Renders nothing until the age gate passes.
 * Remounting it after a fail or error tries again. */
export function KidSessionVerifyAge({
  onSent,
  children,
}: {
  onSent?: (info: { email: string }) => void
  children?: ReactNode
}) {
  const t = useKidStrings().verifyAge
  const controller = useSessionVerifyAgeController()
  const getState = () => controller?.getState() ?? null
  const state = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), getState, getState)
  const slots = collectSlots(children, {
    pending: KidSessionVerifyAgePending,
    fail: KidSessionVerifyAgeFail,
    pass: KidSessionVerifyAgePass,
    error: KidSessionVerifyAgeError,
  })

  useEffect(() => {
    controller?.start()
  }, [controller])

  if (!controller || !state) return null
  if (state.status !== 'running') return <>{slots[state.status] ?? null}</>
  if (state.step !== 'email') return null
  return (
    <ChallengeEmailForm
      strings={t}
      id="kid-session-verify-email"
      name="verifyAge"
      setEmail={controller.setEmail}
      submit={controller.submit}
      onSent={onSent}
    />
  )
}

export function KidPermission({
  name,
  fallback = null,
  children,
}: {
  name: PermissionName
  fallback?: ReactNode
  children: ReactNode
}) {
  const { can } = useKidPermission()
  return <>{can(name) ? children : fallback}</>
}
