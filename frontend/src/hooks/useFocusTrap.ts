'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Piège le focus dans `containerRef` tant que `active` est vrai (WCAG 2.1.2).
 * - Focus le premier élément focusable à l'activation
 * - Tab / Shift+Tab bouclent à l'intérieur du conteneur
 * - Escape appelle `onClose`
 * - Restitue le focus à l'élément actif d'origine à la désactivation
 *
 * `onClose` doit être référentiellement stable (useCallback) pour éviter
 * de réinstaller le listener à chaque render.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!active || !container) return

    restoreRef.current = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    focusables()[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      // Focus hors du conteneur (ex : resté sur le burger) → on le ramène dedans
      if (!container.contains(current)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && current === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      restoreRef.current?.focus()
    }
  }, [active, containerRef, onClose])
}
