import { createContext, useContext } from 'react'

export const CallContext = createContext(null)

export function useCall() {
  const context = useContext(CallContext)
  if (!context) throw new Error('useCall must be used inside CallProvider')
  return context
}
