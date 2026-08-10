/** Лимиты полей карточки преподавателя на главной (совпадают с подсказками в админке). */
export const INSTRUCTOR_FIELD_LIMITS = {
  name: 50,
  title: 80,
  bio: 400,
  imageUrl: 500,
} as const;

export const COMMUNITY_FIELD_LIMITS = {
  telegramUrl: 300,
  telegramMessage: 500,
} as const;

/** Примерно столько символов в описании — на сайте появляется «Читать далее». */
export const INSTRUCTOR_BIO_EXPAND_HINT = 120;

export function clampInstructorField(field: keyof typeof INSTRUCTOR_FIELD_LIMITS, value: string) {
  return value.slice(0, INSTRUCTOR_FIELD_LIMITS[field]);
}

/** Карточка готова к показу на главной (имя, должность, фото обязательны). */
export function isInstructorPublishable(fields: {
  name: string;
  title: string;
  image_url: string;
}) {
  return Boolean(fields.name.trim() && fields.title.trim() && fields.image_url.trim());
}
