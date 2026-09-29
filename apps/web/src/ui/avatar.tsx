// Name-seeded dicebear avatar (issue #387): Lorelei style via the dicebear
// HTTP API — seed = the displayName the surface shows, so the same name
// always renders the same face with nothing stored. avatarUrl 列语义: null =
// dicebear 生成(新默认), 非 null = 显式覆盖(src prop wins). Load failure
// (offline / API down) swaps back to the pre-#387 static asset via img
// onError — the box keeps its CSS-fixed size, no broken image.

import { useState } from 'react';

interface AvatarProps {
  /** Seed — the displayName shown next to the avatar; null/'' = render the
   *  fallback asset directly (e.g. create-dialog before a name is typed). */
  name?: string | null;
  /** Explicit avatarUrl override; wins over the dicebear URL when non-null. */
  src?: string | null;
  /** Pre-#387 static asset: initial render when name/src are absent, and the
   *  offline/load-failure fallback. */
  fallback: string;
}

export function Avatar({ name, src, fallback }: AvatarProps) {
  // falsy-safe: '' avatarUrl（空串覆盖）视同未设置，落回生成/兜底路径
  const resolved =
    src ||
    (name ? `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(name)}` : fallback);
  // one-shot swap, keyed by the failing URL: a name change re-rolls the
  // dicebear attempt, and an error on the fallback itself cannot loop
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === resolved;
  return (
    <img
      src={failed ? fallback : resolved}
      alt=""
      onError={() => {
        if (!failed) setFailedFor(resolved);
      }}
    />
  );
}
