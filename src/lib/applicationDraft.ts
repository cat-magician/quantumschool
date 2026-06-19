const STORAGE_KEY = 'qc_application_suggestions';
const MAX_PER_FIELD = 8;

type SuggestionField = 'name' | 'email' | 'phone' | 'city' | 'school' | 'grade' | 'message';

export interface ApplicationSuggestions {
  name: string[];
  email: string[];
  phone: string[];
  city: string[];
  school: string[];
  grade: string[];
  message: string[];
}

const EMPTY_SUGGESTIONS: ApplicationSuggestions = {
  name: [],
  email: [],
  phone: [],
  city: [],
  school: [],
  grade: [],
  message: [],
};

function loadSuggestions(): ApplicationSuggestions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SUGGESTIONS;
    const parsed = JSON.parse(raw) as Partial<ApplicationSuggestions>;
    return {
      name: parsed.name ?? [],
      email: parsed.email ?? [],
      phone: parsed.phone ?? [],
      city: parsed.city ?? [],
      school: parsed.school ?? [],
      grade: parsed.grade ?? [],
      message: parsed.message ?? [],
    };
  } catch {
    return EMPTY_SUGGESTIONS;
  }
}

export function getApplicationSuggestions(): ApplicationSuggestions {
  return loadSuggestions();
}

export function rememberApplicationValues(values: Partial<Record<SuggestionField, string>>) {
  const current = loadSuggestions();
  const next: ApplicationSuggestions = { ...current };

  (Object.keys(values) as SuggestionField[]).forEach((field) => {
    const value = values[field]?.trim();
    if (!value) return;
    next[field] = [value, ...next[field].filter((item) => item !== value)].slice(0, MAX_PER_FIELD);
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode errors
  }
}
