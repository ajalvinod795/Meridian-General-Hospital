import React, { useEffect, useState } from 'react';
import { Building2, Stethoscope } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackType?: 'hospital' | 'doctor';
  fallbackTitle?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackType = 'doctor',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-500 border border-slate-200 ${className}`}
        role="img"
        aria-label={alt}
      >
        {fallbackType === 'hospital' ? (
          <Building2 className="w-8 h-8 text-teal-700 mb-2" />
        ) : (
          <Stethoscope className="w-7 h-7 text-teal-700 mb-1.5" />
        )}
        {fallbackTitle && (
          <span className="text-xs font-medium text-slate-600 px-3 text-center truncate max-w-full">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
