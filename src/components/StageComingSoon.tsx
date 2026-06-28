import BlockPlaceholder from './BlockPlaceholder';

type Stage = 'essay' | 'contest';

export default function StageComingSoon({ stage, minHeight = 420 }: { stage: Stage; minHeight?: number }) {
  return (
    <BlockPlaceholder
      variant={stage === 'essay' ? 'yandex_form' : 'contest'}
      minHeight={minHeight}
    />
  );
}
