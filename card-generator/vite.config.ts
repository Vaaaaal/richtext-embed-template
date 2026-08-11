import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Sortie dans public/ : c'est le publicDir déclaré dans webflow.json, servi
// par `webflow extension serve` et empaqueté par `webflow extension bundle`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  // On réutilise "public" comme dossier de *sortie* du build (c'est le
  // publicDir attendu par webflow.json) : on désactive le publicDir natif de
  // Vite (dossier d'assets copiés tels quels), qui porterait le même nom.
  publicDir: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "public",
    emptyOutDir: true,
  },
});
