/**
 * Edge redirect: bare "/" → "/bridge" before static assets run.
 * SPA + in-app Navigate still work; this fixes share/bookmark of root URL.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/" || path === "") {
      url.pathname = "/bridge";
      return Response.redirect(url.toString(), 308);
    }
    return env.ASSETS.fetch(request);
  },
};
