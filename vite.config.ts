import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';

// Pin a date supported by the local Cloudflare Workers runtime. Without this,
// Nitro uses the current date, which can be ahead of Wrangler's support window.
process.env["NITRO_COMPATIBILITY_DATE"] ??= "2025-07-13";

export default defineConfig({
  plugins: [
    ...tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
});
