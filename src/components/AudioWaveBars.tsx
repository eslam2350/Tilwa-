import React from 'react';

interface AudioWaveBarsProps {
  active?: boolean;
  className?: string;
}

export const AudioWaveBars: React.FC<AudioWaveBarsProps> = ({ active = true, className = '' }) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-[2px] h-3.5 ${className}`}
    >
      <span
        className={`w-[2.5px] h-full rounded-full bg-current ${active ? 'eq-bar' : 'eq-bar-paused'}`}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={`w-[2.5px] h-full rounded-full bg-current ${active ? 'eq-bar' : 'eq-bar-paused'}`}
        style={{ animationDelay: '220ms' }}
      />
      <span
        className={`w-[2.5px] h-full rounded-full bg-current ${active ? 'eq-bar' : 'eq-bar-paused'}`}
        style={{ animationDelay: '440ms' }}
      />
    </span>
  );
};
