import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { validateIdentifier, type IdentifierValidation } from '../features/package-match/identifier'
import type { PackageMatchLookup, PackageMatchesResponse } from '../features/package-match/types'
import '../i18n'
import { LotusMark } from '../ui/LotusMark'


type JourneyState =
  | { name: 'entry' }
  | { name: 'invalid'; reason: Extract<IdentifierValidation, { valid: false }>['reason'] }
  | { name: 'noMatch'; result: PackageMatchesResponse }
  | { name: 'match'; result: PackageMatchesResponse }
  | { name: 'failure'; identifier: string }

type AppProps = {
  lookup: PackageMatchLookup
}

export function App({ lookup }: AppProps) {
  const { i18n, t } = useTranslation()
  const [enteredIdentifier, setEnteredIdentifier] = useState('')
  const [journey, setJourney] = useState<JourneyState>({ name: 'entry' })
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingIdentifierRef = useRef<string | null>(null)
  const mutation = useMutation({
    mutationFn: (identifier: string) => lookup(identifier),
    onSuccess: (result) => {
      setEnteredIdentifier(result.normalized_identifier)
      if (result.candidates.length === 0) {
        setJourney({ name: 'noMatch', result })
      } else {
        setJourney({ name: 'match', result })
      }
      pendingIdentifierRef.current = null
    },
    onError: () => {
      setJourney({ name: 'failure', identifier: pendingIdentifierRef.current ?? enteredIdentifier })
      pendingIdentifierRef.current = null
    },
  })

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  const submitIdentifier = (value: string) => {
    if (mutation.isPending) return
    const validation = validateIdentifier(value)
    if (!validation.valid) {
      setJourney({ name: 'invalid', reason: validation.reason })
      inputRef.current?.focus()
      return
    }
    setEnteredIdentifier(validation.value)
    setJourney({ name: 'entry' })
    pendingIdentifierRef.current = validation.value
    mutation.mutate(validation.value)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitIdentifier(enteredIdentifier)
  }

  const tryAnother = () => {
    setJourney({ name: 'entry' })
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  const validationMessage = journey.name === 'invalid' ? t(`error.${journey.reason}`) : undefined
  const outcome = journey.name === 'noMatch' || journey.name === 'match' ? journey : undefined
  const announcement = mutation.isPending
    ? t('loading')
    : journey.name === 'noMatch'
      ? t('noMatchTitle')
      : journey.name === 'match'
        ? t('matchTitle')
        : journey.name === 'failure'
          ? t('failureTitle')
          : ''

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <LotusMark />
          <span>{t('brand')}</span>
        </div>
        <div className="language-control" role="group" aria-label={t('language')}>
          <button
            aria-pressed={i18n.language === 'km'}
            onClick={() => void i18n.changeLanguage('km')}
            type="button"
          >
            {t('khmer')}
          </button>
          <button
            aria-pressed={i18n.language === 'en'}
            onClick={() => void i18n.changeLanguage('en')}
            type="button"
          >
            {t('english')}
          </button>
        </div>
      </header>

      <main className="journey">
        <section className="intro" aria-labelledby="journey-title">
          <p className="context-line">GTIN · EAN · UPC</p>
          <h1 id="journey-title">{t('title')}</h1>
          <p>{t('guidance')}</p>
        </section>

        <form className="identifier-form" noValidate onSubmit={onSubmit}>
          <label htmlFor="identifier">{t('fieldLabel')}</label>
          <input
            ref={inputRef}
            id="identifier"
            name="identifier"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={enteredIdentifier}
            aria-describedby={`identifier-hint${validationMessage ? ' identifier-error' : ''}`}
            aria-errormessage={validationMessage ? 'identifier-error' : undefined}
            aria-invalid={validationMessage ? true : undefined}
            onChange={(event) => {
              setEnteredIdentifier(event.target.value)
              if (journey.name === 'invalid') setJourney({ name: 'entry' })
            }}
          />
          <p className="field-hint" id="identifier-hint">{t('fieldHint')}</p>
          {validationMessage ? (
            <p className="field-error" id="identifier-error" role="alert">{validationMessage}</p>
          ) : null}
          <button
            className="primary-button"
            disabled={!enteredIdentifier.trim() || mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? t('loading') : t('submit')}
          </button>
        </form>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        {mutation.isPending ? (
          <div className="loading-feedback" aria-hidden="true">
            <span />
            <p>{t('loading')}</p>
          </div>
        ) : null}

        {outcome ? (
          <section className="outcome" aria-labelledby="outcome-title">
            <div className="outcome-symbol" aria-hidden="true">{outcome.name === 'noMatch' ? '?' : 'i'}</div>
            <h2 id="outcome-title">{t(outcome.name === 'noMatch' ? 'noMatchTitle' : 'matchTitle')}</h2>
            <p>{t(outcome.name === 'noMatch' ? 'noMatchBody' : 'matchBody')}</p>
            <dl>
              <dt>{t('identifierLabel')}</dt>
              <dd>{outcome.result.normalized_identifier}</dd>
            </dl>
            <button className="secondary-button" onClick={tryAnother} type="button">{t('tryAnother')}</button>
          </section>
        ) : null}

        {journey.name === 'failure' && !mutation.isPending ? (
          <section className="outcome" aria-labelledby="failure-title">
            <div className="outcome-symbol" aria-hidden="true">!</div>
            <h2 id="failure-title">{t('failureTitle')}</h2>
            <p>{t('failureBody')}</p>
            <dl>
              <dt>{t('identifierLabel')}</dt>
              <dd>{journey.identifier}</dd>
            </dl>
            <div className="recovery-actions">
              <button className="primary-button" onClick={() => submitIdentifier(journey.identifier)} type="button">
                {t('retry')}
              </button>
              <button className="secondary-button" onClick={tryAnother} type="button">{t('tryAnother')}</button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
