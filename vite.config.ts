import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        "it-to-web": "it-to-web.html",
      },
      output: {
        manualChunks: {
          "monaco-editor": ["monaco-editor"],
        },
      },
    },
    chunkSizeWarningLimit: 5000,
  },
});
