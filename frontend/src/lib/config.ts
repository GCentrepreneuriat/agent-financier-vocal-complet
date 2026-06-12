// URLs du backend.
// - En développement (Vite sur 5173), on vise le backend local sur 3001.
// - En production (app servie par le backend), on vise la même origine.
// Surchargeable via VITE_BACKEND_HTTP / VITE_BACKEND_WS si besoin.

const memeOrigineHttp = typeof window !== "undefined" ? window.location.origin : "";
const memeOrigineWs =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "";

export const BACKEND_HTTP =
  import.meta.env.VITE_BACKEND_HTTP ||
  (import.meta.env.DEV ? "http://localhost:3001" : memeOrigineHttp);

export const BACKEND_WS =
  import.meta.env.VITE_BACKEND_WS ||
  (import.meta.env.DEV ? "ws://localhost:3001" : memeOrigineWs);
