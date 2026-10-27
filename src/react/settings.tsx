import { useEffect, useRef, useState } from 'react'

import { format, type KidErrorCode, type Permission, type PermissionName } from '@kid/core-sdk-js'
import { useKidPermissionSettings, useKidStrings } from '@kid/core-sdk-js/react'
import { ChallengeEmailForm } from './components'
import { useEl } from './styles'

function usePermissionName(name: string): string {
  return useKidStrings().permissions[name]?.name ?? name
}

type VerifyAgeStep = 'verify' | 'email' | 'sending'

// Where a Verify age row goes once its own request returns. A failure puts it back to its button with the error, so the
// player starts over; without an email, invalid_request is the age check asking for the player's email instead.
function verifyAgeStep(
  res: { ok: boolean; error?: { code: KidErrorCode } },
  sentEmail: boolean,
): { step: VerifyAgeStep; failed?: KidErrorCode } {
  if (res.ok) return { step: 'verify' }
  const code = res.error?.code ?? 'unavailable'
  if (!sentEmail && code === 'invalid_request') return { step: 'email' }
  return { step: 'verify', failed: code }
}

function PlayerRow({ permission }: { permission: Permission }) {
  const t = useKidStrings().settings
  const el = useEl()
  const { change } = useKidPermissionSettings()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) })

  // The checkbox stays bound to permission.enabled, so a failed change leaves the prior state in place.
  async function toggle(enabled: boolean) {
    setBusy(true)
    setFailed(false)
    try {
      const res = await change(permission.name, enabled)
      if (!res.ok) setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div {...el('row')}>
      <span {...el('label')}>{name}</span>
      <span {...el('controlColumn')}>
        <label {...el('muted')}>
          <input
            type="checkbox"
            aria-label={name}
            checked={permission.enabled}
            disabled={busy}
            onChange={(e) => void toggle(e.target.checked)}
          />{' '}
          {permission.enabled ? t.on : t.off}
        </label>
        {failed ? (
          <span role="alert" {...el('danger')}>
            {t.error}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function VerifyAgeRow({ permission, disabled }: { permission: Permission; disabled: boolean }) {
  const strings = useKidStrings()
  const t = strings.settings
  const el = useEl()
  const { upgrade, challenge } = useKidPermissionSettings()
  const [step, setStep] = useState<VerifyAgeStep>('verify')
  const [failedCode, setFailedCode] = useState<KidErrorCode | undefined>()
  const email = useRef('')
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) })
  const mine = challenge.challengeKind === 'ageAssurance' && challenge.permissions.includes(permission.name)

  async function request(playerEmail?: string) {
    setStep('sending')
    setFailedCode(undefined)
    const res = await upgrade([permission.name], playerEmail)
    const next = verifyAgeStep(res, playerEmail !== undefined)
    setStep(next.step)
    setFailedCode(next.failed)
    return res
  }

  if (step === 'sending')
    return (
      <div {...el('row')}>
        <span {...el('label')}>{name}</span>
        <span {...el('muted')}>{strings.verifyAge.submitting}</span>
      </div>
    )
  if (mine && challenge.status === 'pending')
    return (
      <div {...el('row')}>
        <span {...el('label')}>{name}</span>
        <span {...el('muted')}>{t.verifying}</span>
      </div>
    )
  if (step === 'email')
    return (
      <ChallengeEmailForm
        strings={strings.verifyAge}
        id={`kid-settings-verify-${permission.name}`}
        name="verifyAge"
        setEmail={(value) => (email.current = value)}
        submit={() => request(email.current)}
      />
    )
  return (
    <div {...el('row')}>
      <span {...el('label')}>{name}</span>
      <span {...el('controlColumn')}>
        <button
          {...el('pill', 'pillAsk')}
          type="button"
          aria-label={`${strings.verifyAge.title} ${name}`}
          disabled={disabled}
          onClick={() => void request()}
        >
          {strings.verifyAge.title}
        </button>
        {failedCode ? (
          <span role="alert" {...el('danger')}>
            {failedCode === 'invalid_request' ? strings.verifyAge.invalidEmail : strings.verifyAge.error}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function GuardianRow({
  permission,
  added,
  disabled,
  onToggle,
}: {
  permission: Permission
  added: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const t = useKidStrings().settings
  const el = useEl()
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) })
  return (
    <div {...el('row')}>
      <span {...el('label')}>{name}</span>
      {permission.enabled ? (
        <span {...el('muted')}>{t.granted}</span>
      ) : (
        <button
          {...el('pill', added ? 'pillAdded' : 'pillAsk')}
          type="button"
          aria-label={`${added ? t.added : t.ask} ${name}`}
          disabled={disabled}
          onClick={onToggle}
        >
          {added ? t.added : t.ask}
        </button>
      )}
    </div>
  )
}

/** Tier 2: the composable permission list. Player-managed permissions get an on/off control; guardian-managed
 * are staged with a tap and asked for in one request; prohibited are hidden. Place it inside <KidSettingsProvider>. */
export function KidPermissionSettings() {
  const strings = useKidStrings()
  const t = strings.settings
  const el = useEl()
  const { permissions, isLoaded, error, hasApproverEmail, upgrade, challenge } = useKidPermissionSettings()
  const [staged, setStaged] = useState<PermissionName[]>([])
  const [approverEmail, setApproverEmail] = useState('')
  const [failedCode, setFailedCode] = useState<KidErrorCode | undefined>()
  // The ask this form sent itself, so a Verify age row's request never shows here.
  const [asking, setAsking] = useState(false)
  const [askFailed, setAskFailed] = useState(false)

  // Seed the editable set from a failed batch so a retry edits and submits the same list, never a subset.
  useEffect(() => {
    if (challenge.status === 'error' && challenge.challengeKind === 'parentalConsent')
      setStaged((s) => (s.length > 0 ? s : challenge.permissions))
  }, [challenge.status, challenge.challengeKind, challenge.permissions])
  useEffect(() => {
    if (challenge.status !== 'error') setAskFailed(false)
  }, [challenge.status])

  if (error && !isLoaded)
    return (
      <p role="alert" {...el('danger')}>
        {t.error}
      </p>
    )
  if (!isLoaded) return null

  const inFlight = challenge.status === 'sending' || challenge.status === 'pending'
  const isAdded = (name: PermissionName) => (inFlight ? challenge.permissions.includes(name) : staged.includes(name))
  const toggle = (name: PermissionName) =>
    setStaged((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]))

  const needsEmail = !hasApproverEmail && !inFlight

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    if (staged.length === 0) return
    const names = staged
    setStaged([])
    setAsking(true)
    const res = await upgrade(names, hasApproverEmail ? undefined : approverEmail)
    setAsking(false)
    setFailedCode(res.ok ? undefined : res.error?.code)
    if (!res.ok) {
      setStaged(names)
      setAskFailed(true)
    }
  }

  const waiting = challenge.status === 'pending' && challenge.challengeKind !== 'ageAssurance'
  const grownupFailed = askFailed || (challenge.status === 'error' && challenge.challengeKind === 'parentalConsent')
  const ctaLabel = asking ? t.asking : waiting ? t.waiting : t.askGrownup

  return (
    <>
      {permissions
        .filter((p) => p.managedBy !== 'PROHIBITED')
        .map((p) =>
          p.managedBy === 'GUARDIAN' ? (
            <GuardianRow
              key={p.name}
              permission={p}
              added={isAdded(p.name)}
              disabled={inFlight}
              onToggle={() => toggle(p.name)}
            />
          ) : p.verifiedAgeThreshold !== undefined && !p.enabled ? (
            <VerifyAgeRow key={p.name} permission={p} disabled={inFlight || staged.length > 0} />
          ) : (
            <PlayerRow key={p.name} permission={p} />
          ),
        )}
      {staged.length > 0 || asking || waiting ? (
        <form {...el('askForm')} onSubmit={(e) => void ask(e)}>
          {needsEmail ? (
            <>
              <label {...el('label')} htmlFor="kid-settings-approver-email">
                {strings.askAnAdult.title}
              </label>
              <p {...el('muted')}>{strings.askAnAdult.description}</p>
              <input
                {...el('input')}
                id="kid-settings-approver-email"
                type="email"
                autoComplete="email"
                placeholder={strings.askAnAdult.emailPlaceholder}
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                required
              />
            </>
          ) : null}
          <button {...el('button')} type="submit" disabled={inFlight || (needsEmail && !approverEmail)}>
            {ctaLabel}
          </button>
        </form>
      ) : null}
      {grownupFailed ? (
        <p role="alert" {...el('danger')}>
          {hasApproverEmail
            ? t.error
            : failedCode === 'invalid_request'
              ? strings.askAnAdult.invalidEmail
              : strings.askAnAdult.error}
        </p>
      ) : null}
    </>
  )
}

/** Tier 1: the prebuilt settings block. A titled surface wrapping <KidPermissionSettings>. */
export function KidSettings() {
  const t = useKidStrings().settings
  const el = useEl()
  return (
    <section {...el('card', 'settings')}>
      <h2 {...el('title')}>{t.title}</h2>
      <KidPermissionSettings />
    </section>
  )
}
