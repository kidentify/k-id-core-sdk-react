import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KidCoreProvider, SDK_VERSION } from '../src'
import pkg from '../package.json'

describe('smoke', () => {
  it('provider renders its children', () => {
    render(
      <KidCoreProvider publishableKey="pk_test_smoke">
        <span>hello child</span>
      </KidCoreProvider>,
    )
    expect(screen.getByText('hello child')).toBeTruthy()
  })

  it('SDK_VERSION matches package.json version', () => {
    expect(SDK_VERSION).toBe(pkg.version)
    expect(SDK_VERSION).toBe('1.0.0')
  })
})
