import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { Portal } from '@radix-ui/react-portal';

export default function MachineSelect({ value, onChange, items }) {
  return (
    <Select.Root value={value || ""} onValueChange={onChange}>
      <Select.Trigger className="inline-flex items-center justify-between rounded-md px-4 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-all">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Portal>
        <Select.Content 
          className="z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-600 max-h-60 overflow-auto min-w-[200px]"
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
            {(items ?? []).map((item) => (
              <Select.Item
                key={item.id}
                value={item.id}
                className={`relative cursor-pointer select-none rounded px-3 py-2 text-sm text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-[1.02] transition-all font-medium`}
              >
                <Select.ItemText>{item.name}</Select.ItemText>
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