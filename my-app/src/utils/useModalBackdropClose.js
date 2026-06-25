import { useRef } from 'react'

export function useModalBackdropClose(onClose) {
  const pointerStartedOnBackdrop = useRef(false)

  return {
    onPointerDown(event) {
      pointerStartedOnBackdrop.current = event.target === event.currentTarget
    },
    onClick(event) {
      if (event.target === event.currentTarget && pointerStartedOnBackdrop.current) {
        onClose?.(event)
      }
      pointerStartedOnBackdrop.current = false
    },
  }
}
