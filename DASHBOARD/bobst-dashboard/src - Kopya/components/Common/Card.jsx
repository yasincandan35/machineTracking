import React from 'react';
import { cn } from '../../lib/utils';

export default function Card({ 
  children, 
  className = '',
  header,
  footer,
  ...props 
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50',
        className
      )}
      {...props}
    >
      {header && (
        <div className="flex flex-col space-y-1.5 p-6">
          {header}
        </div>
      )}
      <div className="p-6 pt-0">
        {children}
      </div>
      {footer && (
        <div className="flex items-center p-6 pt-0">
          {footer}
        </div>
      )}
    </div>
  );
} 