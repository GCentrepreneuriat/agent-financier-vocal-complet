// URLs du backend. Configurables via variables d'environnement Vite
// (VITE_BACKEND_HTTP / VITE_BACKEND_WS) ; valeurs par defaut en dev local.
export const BACKEND_HTTP =
  import.meta.env.VITE_BACKEND_HTTP || "http://localhost:3001";

export const BACKEND_WS =
  import.meta.env.VITE_BACKEND_WS || "ws://localhost:3001";
