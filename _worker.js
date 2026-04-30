// Worker entry point. Handles requests routed to the ratehero-pricer Worker.
// When traffic comes via the goratehero.com/rates* route, strip the /rates
// prefix so the static asset handler can find files in ui/.
// When traffic comes via the .workers.dev URL (no prefix), pass through.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/rates' || url.pathname === '/rates/') {
      url.pathname = '/';
    } else if (url.pathname.startsWith('/rates/')) {
      url.pathname = url.pathname.replace(/^\/rates\//, '/');
    }

    return env.ASSETS.fetch(new Request(url, request));
  }
};