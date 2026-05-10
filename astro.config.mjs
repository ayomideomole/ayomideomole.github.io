import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ayoomole.xyz',
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  image: { responsiveStyles: true },
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
