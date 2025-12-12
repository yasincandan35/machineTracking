import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { Portal } from '@radix-ui/react-portal';
import { useTheme } from '../contexts/ThemeContext';

export default function MachineSelect({ value, onChange, items }) {
  const { isLiquidGlass, isFluid } = useTheme();
  
  // Value'yu normalize et - string olmalı
  const normalizedValue = value !== null && value !== undefined ? String(value) : "";
  
  // Duplicate value kontrolü - daha agresif filtreleme
  const seenValues = new Set();
  const uniqueItems = items?.filter(item => {
    if (seenValues.has(item.value)) {
      return false;
    }
    seenValues.add(item.value);
    return true;
  }) || [];
  
  // Sadece bir kez uyar (spam önleme)
  if (uniqueItems.length !== items?.length && items?.length > 0) {
    const duplicates = items.filter((item, index, self) => 
      self.findIndex(i => i.value === item.value) !== index
    );
    console.warn('⚠️ MachineSelect: Duplicate value\'ler bulundu ve filtrelendi:', duplicates);
  }
  
  return (
    <Select.Root value={normalizedValue} onValueChange={onChange}>
      <Select.Trigger className={`inline-flex items-center justify-between px-4 py-2 text-sm transition-all min-w-[150px] ${
        isFluid
          ? 'bg-black/40 backdrop-blur-md border border-white/30 rounded-lg text-white hover:bg-black/50'
          : isLiquidGlass 
            ? 'glass-button'
            : 'rounded-md bg-white dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600'
      }`}>
        <Select.Value placeholder="Makine seçin..." />
        <Select.Icon>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Portal>
        <Select.Content 
          className={`z-50 max-h-60 overflow-auto min-w-[200px] ${
            isFluid
              ? 'bg-black/60 backdrop-blur-lg border border-white/20 rounded-md shadow-lg text-white'
              : isLiquidGlass 
                ? 'glass-card'
                : 'bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-600'
          }`}
          position="popper"
          sideOffset={4}
          align="start"
          avoidCollisions={true}
          side="bottom"
          collisionPadding={8}
          style={{
            position: 'fixed',
            zIndex: 9999,
            transform: 'translate3d(0, 0, 0)',
            top: 'auto',
            left: 'auto',
            right: 'auto',
            bottom: 'auto',
            margin: '0',
            padding: '0',
            boxSizing: 'border-box',
            width: 'auto',
            height: 'auto',
            display: 'block',
            visibility: 'visible',
            overflow: 'visible',
            pointerEvents: 'auto',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            textAlign: 'left',
            direction: 'ltr',
            wordWrap: 'normal'
          }}
        >
          <Select.Viewport className="p-1">
            {uniqueItems.map((item) => (
              <Select.Item
                key={item.value}
                value={String(item.value)}
                className={`relative cursor-pointer select-none rounded px-3 py-2 text-sm transition-all font-medium ${
                  isFluid
                    ? 'text-white hover:bg-white/20'
                    : 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-[1.02]'
                }`}
              >
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Portal>
    </Select.Root>
  );
}