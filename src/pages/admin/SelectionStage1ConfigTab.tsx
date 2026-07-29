import { useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, FileText, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchSelectionConfig,
  parseYandexFormId,
  saveSelectionConfig,
  yandexFormInputDisplayUrl,
  YANDEX_FORM_INPUT_PLACEHOLDER,
} from '../../lib/selectionConfig';
import YandexFormEmbed from '../../components/YandexFormEmbed';
import StageComingSoon from '../../components/StageComingSoon';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';

type Stage1Field = 'questionnaire' | 'essay';

export default function SelectionStage1ConfigTab() {
  const { user } = useAuth();
  const [questionnaireInput, setQuestionnaireInput] = useState('');
  const [essayInput, setEssayInput] = useState('');
  const [questionnairePublished, setQuestionnairePublished] = useState(false);
  const [essayPublished, setEssayPublished] = useState(false);
  const [savedQuestionnaireId, setSavedQuestionnaireId] = useState('');
  const [savedEssayId, setSavedEssayId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<Stage1Field | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    const cfg = await fetchSelectionConfig();
    setSavedQuestionnaireId(cfg.questionnaire_form_id);
    setQuestionnaireInput(yandexFormInputDisplayUrl(cfg.questionnaire_form_id));
    setQuestionnairePublished(cfg.questionnaire_published);
    setSavedEssayId(cfg.essay_form_id);
    setEssayInput(yandexFormInputDisplayUrl(cfg.essay_form_id));
    setEssayPublished(cfg.essay_published);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (field: Stage1Field, nextPublished: boolean) => {
    if (!user) return;
    setSavingField(field);
    setError('');
    setSuccess('');

    const input = field === 'questionnaire' ? questionnaireInput : essayInput;
    const formId = parseYandexFormId(input);
    if (!formId) {
      setError('Укажите ссылку на Яндекс.Форму или ID формы');
      setSavingField(null);
      return;
    }

    const patch =
      field === 'questionnaire'
        ? { questionnaire_form_id: formId, questionnaire_published: nextPublished }
        : { essay_form_id: formId, essay_published: nextPublished };

    const { error: saveError } = await saveSelectionConfig(patch, user.id);

    if (saveError) {
      setError('Не удалось сохранить. Проверьте, что применена миграция selection_stage_config.');
      setSavingField(null);
      return;
    }

    if (field === 'questionnaire') {
      setSavedQuestionnaireId(formId);
      setQuestionnairePublished(nextPublished);
      setSuccess(
        nextPublished
          ? 'Анкета опубликована — ученики видят её на этапе 1'
          : 'Анкета сохранена',
      );
    } else {
      setSavedEssayId(formId);
      setEssayPublished(nextPublished);
      setSuccess(
        nextPublished
          ? 'Форма эссе опубликована — ученики видят её на этапе 1'
          : 'Форма эссе сохранена',
      );
    }

    setSavingField(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const questionnairePreview = questionnairePublished && !!savedQuestionnaireId.trim();
  const essayPreview = essayPublished && !!savedEssayId.trim();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Этап 1</h2>
        <p className="text-slate-400 text-sm">
          Анкета участника и мотивационное эссе. После публикации формы появятся у учеников на этапе 1.
        </p>
        <SectionHint text={SECTION_HINT.admin.selectionStage1} className="mt-1.5" />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-white">Анкета участника</h3>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-300 mb-2 block">Ссылка на форму</span>
          <input
            value={questionnaireInput}
            onChange={(e) => setQuestionnaireInput(e.target.value)}
            placeholder={YANDEX_FORM_INPUT_PLACEHOLDER}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            questionnairePreview
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
              : 'text-slate-400 bg-white/5 border-white/10'
          }`}>
            {questionnairePreview ? <CheckCircle className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
            {questionnairePreview ? 'Опубликовано' : 'Не опубликовано'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSave('questionnaire', questionnairePublished)}
            disabled={savingField === 'questionnaire'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingField === 'questionnaire' ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('questionnaire', true)}
            disabled={savingField === 'questionnaire'}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Опубликовать
          </button>
          {questionnairePublished && (
            <button
              type="button"
              onClick={() => handleSave('questionnaire', false)}
              disabled={savingField === 'questionnaire'}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
        </div>
      </section>

      <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-white">Мотивационное эссе</h3>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-300 mb-2 block">Ссылка на форму</span>
          <input
            value={essayInput}
            onChange={(e) => setEssayInput(e.target.value)}
            placeholder={YANDEX_FORM_INPUT_PLACEHOLDER}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            essayPreview
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
              : 'text-slate-400 bg-white/5 border-white/10'
          }`}>
            {essayPreview ? <CheckCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            {essayPreview ? 'Опубликовано' : 'Не опубликовано'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSave('essay', essayPublished)}
            disabled={savingField === 'essay'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingField === 'essay' ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('essay', true)}
            disabled={savingField === 'essay'}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Опубликовать
          </button>
          {essayPublished && (
            <button
              type="button"
              onClick={() => handleSave('essay', false)}
              disabled={savingField === 'essay'}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
        </div>
      </section>

      <div className="space-y-6">
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8">
          <h3 className="font-semibold text-white mb-5">Предпросмотр: анкета</h3>
          {questionnairePreview && savedQuestionnaireId ? (
            <YandexFormEmbed formId={savedQuestionnaireId} />
          ) : (
            <StageComingSoon stage="questionnaire" />
          )}
        </div>
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8">
          <h3 className="font-semibold text-white mb-5">Предпросмотр: эссе</h3>
          {essayPreview && savedEssayId ? (
            <YandexFormEmbed formId={savedEssayId} />
          ) : (
            <StageComingSoon stage="essay" />
          )}
        </div>
      </div>
    </div>
  );
}
