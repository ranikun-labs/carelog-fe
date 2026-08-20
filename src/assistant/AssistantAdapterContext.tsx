/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

import type { AssistantAdapter } from '@/assistant/assistantAdapter';

const AssistantAdapterContext = createContext<AssistantAdapter | null>(null);

export function AssistantAdapterProvider({
  adapter,
  children,
}: {
  adapter?: AssistantAdapter;
  children: ReactNode;
}) {
  return (
    <AssistantAdapterContext.Provider value={adapter ?? null}>
      {children}
    </AssistantAdapterContext.Provider>
  );
}

export function useOptionalAssistantAdapter(): AssistantAdapter | null {
  return useContext(AssistantAdapterContext);
}
