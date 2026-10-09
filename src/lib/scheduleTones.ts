import {
  BookOpen, GraduationCap, MessagesSquare, Presentation, Users, Video,
} from 'lucide-react';
import type { ScheduleEventType } from './types';

/**
 * Цвет и значок каждого типа события — одни и те же в карточках, плашках,
 * точках календаря и на странице занятия.
 */
type Tone = { chip: string; tile: string; dot: string; icon: typeof Video };

export const EVENT_TONES: Record<ScheduleEventType, Tone> = {
  lecture: {
    chip: 'bg-blue-500/15 text-blue-200 border-blue-500/25',
    tile: 'from-blue-600/50 via-indigo-700/30 to-slate-900',
    dot: 'bg-blue-400',
    icon: Presentation,
  },
  seminar: {
    chip: 'bg-violet-500/15 text-violet-200 border-violet-500/25',
    tile: 'from-violet-600/50 via-purple-700/30 to-slate-900',
    dot: 'bg-violet-400',
    icon: Users,
  },
  webinar: {
    chip: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/25',
    tile: 'from-cyan-600/45 via-sky-800/30 to-slate-900',
    dot: 'bg-cyan-400',
    icon: Video,
  },
  exam: {
    chip: 'bg-rose-500/15 text-rose-200 border-rose-500/25',
    tile: 'from-rose-600/45 via-rose-900/30 to-slate-900',
    dot: 'bg-rose-400',
    icon: GraduationCap,
  },
  consultation: {
    chip: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
    tile: 'from-emerald-600/45 via-emerald-900/30 to-slate-900',
    dot: 'bg-emerald-400',
    icon: MessagesSquare,
  },
  homework: {
    chip: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
    tile: 'from-amber-500/45 via-amber-800/25 to-slate-900',
    dot: 'bg-amber-400',
    icon: BookOpen,
  },
};
