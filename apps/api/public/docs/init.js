// Swagger UI initializer for /docs. Kept as a static file rather than an inline script so the page's
// Content-Security-Policy can forbid inline scripts.
window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    // A copy of the spec that lists the serving host first, so "Try it out" works locally.
    url: '/docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    requestSnippetsEnabled: true,
    // Never send the spec to the public validator service.
    validatorUrl: null,
    presets: [SwaggerUIBundle.presets.apis],
  });
});
