import { normalizeHomeworkMarkdown } from '../src/lib/homeworkPageUtils.ts';

// Exact strings from Supabase (literal \n in DB)
const dbSamples = [
  '## Задача 1\\n\\nОпишите состояние $|+\\rangle$.\\n\\n## Задача 2\\n\\nВычислите $H|0\\rangle$.',
  'Постройте схему для $|+\\rangle$ с помощью $H$. Опишите действие CNOT.',
  '## Срочно\\n\\nПовторите определение кубита и запишите матрицу Паули $\\sigma_x$.',
];

for (const s of dbSamples) {
  console.log('--- DB INPUT ---');
  console.log(JSON.stringify(s));
  const out = normalizeHomeworkMarkdown(s);
  console.log('--- NORMALIZED ---');
  console.log(JSON.stringify(out));
  console.log('--- RENDER ---');
  console.log(out);
  console.log('');
}
