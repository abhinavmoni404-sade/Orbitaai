import React, { useId } from 'react';

interface OrbitaLogoProps {
  variant?: 'horizontal' | 'icon' | 'mono' | 'app-icon';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'auto' | 'light' | 'dark';
  className?: string;
}

export const OrbitaLogo: React.FC<OrbitaLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  tone = 'auto',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `orbita-grad-${uid}`;
  const bgGradId = `orbita-bg-${uid}`;

  const iconSizes = {
    sm: 28,
    md: 34,
    lg: 44,
  };
  const dim = iconSizes[size];

  const textSizeClass = {
    sm: 'text-[15px]',
    md: 'text-[18px]',
    lg: 'text-[22px]',
  }[size];

  const wordmarkColorClass =
    tone === 'dark'
      ? 'text-[#F8FAFC]'
      : tone === 'light'
        ? 'text-[#111827]'
        : 'text-[#111827] dark:text-[#F8FAFC]';

  if (variant === 'app-icon') {
    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="ORBITA AI"
      >
        <defs>
          <linearGradient id={bgGradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#101827" />
            <stop offset="100%" stopColor="#182338" />
          </linearGradient>
          <linearGradient id={gradId} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4563FF" />
            <stop offset="55%" stopColor="#8B7CFF" />
            <stop offset="100%" stopColor="#20C9B7" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={`url(#${bgGradId})`} />
        <path
          d="M47.5 18.5C43.4 13.8 37.9 11 32 11C20.4 11 11 20.4 11 32C11 43.6 20.4 53 32 53C42.2 53 50.7 45.7 52.6 36"
          stroke={`url(#${gradId})`}
          strokeWidth="5.2"
          strokeLinecap="round"
        />
        <ellipse
          cx="32"
          cy="32"
          rx="23"
          ry="11"
          transform="rotate(-24 32 32)"
          stroke="#20C9B7"
          strokeOpacity="0.72"
          strokeWidth="2.2"
        />
        <circle cx="32" cy="32" r="7.5" fill={`url(#${gradId})`} />
        <circle cx="51" cy="23.5" r="3.6" fill="#20C9B7" />
        <circle cx="16.5" cy="42.5" r="2.8" fill="#8B7CFF" />
      </svg>
    );
  }

  const isMono = variant === 'mono';

  const symbol = (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden={variant === 'horizontal'}
      aria-label={variant === 'horizontal' ? undefined : 'ORBITA AI'}
    >
      {!isMono && (
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4563FF" />
            <stop offset="55%" stopColor="#8B7CFF" />
            <stop offset="100%" stopColor="#20C9B7" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M30.5 11.2C27.8 8.2 24.1 6.5 20 6.5C12.5 6.5 6.5 12.5 6.5 20C6.5 27.5 12.5 33.5 20 33.5C26.5 33.5 32 28.9 33.2 22.7"
        stroke={isMono ? 'currentColor' : `url(#${gradId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="15.5"
        ry="7"
        transform="rotate(-24 20 20)"
        stroke={isMono ? 'currentColor' : '#20C9B7'}
        strokeOpacity={isMono ? 0.55 : 0.78}
        strokeWidth="1.6"
      />
      <circle cx="20" cy="20" r="4.8" fill={isMono ? 'currentColor' : `url(#${gradId})`} />
      <circle cx="32.8" cy="14.2" r="2.4" fill={isMono ? 'currentColor' : '#20C9B7'} />
      <circle cx="9.8" cy="26.8" r="1.9" fill={isMono ? 'currentColor' : '#8B7CFF'} />
    </svg>
  );

  if (variant === 'icon') {
    return <span className={`inline-flex items-center justify-center ${className}`}>{symbol}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      {symbol}
      <span
        className={`font-bold tracking-tight leading-none ${textSizeClass} ${
          isMono ? 'text-current' : wordmarkColorClass
        }`}
      >
        ORBITA <span className={isMono ? '' : 'text-[#4563FF]'}>AI</span>
      </span>
    </span>
  );
};
