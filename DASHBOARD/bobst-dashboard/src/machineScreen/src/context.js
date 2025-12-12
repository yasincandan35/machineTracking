import { createContext, useContext } from 'react';

export const MachineScreenContext = createContext(null);

export const useMachineScreen = () => {
  const ctx = useContext(MachineScreenContext);
  if (!ctx) {
    throw new Error('MachineScreenContext provider bulunmadan MachineScreen bileşeni kullanılıyor');
  }
  return ctx;
};

