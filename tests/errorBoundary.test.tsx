import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, ErrorFallback } from '../src/components/ErrorBoundary'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

describe('vangnet rond de schermen', () => {
  it('laat het scherm gewoon door als er niets misgaat', () => {
    const html = render(
      createElement(ErrorBoundary, {
        scherm: 'Instellingen',
        children: createElement('p', null, 'alles ok'),
      }),
    )
    expect(html).toContain('alles ok')
    expect(html).not.toContain('liep vast')
  })

  it('toont een leesbare melding met de knop terug naar Vandaag', () => {
    const html = render(
      createElement(ErrorFallback, {
        error: new Error("Cannot read properties of undefined (reading 'knee_deep')"),
        scherm: 'Instellingen',
        onReset: () => {},
      }),
    )
    expect(html).toContain('Het scherm Instellingen liep vast')
    expect(html).toContain('Terug naar Vandaag')
    expect(html).toContain('knee_deep') // de fout zelf staat erbij, voor een melding
    expect(html).toContain('Er is niets kwijt')
  })

  it('valt terug op een algemene tekst zonder schermnaam en zonder foutmelding', () => {
    const html = render(
      createElement(ErrorFallback, { error: new Error(''), onReset: () => {} }),
    )
    expect(html).toContain('Dit scherm liep vast')
    expect(html).toContain('Onbekende fout')
    expect(html).toContain('Terug naar Vandaag')
  })

  it('zet de fout in de state en logt hem naar de console', () => {
    const fout = new Error('stuk')
    expect(ErrorBoundary.getDerivedStateFromError(fout)).toEqual({ error: fout })

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const boundary = new ErrorBoundary({ children: null, scherm: 'Instellingen' })
      boundary.componentDidCatch(fout, { componentStack: '\n    at SettingsScreen' })
      expect(spy).toHaveBeenCalledOnce()
      expect(String(spy.mock.calls[0][0])).toContain('Instellingen')
      expect(spy.mock.calls[0][1]).toBe(fout)
    } finally {
      spy.mockRestore()
    }
  })

  it('haalt de melding weg en gaat terug naar Vandaag bij een druk op de knop', () => {
    let terug = 0
    const boundary = new ErrorBoundary({ children: null, onReset: () => terug++ })
    const gezet: unknown[] = []
    boundary.setState = ((s: unknown) => gezet.push(s)) as typeof boundary.setState
    boundary.state = { error: new Error('stuk') }

    const fallback = boundary.render() as { props: { onReset: () => void } }
    fallback.props.onReset()

    expect(gezet).toEqual([{ error: null }])
    expect(terug).toBe(1)
  })
})
