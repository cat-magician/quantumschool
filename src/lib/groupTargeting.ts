import type { Group } from './types';

/**
 * Адресаты события, лекции или ДЗ — список групп. Пустой список значит «все
 * зачисленные». Ту же проверку делает база в политиках (group_ids &&
 * my_group_ids), здесь — для экранов сотрудников, которые видят всё и сами
 * отбирают, что относится к ученику.
 */
export function visibleToGroup(
  groupIds: readonly string[] | null | undefined,
  studentGroupId: string | null | undefined,
): boolean {
  if (!groupIds || groupIds.length === 0) return true;
  return studentGroupId != null && groupIds.includes(studentGroupId);
}

/**
 * Подпись адресатов. Неизвестные группы — чужие (преподаватель видит только
 * свои) или удалённые; их не называем, только считаем.
 */
export function groupTargetLabel(
  groupIds: readonly string[] | null | undefined,
  groups: readonly Pick<Group, 'id' | 'name'>[],
): string {
  if (!groupIds || groupIds.length === 0) return 'Все зачисленные';
  const names = groupIds
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const unknown = groupIds.length - names.length;
  if (names.length === 0) return unknown === 1 ? 'Другая группа' : 'Другие группы';
  return unknown > 0 ? `${names.join(', ')} и ещё ${unknown}` : names.join(', ');
}

/** group_id для вкладок старой версии: единственная группа или null. */
export function legacyGroupId(groupIds: readonly string[]): string | null {
  return groupIds.length === 1 ? groupIds[0] : null;
}
