import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeHomeworkMarkdown } from '../lib/homeworkPageUtils';

const PROSE =
  'homework-markdown w-full max-w-none text-sm text-slate-300 leading-relaxed ' +
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2 ' +
  '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-2 ' +
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mt-2 [&_h3]:mb-1 ' +
  '[&_p]:my-2 [&_p]:w-full [&_p]:max-w-none ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 ' +
  '[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-white/10 [&_code]:text-violet-200 ' +
  '[&_pre]:my-3 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-white/10 [&_pre]:overflow-x-auto ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-blue-500/40 [&_blockquote]:pl-4 [&_blockquote]:text-slate-400 ' +
  '[&_a]:text-blue-400 [&_a]:hover:underline ' +
  '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-white/10 ' +
  '[&_.katex]:inline [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto';

/** Markdown + inline LaTeX ($…$) для блоков домашних заданий. */
export default function HomeworkMarkdown({ source }: { source: string }) {
  const content = normalizeHomeworkMarkdown(source);
  if (!content.trim()) return null;

  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
