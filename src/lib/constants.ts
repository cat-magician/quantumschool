export const YANDEX_FORMS = {
  application: '6a34612384227c46fdf4dea3',
  essay: '6a34617d02848f51a4bf3c52',
} as const;

/** Встраивание формы; высоту iframe подгоняет YandexFormEmbed, без embed.js. */
export const YANDEX_FORM_EMBED = {
  /** Как в коде из «Поделиться → iframe» */
  width: 650,
} as const;

export {
  yandexFormIframeName,
  yandexFormIframeSrc,
  yandexFormPublicUrl as yandexFormUrl,
} from './selectionConfig';

/** Вставьте URL контеста этапа 2, когда он будет готов (iframe на странице отбора) */
export const YANDEX_CONTEST = {
  selectionStage2Url: '',
} as const;
