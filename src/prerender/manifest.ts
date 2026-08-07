import {
  SUPPORTED_LOCALES,
  buildPublicFeaturesPath,
  buildPublicHomePath,
  type Locale,
} from '@/constants/routes';

export interface PrerenderManifestEntry {
  path: string;
  outFile: string;
  locale: Locale;
}

export function buildPrerenderManifest(): PrerenderManifestEntry[] {
  return SUPPORTED_LOCALES.flatMap((locale) => [
    { path: buildPublicHomePath(locale), outFile: `${locale}/index.html`, locale },
    {
      path: buildPublicFeaturesPath(locale),
      outFile: `${locale}/features/index.html`,
      locale,
    },
  ]);
}

export const PRERENDER_MANIFEST = buildPrerenderManifest();
