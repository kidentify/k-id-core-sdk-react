import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { KidCoreProvider } from '../src/react/provider'
import { SDK_VERSION } from '../src/version'

describe('KidCoreProvider', () => {
  it('renders its children', () => {
    render(
      <KidCoreProvider publishableKey="pk_test_example" baseUrl="https://api.example.test">
        <div>child</div>
      </KidCoreProvider>,
    )
    expect(screen.getByText('child')).toBeTruthy()
  })
})

describe('SDK_VERSION', () => {
  it('equals the package version', () => {
    expect(SDK_VERSION).toBe('1.0.0')
  })
})
