import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// WCAG relative-luminance contrast ratio.
const hexToLin = (hex: string) => {
  const h = hex.replace('#', '').trim();
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) throw new Error(`Invalid hex: ${hex}`);
  const c = [0, 2, 4].map((i) => {
    const ch = parseInt(v.slice(i, i + 2), 16) / 255;
    return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [la, lb] = [hexToLin(a), hexToLin(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be #rgb or #rrggbb');
const paletteSchema = z
  .object({ bg: hex, fg: hex, accent: hex })
  .superRefine((p, ctx) => {
    const fgBg = contrast(p.fg, p.bg);
    if (fgBg < 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `palette.fg/bg contrast ${fgBg.toFixed(2)}:1 — needs ≥7:1 (AAA body)`,
      });
    }
    const accBg = contrast(p.accent, p.bg);
    if (accBg < 4.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `palette.accent/bg contrast ${accBg.toFixed(2)}:1 — needs ≥4.5:1 (AA links)`,
      });
    }
  });

const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/work' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    slug: z.string(),
    company: z.string(),
    year: z.number(),
    role: z.string(),
    team: z.string().optional(),
    duration: z.string().optional(),
    summary: z.string(),
    cover: image().optional(),
    tags: z.array(z.string()).default([]),
    published: z.boolean().default(true),
    featured: z.boolean().default(true),
    order: z.number().default(99),
    confidential: z.boolean().default(false),
    palette: paletteSchema.optional(),
    /* Card display fields — humaan "What's New" pattern */
    category: z.enum(['AI', 'Fintech', 'Enterprise', 'Mobile', 'Research', 'Platform', 'Tools']).optional(),
    cardLede: z.string().optional(),
    /* Case study image collage — array of images that render as the hero gallery */
    gallery: z.array(image()).optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/notes' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    slug: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    canonicalUrl: z.string().url().optional(),
    substackId: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/research' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    slug: z.string(),
    year: z.number(),
    summary: z.string(),
    status: z.enum(['ongoing', 'complete', 'paused']).default('ongoing'),
    topic: z.string().optional(),
    cover: image().optional(),
    tags: z.array(z.string()).default([]),
    published: z.boolean().default(true),
    order: z.number().default(99),
    /* External link (ACM, PDF, etc.) — overrides internal /research/[slug] when set */
    externalUrl: z.string().url().optional(),
  }),
});

export const collections = { work, notes, research };
