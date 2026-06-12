// Lance le backend et le frontend ensemble, sans dependance externe.
// Usage : npm run dev
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const services = [
  { nom: "backend", couleur: "\x1b[34m", args: ["--prefix", "backend", "run", "dev"] },
  { nom: "frontend", couleur: "\x1b[32m", args: ["--prefix", "frontend", "run", "dev"] },
];

const reset = "\x1b[0m";
const procs = [];

function prefixer(nom, couleur, flux) {
  let reste = "";
  flux.on("data", (chunk) => {
    reste += chunk.toString();
    const lignes = reste.split("\n");
    reste = lignes.pop() || "";
    for (const ligne of lignes) {
      process.stdout.write(`${couleur}[${nom}]${reset} ${ligne}\n`);
    }
  });
}

for (const s of services) {
  const p = spawn(npm, s.args, { shell: process.platform === "win32" });
  prefixer(s.nom, s.couleur, p.stdout);
  prefixer(s.nom, s.couleur, p.stderr);
  p.on("exit", (code) => {
    process.stdout.write(`${s.couleur}[${s.nom}]${reset} arrete (code ${code})\n`);
    arreterTout();
  });
  procs.push(p);
}

function arreterTout() {
  for (const p of procs) {
    try {
      p.kill();
    } catch (_) {}
  }
  process.exit(0);
}

process.on("SIGINT", arreterTout);
process.on("SIGTERM", arreterTout);

console.log("Backend -> http://localhost:3001   |   Frontend -> http://localhost:5173");
console.log("(Ctrl + C pour tout arreter)\n");
