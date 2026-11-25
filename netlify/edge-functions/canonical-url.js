// One public address per page: /cet-landing, never /cet-landing.html.
// Runs on the raw request path (netlify.toml redirects are matched after Netlify
// normalises paths, which can loop), so a target never matches this function again.

const RENAMED = {
  cutoff_checker: 'college_explorer',
  college_explorer_2026: 'college_explorer',
  mht_cet_college_predictor_2026: 'mht_cet_college_predictor',
  percentile_vs_college_predictor_2026: 'percentile_vs_college_predictor',
  'engineering-psychometric-test': 'branch',
};

// Returns the new path, or null when the path is already canonical.
export function canonicalPath(pathname) {
  let path = pathname;
  if (/\.html$/i.test(path)) path = path.slice(0, -5).toLowerCase();
  if (path === '/index' || path.endsWith('/index')) path = path.slice(0, -'index'.length);
  const renamed = RENAMED[path.slice(1).toLowerCase()];
  if (renamed) path = '/' + renamed;
  return path === pathname ? null : path;
}

export default function handler(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  const url = new URL(request.url);
  const target = canonicalPath(url.pathname);
  if (!target) return undefined;
  return new Response(null, { status: 301, headers: { Location: target + url.search } });
}

export const config = {
  path: [
    '/*.html', '/*/*.html', '/index', '/*/index',
    '/cutoff_checker', '/college_explorer_2026', '/mht_cet_college_predictor_2026',
    '/percentile_vs_college_predictor_2026', '/engineering-psychometric-test',
  ],
};
