const HTML_CONTENT_TYPE = 'text/html'

function isSpaRoute(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false
  }

  const { pathname } = new URL(request.url)
  const lastSegment = pathname.split('/').at(-1) ?? ''
  return !lastSegment.includes('.')
}

async function fetchAsset(request, env) {
  let response = await env.ASSETS.fetch(request)

  if (response.status === 404 && isSpaRoute(request)) {
    const fallbackUrl = new URL(request.url)
    fallbackUrl.pathname = '/index.html'
    response = await env.ASSETS.fetch(new Request(fallbackUrl, request))
  }

  return response
}

function withAbsoluteSocialImageUrls(response, request) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  if (
    request.method === 'HEAD' ||
    !response.body ||
    !contentType.includes(HTML_CONTENT_TYPE)
  ) {
    return response
  }

  const absoluteImageUrl = new URL('/og.jpg', request.url).href
  const imageHandler = {
    element(element) {
      element.setAttribute('content', absoluteImageUrl)
    },
  }

  // Cloudflare's streaming rewriter keeps the asset response status and headers.
  return new HTMLRewriter()
    .on('meta[property="og:image"][content="/og.jpg"]', imageHandler)
    .on('meta[name="twitter:image"][content="/og.jpg"]', imageHandler)
    .transform(response)
}

export default {
  async fetch(request, env) {
    const response = await fetchAsset(request, env)
    return withAbsoluteSocialImageUrls(response, request)
  },
}
