/* eslint-disable react-refresh/only-export-components */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { PRERENDER_MANIFEST } from '@/prerender/manifest';

export { PRERENDER_MANIFEST };

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppRouter />
    </StaticRouter>,
  );
}
