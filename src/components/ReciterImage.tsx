import React, { useState } from 'react';

interface ReciterImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/الشيخ|الدكتور|القارئ|د\./g, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ق';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ''} ${parts[1][0] || ''}`.trim();
}

export const ReciterImage: React.FC<ReciterImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F241C] via-[#0B1511] to-[#080C0B] text-[#C8A253] select-none ${className}`}
      >
        <span className="font-display text-xl sm:text-2xl font-bold tracking-normal">
          {getInitials(alt)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
