// Estas rutas pertenecen al servidor, incluso cuando se abren como una página.
// En especial, OAuth debe mostrar su formulario real y nunca el mapa precargado.
export const SERVER_NAVIGATION = [
  /^\/api(?:\/|$)/,
  /^\/mcp(?:\/|$)/,
  /^\/\.well-known\//,
  /^\/(?:authorize|token|register|revoke)(?:\/|\?|$)/,
  /^\/(?:data|map)(?:\/|$)/,
];
