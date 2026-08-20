import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: {
      INITIAL_SETUP_KEY: "test-setup-key-with-sufficient-length",
      NATIONAL_ID_ENCRYPTION_KEY: "test-encryption-key-with-at-least-32-characters-length",
    },
    include: ["server/**/*.test.{ts,tsx}", "server/**/*.spec.{ts,tsx}", "client/**/*.test.{ts,tsx}", "client/**/*.spec.{ts,tsx}"],
  },
});
