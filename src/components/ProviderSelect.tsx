import { useEffect, useRef, useState } from 'react'
import type { ImageProvider } from '../types'
import { PROVIDER_OPTIONS } from '../types'

interface ProviderSelectProps {
  value: ImageProvider
  onChange: (value: ImageProvider) => void
}

export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const selected =
    PROVIDER_OPTIONS.find((option) => option.id === value) ?? PROVIDER_OPTIONS[0]

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="provider-select" ref={rootRef}>
      <button
        type="button"
        className="provider-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className="provider-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul className="provider-select-menu" role="listbox">
          {PROVIDER_OPTIONS.map((option) => {
            const isActive = option.id === value
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`provider-select-option${isActive ? ' active' : ''}`}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
