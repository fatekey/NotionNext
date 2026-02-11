import { useEffect, useState } from 'react'

/**
 * Endspace responsive helper:
 * return `true` for desktop (>=768px), `false` for mobile, `null` before hydration.
 */
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = (event) => {
      setIsDesktop(event.matches)
    }

    setIsDesktop(mediaQuery.matches)

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isDesktop
}

export default useIsDesktop
