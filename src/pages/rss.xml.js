import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('notes', (e) => e.data.published !== false))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'Ayo Omole — notes',
    description: 'Notes, essays, and working thoughts from Ayo Omole.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/notes/${post.data.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
