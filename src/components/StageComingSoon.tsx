import BlockPlaceholder from './BlockPlaceholder';

type Stage = 'essay' | 'contest' | 'questionnaire';

export default function StageComingSoon({ stage, minHeight = 420 }: { stage: Stage; minHeight?: number }) {
  const variant = stage === 'contest' ? 'contest' : stage === 'questionnaire' ? 'questionnaire' : 'yandex_form';
  return (
    <BlockPlaceholder
      variant={variant}
      minHeight={minHeight}
    />
  );
}
