export const YANDEX_FORMS = {
  application: '6a34612384227c46fdf4dea3',
  essay: '6a34617d02848f51a4bf3c52',
} as const;

/** Официальное встраивание: embed.js сам подстраивает высоту iframe */
export const YANDEX_FORM_EMBED = {
  scriptUrl: 'https://forms.yandex.ru/_static/embed.js',
  /** Как в коде из «Поделиться → iframe» */
  width: 650,
} as const;

export function yandexFormUrl(formId: string) {
  return `https://forms.yandex.ru/u/${formId}/`;
}

export function yandexFormIframeSrc(formId: string) {
  return `https://forms.yandex.ru/u/${formId}?iframe=1`;
}

export function yandexFormIframeName(formId: string) {
  return `ya-form-${formId}`;
}

/** Вставьте URL контеста этапа 2, когда он будет готов (iframe на странице отбора) */
export const YANDEX_CONTEST = {
  selectionStage2Url: '',
} as const;
