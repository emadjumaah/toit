import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "editor.html"),
        convert: resolve(__dirname, "convert.html"),
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
