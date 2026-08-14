import { useEffect, useRef, useState } from 'react'
import type { ModelOption } from '../lib/geminiModels'

interface ModelSelectProps {
  value: string
  options: ModelOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ModelSelect({
  value,
  options,
  onChange,
  placeholder = 'Select a model',
  disabled = false,
}: ModelSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const selected = options.find((option) => option.id === value)

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
    <div className={`provider-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="provider-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className="provider-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && options.length > 0 && (
        <ul className="provider-select-menu model-select-menu" role="listbox">
          {options.map((option) => {
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
                  <span className="model-option-label">{option.label}</span>
                  <span className="model-option-id">{option.id}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
