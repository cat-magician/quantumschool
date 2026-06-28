import { useEffect, useRef, useState } from 'react';
import { resolveCoverImageUrl } from '../lib/yandexDiskImageUtils';

export default function LessonCoverImage({
  url,
  className,
  onError,
}: {
  url: string;
  className?: string;
  onError?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSrc(null);

    resolveCoverImageUrl(url)
      .then((resolved) => {
        if (!cancelled) {
          setSrc(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          onErrorRef.current?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return <div className={`${className ?? ''} bg-slate-800/80 animate-pulse`} />;
  }

  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => onError?.()}
    />
  );
}
