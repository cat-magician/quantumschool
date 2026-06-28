import type { ReactNode } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]"'])/g;

export function linkifyText(text: string): ReactNode[] {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
