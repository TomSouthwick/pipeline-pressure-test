# Google Search Console setup

After deploying with favicon, sitemap, and `NEXT_PUBLIC_SITE_URL`:

1. Confirm `https://pipelinepressuretest.com` resolves (Vercel custom domain + DNS).
2. Open [Google Search Console](https://search.google.com/search-console).
3. Add property: **URL prefix** → `https://pipelinepressuretest.com`
4. Verify ownership (recommended: **DNS TXT record** on the domain registrar).
5. Submit sitemap: `https://pipelinepressuretest.com/sitemap.xml`
6. Use **URL Inspection** on the homepage → **Request indexing** (once).
7. Check indexing later with `site:pipelinepressuretest.com` in Google Search.

Indexing typically takes days to a few weeks. Favicon in search results may appear later than the page itself.
