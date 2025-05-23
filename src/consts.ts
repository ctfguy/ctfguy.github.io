import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: "ctfguy's blog",
  description:
    'Hi, Welcome to my Personal Blog.',
  href: 'https://ctfguy.github.io/',
  author: 'ctfguy',
  locale: 'en-US',
  featuredPostCount: 2,
  postsPerPage: 3,
}

export const NAV_LINKS: SocialLink[] = [
  { href: '/blog', label: 'blog' },
  { href: '/about', label: 'about' },
  { href: '/tags', label: 'tags' },
]

export const SOCIAL_LINKS: SocialLink[] = [
  { href: 'https://github.com/ctfguy', label: 'GitHub' },
  { href: 'https://x.com/iitz_ctfguy', label: 'Twitter' },
  { href: 'iitzctfguy@outlook.com', label: 'Email' },
  { href: '/rss.xml', label: 'RSS' },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}
