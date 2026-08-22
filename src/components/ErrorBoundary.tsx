import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Vangnet rond een scherm.
 *
 * Zonder dit vangnet haalt één fout tijdens de render de hele React-boom onderuit en
 * blijft er een zwart scherm over: geen tekst, geen tabbalk, geen weg terug. Dat is
 * precies het beeld waar dit voor is. In plaats daarvan blijft het scherm leesbaar,
 * staat er wat er misging, en is er één knop die terugbrengt naar Vandaag.
 *
 * De fout gaat altijd naar de console, zodat hij bij een melding terug te vinden is.
 */

export function ErrorFallback({
  error,
  scherm,
  onReset,
}: {
  error: Error
  /** naam van het scherm dat vastliep, voor de melding */
  scherm?: string
  onReset: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-block overflow-y-auto px-gutter py-block" role="alert">
      <h2 className="font-serif text-exercise leading-exercise text-ink">
        {scherm ? `Het scherm ${scherm} liep vast` : 'Dit scherm liep vast'}
      </h2>
      <p className="quote">
        Er is niets kwijt: je gegevens staan gewoon op dit toestel. Ga terug naar Vandaag en
        probeer het opnieuw. Blijft het gebeuren, maak dan een export en meld deze tekst.
      </p>
      <p className="break-words border-hair border-rule bg-field-bg p-3 font-mono text-meta text-dim">
        {error?.message || 'Onbekende fout'}
      </p>
      <button className="btn-primary w-full" onClick={onReset}>
        Terug naar Vandaag
      </button>
    </div>
  )
}

interface Props {
  children: ReactNode
  /** naam van het scherm, alleen voor de melding */
  scherm?: string
  /** terug naar Vandaag; zonder dit herlaadt de app, wat op hetzelfde neerkomt */
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Scherm ${this.props.scherm ?? '(onbekend)'} liep vast:`, error, info.componentStack)
  }

  private handleReset = (): void => {
    // eerst de fout weg, anders blijft de melding staan als het scherm hetzelfde blijft
    this.setState({ error: null })
    if (this.props.onReset) this.props.onReset()
    else if (typeof window !== 'undefined') window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback error={this.state.error} scherm={this.props.scherm} onReset={this.handleReset} />
      )
    }
    return this.props.children
  }
}
