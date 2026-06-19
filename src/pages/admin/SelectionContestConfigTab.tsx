import { useEffect, useState } from 'react';
import { CheckCircle, FlaskConical, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchSelectionConfig,
  normalizeContestUrl,
  saveSelectionConfig,
} from '../../lib/selectionConfig';
import StageEmbedFrame from '../../components/StageEmbedFrame';
import { YANDEX_FORM_EMBED } from '../../lib/constants';

export default function SelectionContestConfigTab() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [published, setPublished] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    const cfg = await fetchSelectionConfig();
    setSavedUrl(cfg.contest_url);
    setInput(cfg.contest_url);
    setPublished(cfg.contest_published);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (nextPublished: boolean) => {
    if (!user) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const contestUrl = normalizeContestUrl(input);
    if (!contestUrl) {
      setError('Укажите корректную ссылку на контест (https://…)');
      setSaving(false);
      return;
    }

    const { error: saveError } = await saveSelectionConfig(
      { contest_url: contestUrl, contest_published: nextPublished },
      user.id,
    );

    if (saveError) {
      setError('Не удалось сохранить. Проверьте, что применена миграция selection_stage_config.');
      setSaving(false);
      return;
    }

    setSavedUrl(contestUrl);
    setPublished(nextPublished);
    setSuccess(
      nextPublished
        ? 'Контест опубликован — ученики видят его на этапе 2'
        : 'Сохранено',
    );
    setSaving(false);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const previewPublished = published && !!savedUrl.trim();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Этап 2: Задачи</h2>
        <p className="text-slate-400 text-sm">
          Ссылка на Яндекс.Контест. После публикации контест откроется у учеников во встроенном фрейме.
        </p>
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-300 mb-2 block">Ссылка на контест</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://contest.yandex.ru/…"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>

        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            previewPublished
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
              : 'text-slate-400 bg-white/5 border-white/10'
          }`}>
            {previewPublished ? <CheckCircle className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
            {previewPublished ? 'Опубликовано' : 'Не опубликовано'}
          </span>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSave(published)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Опубликовать
          </button>
          {published && (
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
        </div>
      </div>

      {previewPublished && savedUrl && (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8">
          <h3 className="font-semibold text-white mb-5">Предпросмотр для учеников</h3>
          <StageEmbedFrame minHeight={420}>
            <iframe
              src={savedUrl}
              title="Яндекс.Контест — предпросмотр"
              width={YANDEX_FORM_EMBED.width}
              frameBorder={0}
              className="block border-0 bg-white"
              style={{ width: YANDEX_FORM_EMBED.width }}
              allow="clipboard-write"
            />
          </StageEmbedFrame>
        </div>
      )}
    </div>
  );
}
