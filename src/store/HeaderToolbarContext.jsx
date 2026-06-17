import { createContext, useContext, useState, useCallback } from 'react';

const HeaderToolbarContext = createContext(null);

export function HeaderToolbarProvider({ children }) {
  const [toolbar, setToolbarNode] = useState(null);

  const setToolbar = useCallback((node) => setToolbarNode(node), []);
  const clearToolbar = useCallback(() => setToolbarNode(null), []);

  return (
    <HeaderToolbarContext.Provider value={{ toolbar, setToolbar, clearToolbar }}>
      {children}
    </HeaderToolbarContext.Provider>
  );
}

export function useHeaderToolbar() {
  return useContext(HeaderToolbarContext);
}
