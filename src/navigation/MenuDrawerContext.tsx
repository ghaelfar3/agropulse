
import { createContext, useContext } from 'react';

const MenuDrawerContext = createContext<() => void>(() => {});

export const MenuDrawerProvider = MenuDrawerContext.Provider;

export function useOpenMenuDrawer() {
  return useContext(MenuDrawerContext);
}
