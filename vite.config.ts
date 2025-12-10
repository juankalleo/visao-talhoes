import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001'),
    __STAC_URL__: JSON.stringify(process.env.VITE_STAC_API_URL || 'https://stac.dataspace.copernicus.eu/api/v1'),
    __COPERNICUS_BASE_URL__: JSON.stringify(process.env.VITE_COPERNICUS_BASE_URL || 'https://catalogue.dataspace.copernicus.eu'),
  },
}));
