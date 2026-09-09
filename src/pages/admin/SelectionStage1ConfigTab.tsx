import { useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, FileText, Link2, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchSelectionConfig,
  parseOptionalYandexFormId,
  parseOptionalYandexPrefillParam,
  saveSelectionConfig,
  yandexFormInputDisplayUrl,
  YANDEX_FORM_INPUT_PLACEHOLDER,
  YANDEX_PREFILL_INPUT_PLACEHOLDER,
} from '../../lib/selectionConfig';
import YandexFormEmbed from '../../components/YandexFormEmbed';
import StageComingSoon from '../../components/StageComingSoon';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';

type Stage1Field = 'questionnaire' | 'essay';
type SavingTarget = Stage1Field | 'prefill';

export default function SelectionStage1ConfigTab() {
  const { user } = useAuth();
  const [questionnaireInput, setQuestionnaireInput] = useState('');
  const [essayInput, setEssayInput] = useState('');
  const [questionnairePublished, setQuestionnairePublished] = useState(false);
  const [essayPublished, setEssayPublished] = useState(false);
  const [savedQuestionnaireId, setSavedQuestionnaireId] = useState('');
  const [savedEssayId, setSavedEssayId] = useState('');
  const [questionnairePrefillInput, setQuestionnairePrefillInput] = useState('');
  const [essayPrefillInput, setEssayPrefillInput] = useState('');
  const [savedQuestionnairePrefill, setSavedQuestionnairePrefill] = useState('');
  const [savedEssayPrefill, setSavedEssayPrefill] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<SavingTarget | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const cfg = await fetchSelectionConfig();
      setSavedQuestionnaireId(cfg.questionnaire_form_id);
      setQuestionnaireInput(yandexFormInputDisplayUrl(cfg.questionnaire_form_id));
      setQuestionnairePublished(cfg.questionnaire_published);
      setSavedEssayId(cfg.essay_form_id);
      setEssayInput(yandexFormInputDisplayUrl(cfg.essay_form_id));
      setEssayPublished(cfg.essay_published);
      setSavedQuestionnairePrefill(cfg.questionnaire_prefill_param);
      setQuestionnairePrefillInput(cfg.questionnaire_prefill_param);
      setSavedEssayPrefill(cfg.essay_prefill_param);
      setEssayPrefillInput(cfg.essay_prefill_param);
      setLoading(false);
    })();
  }, []);

  const flash = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 3500);
  };

  const parseFieldInput = (field: Stage1Field) => {
    const input = field === 'questionnaire' ? questionnaireInput : essayInput;
    return parseOptionalYandexFormId(input);
  };

  const handleSaveLink = async (field: Stage1Field) => {
    if (!user) return;
    setSavingField(field);
    setError('');
    setSuccess('');

    const formId = parseFieldInput(field);
    if (formId === false) {
      setError('Укажите ссылку на Яндекс.Форму или ID формы');
      setSavingField(null);
      return;
    }

    const patch =
      field === 'questionnaire'
        ? { questionnaire_form_id: formId }
        : { essay_form_id: formId };

    const { error: saveError } = await saveSelectionConfig(patch, user.id);

    if (saveError) {
      setError('Не удалось сохранить. Проверьте, что применена миграция selection_stage_config.');
      setSavingField(null);
      return;
    }

    if (field === 'questionnaire') {
      setSavedQuestionnaireId(formId);
      setQuestionnaireInput(formId ? yandexFormInputDisplayUrl(formId) : '');
      if (!formId) setQuestionnairePublished(false);
      flash(formId ? 'Ссылка на анкету сохранена' : 'Ссылка на анкету удалена');
    } else {
      setSavedEssayId(formId);
      setEssayInput(formId ? yandexFormInputDisplayUrl(formId) : '');
      if (!formId) setEssayPublished(false);
      flash(formId ? 'Ссылка на форму эссе сохранена' : 'Ссылка на форму эссе удалена');
    }

    setSavingField(null);
  };

  const handlePublish = async (field: Stage1Field) => {
    if (!user) return;
    setSavingField(field);
    setError('');
    setSuccess('');

    const formId = parseFieldInput(field);
    if (formId === false || !formId) {
      setError('Укажите ссылку на Яндекс.Форму или ID формы');
      setSavingField(null);
      return;
    }

    const patch =
      field === 'questionnaire'
        ? { questionnaire_form_id: formId, questionnaire_published: true }
        : { essay_form_id: formId, essay_published: true };

    const { error: saveError } = await saveSelectionConfig(patch, user.id);

    if (saveError) {
      setError('Не удалось опубликовать. Проверьте, что применена миграция selection_stage_config.');
      setSavingField(null);
      return;
    }

    if (field === 'questionnaire') {
      setSavedQuestionnaireId(formId);
      setQuestionnaireInput(yandexFormInputDisplayUrl(formId));
      setQuestionnairePublished(true);
      flash('Анкета опубликована — ученики видят её на этапе 1');
    } else {
      setSavedEssayId(formId);
      setEssayInput(yandexFormInputDisplayUrl(formId));
      setEssayPublished(true);
      flash('Форма эссе опубликована — ученики видят её на этапе 1');
    }

    setSavingField(null);
  };

  const handleSavePrefill = async () => {
    if (!user) return;
    setSavingField('prefill');
    setError('');
    setSuccess('');

    const questionnaireParam = parseOptionalYandexPrefillParam(questionnairePrefillInput);
    const essayParam = parseOptionalYandexPrefillParam(essayPrefillInput);

    if (questionnaireParam === false || essayParam === false) {
      setError('Не разобрали параметр. Ожидается answer_… или ссылка с предзаполненным ответом.');
      setSavingField(null);
      return;
    }

    const { error: saveError } = await saveSelectionConfig({
      questionnaire_prefill_param: questionnaireParam,
      essay_prefill_param: essayParam,
    }, user.id);

    if (saveError) {
      setError('Не удалось сохранить привязку.');
      setSavingField(null);
      return;
    }

    setSavedQuestionnairePrefill(questionnaireParam);
    setQuestionnairePrefillInput(questionnaireParam);
    setSavedEssayPrefill(essayParam);
    setEssayPrefillInput(essayParam);
    flash(
      questionnaireParam || essayParam
        ? 'Привязка сохранена — проверьте в предпросмотре, что код подставился'
        : 'Привязка выключена',
    );
    setSavingField(null);
  };

  const handleUnpublish = async (field: Stage1Field) => {
    if (!user) return;
    setSavingField(field);
    setError('');
    setSuccess('');

    const patch =
      field === 'questionnaire'
        ? { questionnaire_published: false }
        : { essay_published: false };

    const { error: saveError } = await saveSelectionConfig(patch, user.id);

    if (saveError) {
      setError('Не удалось снять с публикации.');
      setSavingField(null);
      return;
    }

    if (field === 'questionnaire') {
      setQuestionnairePublished(false);
      flash('Анкета снята с публикации — ученики видят заглушку');
    } else {
      setEssayPublished(false);
      flash('Форма эссе снята с публикации — ученики видят заглушку');
    }

    setSavingField(null);
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
          «Сохранить» — черновик и предпросмотр. «Опубликовать» — форма появится у учеников на этапе 1.
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
            questionnairePublished
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
              : 'text-slate-400 bg-white/5 border-white/10'
          }`}>
            {questionnairePublished ? <CheckCircle className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
            {questionnairePublished ? 'Опубликовано' : 'Черновик'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSaveLink('questionnaire')}
            disabled={savingField === 'questionnaire'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingField === 'questionnaire' ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => handlePublish('questionnaire')}
            disabled={savingField === 'questionnaire'}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Опубликовать
          </button>
          {questionnairePublished && (
            <button
              type="button"
              onClick={() => handleUnpublish('questionnaire')}
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
            essayPublished
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
              : 'text-slate-400 bg-white/5 border-white/10'
          }`}>
            {essayPublished ? <CheckCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            {essayPublished ? 'Опубликовано' : 'Черновик'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSaveLink('essay')}
            disabled={savingField === 'essay'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingField === 'essay' ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => handlePublish('essay')}
            disabled={savingField === 'essay'}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Опубликовать
          </button>
          {essayPublished && (
            <button
              type="button"
              onClick={() => handleUnpublish('essay')}
              disabled={savingField === 'essay'}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
            >
              Снять с публикации
            </button>
          )}
        </div>
      </section>

      <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-white">Привязка ответов к аккаунту</h3>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Заведите в форме короткий вопрос «код участника», откройте
          «Поделиться → ссылка с предзаполненными ответами» и вставьте её сюда.
          Сайт подставит в этот вопрос код аккаунта, и ответы больше не придётся
          сопоставлять руками. Пустое поле — ничего не подставляем.
        </p>
        <label className="block">
          <span className="text-sm font-medium text-slate-300 mb-2 block">Анкета</span>
          <input
            value={questionnairePrefillInput}
            onChange={(e) => setQuestionnairePrefillInput(e.target.value)}
            placeholder={YANDEX_PREFILL_INPUT_PLACEHOLDER}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-300 mb-2 block">Эссе</span>
          <input
            value={essayPrefillInput}
            onChange={(e) => setEssayPrefillInput(e.target.value)}
            placeholder={YANDEX_PREFILL_INPUT_PLACEHOLDER}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </label>
        <button
          type="button"
          onClick={() => { void handleSavePrefill(); }}
          disabled={savingField === 'prefill'}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {savingField === 'prefill' ? 'Сохранение...' : 'Сохранить привязку'}
        </button>
      </section>

      <div className="space-y-6">
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8">
          <h3 className="font-semibold text-white mb-5">Предпросмотр: анкета</h3>
          {questionnairePreview ? (
            <YandexFormEmbed
              formId={savedQuestionnaireId}
              prefill={{ param: savedQuestionnairePrefill, value: user?.id ?? '' }}
            />
          ) : (
            <StageComingSoon stage="questionnaire" studentPreview />
          )}
        </div>
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8">
          <h3 className="font-semibold text-white mb-5">Предпросмотр: эссе</h3>
          {essayPreview ? (
            <YandexFormEmbed
              formId={savedEssayId}
              prefill={{ param: savedEssayPrefill, value: user?.id ?? '' }}
            />
          ) : (
            <StageComingSoon stage="essay" studentPreview />
          )}
        </div>
      </div>
    </div>
  );
}
