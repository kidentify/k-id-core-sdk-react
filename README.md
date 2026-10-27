# `@k-id/core-react`

The k-ID SDK for React apps. It adds an age gate with parental consent, adult age verification, and a settings menu where players manage their permissions, as drop-in components, composable pieces, or hooks for your own UI. The iOS and Android SDKs share its surface, names, and behavior.

## Requirements

React 18 or 19, with `react-dom`.

## Install

```sh
npm install @k-id/core-react
```

## Test and live keys

Each product in Kai has a test key (`kgp_test_...`) and a live key (`kgp_live_...`). Add every origin your page runs on to the key in Kai, as its scheme, host and port, such as `https://yourgame.com` or `http://localhost:3000`. k-ID refuses calls from any other origin. A live key also runs a bot check first (see [Bot check](#bot-check)).

## Quick start

```tsx
import { KidCoreProvider, KidSessionProvider, KidAgeGate, KidAgeGatePass } from '@k-id/core-react'

function Root() {
  return (
    <KidCoreProvider
      publishableKey="kgp_test_..."
      baseUrl="https://kai-api.test.k-id.com/fapi/v1"
      declare={{ permissions: [], supportEmail: 'help@...' }}
    >
      <KidSessionProvider jurisdiction="auto">
        <KidAgeGate>
          <KidAgeGatePass>
            <App />
          </KidAgeGatePass>
        </KidAgeGate>
      </KidSessionProvider>
    </KidCoreProvider>
  )
}
```

Later, on your options screen, a standing menu lets the player manage that session's permissions:

```tsx
import { KidSettingsProvider, KidSettings } from '@k-id/core-react'

function Settings({ sessionId }: { sessionId: string }) {
  return (
    <KidSettingsProvider sessionId={sessionId}>
      <KidSettings />
    </KidSettingsProvider>
  )
}
```

## `<KidCoreProvider>` - app-level, wrap once

Holds the client and shared config.

- `publishableKey` - required string. Your k-ID publishable key; safe to ship in the browser.
  The SDK binds its calls to the browser: it creates a non-extractable device key, mints a short-lived client token for it from k-ID, and signs every call with it. There is nothing to configure. The key is kept in the browser's IndexedDB, so a reload reuses it; where IndexedDB is unavailable (private browsing, blocked storage) it lasts as long as the page.
- `baseUrl` - the k-ID API URL Kai shows for your key: `https://kai-api.k-id.com/fapi/v1` for a live key, `https://kai-api.test.k-id.com/fapi/v1` for a test key. Set it: the default only works on pages k-ID serves itself. Calls must go straight to k-ID, not through a proxy on your own domain, because each call carries a proof signed for the exact k-ID URL it is sent to.
- `declare` - optional. A one-time integration manifest, applied while you use a test key (see [Declare](#declare-test-keys)).
- `appearance` - optional `Appearance` theme tokens. Omit for the defaults.
- `localization` - optional partial strings object, merged over the English defaults; override any widget copy or pass a locale (see [Localization](#localization)). Locale detection stays in your app.

## `<KidSessionProvider>` - wrap one age gate

One age-gate + consent flow. Every input is a declarative prop and all are optional; remounting the provider is the reset.

- `jurisdiction` - an ISO 3166-1 alpha-2 country or ISO 3166-2 subdivision code (the supported ones are typed as `JurisdictionCode`). Three ways to run it:
  - a concrete code: used directly, no picker;
  - `"auto"`: resolved from the client IP server-side; if it can't be resolved the widget falls back to the jurisdiction picker;
  - omitted: the widget shows the picker up front.
- `age` - an `AgeSignal`: `{ dateOfBirth: 'YYYY-MM-DD' }` or `{ age: number }`. Provide it to skip age collection.
- `email` - the parent's email for consent, or the player's own email for adult age verification. Provide it to skip the ask-an-adult / verify-age step.
- `challengeId` / `sessionId` - resume an in-flight flow (persist them from the callbacks below and pass them back on the next mount).
- `onChallenge(challengeId)` - fires once a challenge's email is sent; persist it for resume.
- `onSession(sessionId)` - fires once the session is established; persist it for resume.
- `onClaim(claimToken)` - fires once the age check has a result, passed or pending, with a one-time token for your backend.

## `<KidSettingsProvider>` - wrap the settings menu

The post-session scope: a standing menu where the player manages an established session's permissions, independent of the age gate. Mount it on your options screen.

- `sessionId` - required string. The established session to manage (persist it from `onSession`).
- `challengeId` - optional string. Resume a pending settings challenge (persist it from `onChallenge` and pass it back on the next mount).
- `onChallenge(challengeId)` - fires once a settings challenge's email is sent; persist it for resume.

## Integration tiers

Three levels of control over the UI, across both surfaces - the age gate (`<KidSessionProvider>`) and the permission-settings menu (`<KidSettingsProvider>`). Mix them freely.

Every widget fills its container's width - size your own wrapper to constrain it.

### Tier 1 - drop-in widgets

`<KidAgeGate>` is the all-in-one age gate: it renders the entire capture (jurisdiction, age, ask-an-adult, plus adult age verification on an adults-only product) itself and swaps to the child slot matching the flow state:

```tsx
<KidAgeGate>
  <KidAgeGatePending>...</KidAgeGatePending> {/* consent requested, waiting on the parent */}
  <KidAgeGateProhibited>...</KidAgeGateProhibited> {/* under the minimum age for the jurisdiction */}
  <KidAgeGateFail>...</KidAgeGateFail> {/* consent denied or the challenge expired */}
  <KidAgeGateError>...</KidAgeGateError> {/* SDK/network error or rate limited; recover by remounting the provider */}
  <KidAgeGatePass>
    <App /> {/* the player passed */}
  </KidAgeGatePass>
</KidAgeGate>
```

The widget draws the capture UI itself, but for the pending/pass/fail/prohibited/error states it renders whatever you put in the matching slot (and nothing if you leave one out) - so provide at least `<KidAgeGatePass>` to show your app on success, and add the others to handle those states. There is no reset: recover from `error` by remounting `<KidSessionProvider>`. Prefer to build your own screens? Skip the slots and drive it from `useKidAgeGate().status`.

`<KidSettings>` is the all-in-one permission menu, inside `<KidSettingsProvider>`: it lists the session's permissions and runs the whole flow - player-managed permissions get an on/off control, guardian-managed ones are staged with a tap and asked for together in one request, prohibited ones are hidden.

```tsx
<KidSettingsProvider sessionId={sessionId} onChallenge={persist}>
  <KidSettings />
</KidSettingsProvider>
```

`<KidPermission name fallback?>` gates a feature once the player is through the gate: it renders its children when `name` is enabled for that player, else `fallback` (default: nothing). It reflects what the player may SEE - always enforce the real capability server-side. (Headless equivalent: `useKidPermission()`, below.)

```tsx
<KidPermission name="<permission-name>" fallback={<FeatureDisabled />}>
  <FeatureEnabled />
</KidPermission>
```

### Tier 2 - composable pieces (our UI, you place it)

Drop these inside `<KidSessionProvider>`. Each is self-driving and self-suppressing: it renders only during its own step, and does nothing once you pass the matching provider prop. The callbacks observe only; they never take over the flow.

- `<KidSelectJurisdiction onSelect?={(code: string) => void} />` - jurisdiction picker; options come from the bundled `JURISDICTIONS`. `onSelect` fires with the chosen ISO code.
- `<KidCollectAge methods?={('date-of-birth' | 'age-slider')[]} onSubmit?={(signal: AgeSignal) => void} />` - `methods` is your preferred order, intersected with what the jurisdiction approves (an unapproved input never renders); omit it to default to age-slider then date-of-birth. `onSubmit` fires with the collected `AgeSignal`.
- `<KidAskAnAdult onSent?={(info: { email: string }) => void} />` - parent-email capture with a built-in send (verified parental consent). `onSent` fires after the consent email goes out.
- `<KidVerifyAge onSent?={(info: { email: string }) => void} />` - for an adults-only product: emails the player a link to verify their age on k-ID. `onSent` fires after the email goes out.

On an established session, `<KidSessionVerifyAge>` verifies the player is an adult. See [Verifying age on a session](#verifying-age-on-a-session).

For the settings menu, `<KidPermissionSettings />` (inside `<KidSettingsProvider>`) is the same permission list as `<KidSettings>` without its surrounding block, to place inside your own screen.

### Tier 3 - headless (bring your own UI)

Hold each value in your own state and feed it as the matching `<KidSessionProvider>` prop; our components fill anything you omit. Read and drive the flow with hooks:

- `useKidAgeGate()` -> `{ status, challengeId, challengeKind, sessionId, error, requirements, submit }`. `requirements` carries the jurisdiction's `digitalConsentAge`, `civilAge`, `minimumAge` and `accessAge`. `status` is `'running' | 'pending' | 'pass' | 'prohibited' | 'fail' | 'error'`. `challengeKind` is `'parentalConsent'` when the email goes to a parent and `'ageAssurance'` when it goes to the player, or `null` before there is a challenge. `submit()` sends the challenge email (only after the check has produced a challenge) and is re-callable to re-send.
- `useKidSession()` -> `{ session, permissions, sessionId, isLoaded, ageVerification, verifyAge, refresh }`. `permissions` is a name -> enabled map; `ageVerification` is `{ verifiedAge, verifiedAt }` once the player has proven an age (`verifiedAge` counts birthdays since), else `null`; `refresh()` re-reads the session (cheap - an unchanged read 304s). The player is a verified adult when `ageVerification.verifiedAge >= requirements.civilAge`.
- `useKidSession().verifyAge` -> `{ status, step, challengeId, rawChallengeStatus, expiresAt, error, start, submit }` - the headless form of `<KidSessionVerifyAge>`, sharing its flow. `start()` checks the session (a no-op until the gate passes; after a fail or error it starts over with a fresh check); `status` is `'pass'` once the session's `ageVerification.verifiedAge` meets the jurisdiction's civil age, `'fail'` when it does not, and `'error'` when k-ID cannot be reached. While `step` is `'email'`, collect the player's email and call `submit(email)`; while `status` is `'pending'`, call it again to re-send.
- `useKidPermission()` -> `{ can(name), get(name) }` - the headless form of `<KidPermission>`. `get` returns the full `Permission` including `managedBy` (`PLAYER` | `GUARDIAN` | `PROHIBITED`), so you can explain a guardian-managed feature rather than just hide it.
- `useKidChallenge()` -> `{ challengeId, status, expiresAt }` - the raw challenge status, for a custom waiting screen. `expiresAt` is only set when the challenge has a deadline, like Indonesia's 24-hour consent window, and is `null` otherwise. Once it passes, the flow moves to `fail`; remount the provider to ask again.
- `useKidPermissionSettings()` -> `{ permissions, isLoaded, error, change, hasApproverEmail, upgrade, challenge, refresh }` (in `<KidSettingsProvider>`). Branch each `permissions[]` entry on `managedBy`: `PLAYER` -> `change(name, enabled)` (opt-in/opt-out), except a `PLAYER` entry with a `verifiedAgeThreshold` that is off: ask for it on its own with `upgrade([name])`, which turns it on when the player's verified age already covers it and otherwise returns `invalid_request` because an age check is needed; call it again with the player's own email (never the grownup's), `upgrade([name], playerEmail)`, and k-ID emails the player a link to verify their age; `GUARDIAN` -> collect a set and `upgrade(names)` (one request, emailed to the player's grownup); `PROHIBITED` -> hide it. One `upgrade()` can't mix permissions that have a `verifiedAgeThreshold` with ones that don't: k-ID rejects it with `invalid_request`. When `hasApproverEmail` is false, ask for the grownup's email and pass it as `upgrade(names, approverEmail)`; `<KidSettings>` does this for you. `challenge` (`{ status, permissions, challengeId, challengeKind }`) is the in-flight ask, for a custom waiting view; `challengeKind` is `'parentalConsent'` while it waits on the grownup and `'ageAssurance'` while it waits on the player's own age check, and `null` until known. `change` / `upgrade` return `{ ok, error? }` (see [Errors](#errors)).

Two steps `<KidCollectAge>` / `<KidAskAnAdult>` handle for you in Tiers 1-2, you drive yourself here:

- Age input: `requirements.approvedAgeCollectionMethods` lists the inputs the jurisdiction allows (`null` until a jurisdiction is set). Render one and pass it as the `age` prop (`date-of-birth` -> `{ dateOfBirth }`, `age-slider` -> `{ age }`).
- Consent and adult verification: the `email` prop alone does not send. Once a challenge exists, set `email`, let it propagate, then call `submit()`.

## Styling

No stylesheet to import - the widgets inject their own CSS. `appearance.variables` (`colorPrimary`, `colorText`, `colorSurface`, `colorBorder`, `radius`, `fontFamily`, ...) retheme every widget. `appearance.elements` overrides one element, keyed by name - a `className` to add or a style object to merge. Or target the `kid-<element>` classes in your own CSS; they are single-class selectors, so a rule of yours overrides without `!important`.

Element names, shared by the `kid-<name>` classes and the `appearance.elements` keys: `card`, `title`, `label`, `input`, `button`, `muted`, `danger`, `row`, `pill` (`pillAsk` / `pillAdded`), `askForm`, `controlColumn`, `verifyAge`, and one per widget - `selectJurisdiction`, `collectAge`, `askAnAdult`, `settings` (typed as `ElementName`, so your editor completes them).

```tsx
<KidCoreProvider
  publishableKey="kgp_test_..."
  appearance={{
    variables: { colorPrimary: '#7c5cff' },
    elements: { button: 'my-button-class', card: { maxWidth: 420 } },
  }}
>
  <App />
</KidCoreProvider>
```

## Localization

The widgets render in English. Pass a locale from `@k-id/core-react/localizations` to translate them:

```tsx
import { KidCoreProvider, KidSessionProvider, KidAgeGate, KidAgeGatePass } from '@k-id/core-react'
import { jaJP } from '@k-id/core-react/localizations'

function Root() {
  return (
    <KidCoreProvider publishableKey="kgp_test_..." localization={jaJP}>
      <KidSessionProvider jurisdiction="auto">
        <KidAgeGate>
          <KidAgeGatePass>
            <App />
          </KidAgeGatePass>
        </KidAgeGate>
      </KidSessionProvider>
    </KidCoreProvider>
  )
}
```

`getKidLocalization(navigator.language)` picks the locale for the player's language, falling back to English. `KID_LOCALES` lists the supported locales.

To change individual strings, spread your own over a locale, per section. Keys are the `KidStrings` type; keep any `{token}` placeholders.

```tsx
localization={{ ...jaJP, age: { ...jaJP.age, submit: 'OK' } }}
```

The jurisdiction picker follows the locale; `useKidJurisdictions()` returns the same translated list for a custom picker. Permission names follow it too: `<KidSettings>` shows them, and a custom settings UI reads `useKidStrings().permissions[name].name`, keyed by the `name` in [PERMISSIONS.md](./PERMISSIONS.md).

## Errors

Every client call surfaces failures through a `KidError`. It carries the HTTP `status`, a `code` from a closed set - `'invalid_request' | 'unauthorized' | 'not_found' | 'rate_limited' | 'unavailable'` - a display-safe `message`, and k-ID's own `rawCode`. Systemic failures throw it, and `useKidSession().refresh()` throws nothing else; user-recoverable ones (`submit`, `change`, `upgrade`) return `{ ok: false, error }` instead. A `rate_limited` error carries `retryAfter`, the whole seconds k-ID asked you to wait, when k-ID said, or, when k-ID rate limited the client token a call needed, the seconds left before the SDK asks for one again; the SDK never retries it for you. The `error` of `useKidAgeGate()`, `useKidSession().verifyAge` and `useKidPermissionSettings()` is the `KidError` behind `status: 'error'` (or a failed settings load), or `null`: a k-ID API error as is, and any other failure, such as a dropped connection, as `unavailable`. Full detail goes to the dev console. `submit()` returns `invalid_request` when called before a challenge exists or without an email.

The error slots, `<KidAgeGateError>` and `<KidSessionVerifyAgeError>`, receive no props: read the error inside them from `useKidAgeGate().error` or `useKidSession().verifyAge.error`. When the settings list fails to load, `useKidPermissionSettings().error` is set; call its `refresh()` to load it again.

## Bot check

On a live key the SDK runs reCAPTCHA Enterprise invisibly before its first call. If your page sets a Content Security
Policy, allow:

- `script-src`: `https://www.google.com/recaptcha/` `https://www.gstatic.com/recaptcha/`
- `frame-src`: `https://www.google.com/recaptcha/` `https://recaptcha.google.com/recaptcha/`
- `connect-src`: `https://www.google.com/recaptcha/`

With CSP3, a nonce on the script that loads the SDK plus `'strict-dynamic'` can replace the `script-src` entries, since
the SDK adds the reCAPTCHA script itself.

## Declare (test keys)

The `declare` prop on `<KidCoreProvider>` is a one-time integration manifest: the capabilities the app uses (which become its permission set - you never author permissions by hand), plus its legal links, icon and support email. What parents read about the app's data is worked out in Kai, from these capabilities and a few questions Kai asks you there. It applies only while you use a test key; a live key skips it.

```tsx
<KidCoreProvider
  publishableKey="kgp_test_..."
  declare={{
    permissions: [], // one { name } per capability the app uses
    privacyPolicyUrl: 'https://...',
    termsOfServiceUrl: 'https://...',
    iconUrl: '/icon.png', // a public https link, or any image the app can load
    supportEmail: 'help@...',
  }}
>
  <App />
</KidCoreProvider>
```

`permissions` and `supportEmail` are required. Every other field is optional: leave it out to keep what k-ID already has, set it to `null` (or empty) to clear it, or set a value to replace it.

- `permissions` - required array of `{ name }`. `name` must be a k-ID capability, typed as `PermissionName`; an unknown name is rejected (the call fails naming the offending permission). The full catalog of `name`s, labels, and descriptions is in [`PERMISSIONS.md`](./PERMISSIONS.md).
- `privacyPolicyUrl` / `termsOfServiceUrl` - optional http(s) URLs. `null` resets one to k-ID's default link.
- `iconUrl` - optional app icon, a PNG or JPEG up to 5MB. A public https link is sent for k-ID to fetch; anything else the app can load (a bundled asset, a local path, a dev server) is read by the SDK and sent inline. `null` removes it.
- `supportEmail` - required email address that k-ID's emails give players and parents to contact for help. A missing, empty or invalid address is rejected, and the call fails naming `supportEmail`. Getting a live key also needs your own privacy and terms links and an icon.

## Adult age verification (`<KidVerifyAge>`)

`<KidVerifyAge>` emails the player a link to verify their age on k-ID. The result comes through the SDK's status check, the same as consent.

## Verifying age on a session

Once the player is through the gate, `<KidSessionVerifyAge onSent?>` verifies they are an adult (the civil age of their jurisdiction) on that session, on any product, for example to open an adults-only space. Like `<KidAgeGate>`, it draws the email form itself and renders whatever you put in the slot matching each outcome, and nothing for a slot you leave out:

| State                                                                   | Renders                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| before the gate passes, and while it checks the session                 | nothing                                                                |
| the session is not yet a verified adult                                 | the email form (`onSent` fires once the link is sent)                  |
| link sent, waiting for the player to verify                             | `<KidSessionVerifyAgePending>`                                         |
| the session is a verified adult (straight away when it already was one) | `<KidSessionVerifyAgePass>`, and the session carries `ageVerification` |
| the player could not prove they are an adult                            | `<KidSessionVerifyAgeFail>`                                            |
| k-ID could not be reached or rate limited                               | `<KidSessionVerifyAgeError>`                                           |

Remounting `<KidSessionVerifyAge>` after a fail or error tries again with a new email.

```tsx
<KidSessionVerifyAge>
  <KidSessionVerifyAgePass>
    <AdultsSpace />
  </KidSessionVerifyAgePass>
  <KidSessionVerifyAgePending>Check your email to verify your age.</KidSessionVerifyAgePending>
  <KidSessionVerifyAgeFail>We could not verify your age.</KidSessionVerifyAgeFail>
</KidSessionVerifyAge>
```
