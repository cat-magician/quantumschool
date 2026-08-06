import type { ComponentPropsWithoutRef } from 'react';
import { markStudentLoginCorridor } from '../lib/loginCorridor';
import { appHref } from '../lib/appPaths';

type Props = ComponentPropsWithoutRef<'a'>;

/** Ссылка в ученический кабинет — помечает вход через коридор школьника. */
export default function StudentCabinetLink({ onClick, href = appHref('/dashboard'), ...props }: Props) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        markStudentLoginCorridor();
        onClick?.(event);
      }}
    />
  );
}
