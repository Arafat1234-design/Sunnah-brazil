import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, ChevronDown, CircleUserRound,
  Download, FileText, Film, Headphones, Heart, Info, LayoutGrid, LibraryBig, Menu,
  Play, Plus, Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  Trash2, UploadCloud, X, Youtube,
} from 'lucide-react';
import {
  getGetAdminStatsQueryKey, getGetBookDownloadQueryKey, getGetBookQueryKey,
  getGetLibrarySummaryQueryKey, getGetVideoDownloadQueryKey, getGetVideoQueryKey,
  getListBooksQueryKey, getListCategoriesQueryKey, getListVideosQueryKey,
  type Book, type BookInput, type Category, type Video, type VideoInput,
  useCreateBook, useCreateVideo, useDeleteBook, useDeleteVideo, useGetAdminStats,
  useGetBook, useGetBookDownload, useGetLibrarySummary, useGetVideo,
  useGetVideoDownload, useListBooks, useListCategories, useListVideos,
  useRequestUploadUrl, useUpdateBook, useUpdateVideo,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient();
const teal = 'text-[hsl(var(--primary))]';
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(174 37% 31%)',
    colorForeground: 'hsl(193 25% 19%)',
    colorMutedForeground: 'hsl(190 12% 44%)',
    colorDanger: 'hsl(10 57% 47%)',
    colorBackground: 'hsl(38 42% 97%)',
    colorInput: 'hsl(38 42% 97%)',
    colorInputForeground: 'hsl(193 25% 19%)',
    colorNeutral: 'hsl(38 18% 82%)',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-[#19383b]',
    headerSubtitle: 'text-[#607274]',
    socialButtonsBlockButtonText: 'text-[#19383b]',
    formFieldLabel: 'text-[#19383b]',
    footerActionLink: 'text-[#23645f]',
    footerActionText: 'text-[#607274]',
    dividerText: 'text-[#607274]',
    identityPreviewEditButton: 'text-[#23645f]',
    formFieldSuccessText: 'text-[#23645f]',
    alertText: 'text-[#8f342b]',
    logoBox: 'h-10',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'border-[#d8d0c2] bg-[#fffdf8]',
    formButtonPrimary: 'bg-[#23645f] hover:bg-[#19383b]',
    formFieldInput: 'border-[#d8d0c2] bg-[#fffdf8] text-[#19383b]',
    footerAction: 'border-[#d8d0c2]',
    dividerLine: 'bg-[#d8d0c2]',
    alert: 'border-[#e7b8b0] bg-[#fff3ef]',
    otpCodeFieldInput: 'border-[#d8d0c2] bg-[#fffdf8] text-[#19383b]',
    formFieldRow: 'text-[#19383b]',
    main: 'bg-transparent',
  },
};

function Button({ children, onClick, href, variant = 'primary', className = '', disabled = false, type = 'button' }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
  className?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110',
    soft: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--border))]',
    ghost: 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
    outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
    danger: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:brightness-110',
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;
  return href ? <Link href={href} className={cls} data-testid={`link-${href.replace(/\//g, '').replace(':', '-')}`}>{children}</Link> :
    <button type={type} onClick={onClick} disabled={disabled} className={cls} data-testid="button-action">{children}</button>;
}

function Logo() {
  return <Link href="/" className="flex items-center gap-3" data-testid="link-home">
    <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"><LibraryBig size={19} /></span>
    <span className="serif text-[23px] font-semibold tracking-[-.03em]">OpenShelf</span>
  </Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const items = [['Books', '/books'], ['Videos', '/videos'], ['Categories', '/categories'], ['About', '/about']];
  return <header className="sticky top-0 z-30 border-b border-[hsl(var(--border)/.85)] bg-[hsl(var(--background)/.92)] backdrop-blur-md">
    <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
      <Logo />
      <nav className="hidden items-center gap-1 md:flex">{items.map(([label, href]) =>
        <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`rounded-full px-4 py-2 text-sm transition-colors ${location === href ? 'bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>{label}</Link>)}</nav>
      <div className="hidden items-center gap-2 md:flex"><Button href="/contact" variant="ghost">Suggest a title</Button><Button href="/admin/login" variant="outline">Admin <ArrowRight size={15} /></Button></div>
      <button onClick={() => setOpen(!open)} className="rounded-full p-2 md:hidden" data-testid="button-mobile-menu">{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <div className="border-t border-[hsl(var(--border))] px-5 pb-5 pt-3 md:hidden">{items.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href} className="block border-b border-[hsl(var(--border)/.55)] py-3 text-sm" data-testid={`link-mobile-${label.toLowerCase()}`}>{label}</Link>)}<Button href="/contact" className="mt-4 w-full">Suggest a title</Button></div>}
  </header>;
}

function Footer() {
  return <footer className="mt-24 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]">
    <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
      <div><Logo /><p className="mt-4 max-w-[250px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">A small, careful library for books and films worth returning to.</p></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Explore</p><div className="grid gap-2 text-sm"><Link href="/books" data-testid="link-footer-books">Books</Link><Link href="/videos" data-testid="link-footer-videos">Videos</Link><Link href="/categories" data-testid="link-footer-categories">Categories</Link></div></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">OpenShelf</p><div className="grid gap-2 text-sm"><Link href="/about" data-testid="link-footer-about">Our principles</Link><Link href="/contact" data-testid="link-footer-contact">Contact & reports</Link><Link href="/terms" data-testid="link-footer-terms">Terms</Link></div></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">A quiet note</p><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">No algorithmic feed. No noisy ads. Just a useful shelf.</p></div>
    </div><div className="mx-auto max-w-[1240px] border-t border-[hsl(var(--border))] px-5 py-5 text-xs text-[hsl(var(--muted-foreground))] lg:px-8">© 2024 OpenShelf · Legally available materials only</div>
  </footer>;
}

function Shell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return admin ? <div className="min-h-[100dvh] bg-[hsl(var(--background))]">{children}</div> : <div className="site-grain min-h-[100dvh]"><Header />{children}<Footer /></div>;
}

function LoadingGrid({ kind = 'book' }: { kind?: 'book' | 'video' }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{[1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse" data-testid={`skeleton-${kind}-${i}`}><div className={`skeleton aspect-[3/4] rounded-[14px] ${kind === 'video' ? 'aspect-video' : ''}`} /><div className="skeleton mt-3 h-4 w-4/5 rounded" /><div className="skeleton mt-2 h-3 w-2/5 rounded" /></div>)}</div>;
}

function StateMessage({ error = false, title, body, retry }: { error?: boolean; title: string; body: string; retry?: () => void }) {
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-16 text-center" data-testid={error ? 'state-error' : 'state-empty'}><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-[hsl(var(--secondary))]">{error ? <Info size={19} /> : <BookOpen size={19} />}</div><h3 className="serif text-xl">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{body}</p>{retry && <Button onClick={retry} variant="outline" className="mt-5">Try again</Button>}</div>;
}

function Cover({ book, large = false }: { book: Book; large?: boolean }) {
  return <div className={`book-cover ${large ? 'aspect-[3/4] max-w-[280px] rounded-2xl' : 'aspect-[3/4] rounded-[14px]'} shadow-sm`}>
    {book.coverUrl ? <img src={book.coverUrl} alt={book.title} className="relative z-[1] h-full w-full object-cover" /> : <div className="relative z-[1] flex h-full flex-col justify-between p-5 text-[hsl(var(--primary-foreground))]"><span className="mono text-[10px] uppercase tracking-[.15em] opacity-75">OpenShelf edition</span><div><h3 className={`serif leading-[1.02] ${large ? 'text-3xl' : 'text-xl'}`}>{book.title}</h3><p className="mt-2 text-xs opacity-75">{book.author}</p></div></div>}
  </div>;
}

function VideoThumb({ video, large = false }: { video: Video; large?: boolean }) {
  return <div className={`relative overflow-hidden rounded-[14px] bg-[hsl(190_27%_22%)] ${large ? 'aspect-video' : 'aspect-video'}`}>{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_78%_18%,hsl(10_57%_62%/.8),transparent_32%),linear-gradient(135deg,hsl(190_27%_22%),hsl(174_37%_31%))] p-4 text-[hsl(var(--primary-foreground))]"><Youtube className="opacity-80" size={24} /><span className="serif text-xl leading-tight">{video.title}</span></div>}<span className="absolute bottom-3 right-3 rounded bg-[hsl(193_25%_19%/.78)] px-2 py-1 mono text-[10px] text-white">{video.duration}</span><span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[hsl(var(--accent))] text-white shadow-md transition-transform group-hover:scale-110"><Play size={17} fill="currentColor" /></span></div>;
}

function BookCard({ book }: { book: Book }) {
  return <Link href={`/books/${book.id}`} className="group block" data-testid={`card-book-${book.id}`}><Cover book={book} /><div className="px-1 pt-3"><p className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{book.category}</p><h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-[hsl(var(--primary))]">{book.title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{book.author}</p></div></Link>;
}

function VideoCard({ video }: { video: Video }) {
  return <Link href={`/videos/${video.id}`} className="group block" data-testid={`card-video-${video.id}`}><VideoThumb video={video} /><div className="px-1 pt-3"><p className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{video.category}</p><h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-[hsl(var(--primary))]">{video.title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{video.viewCount.toLocaleString()} views</p></div></Link>;
}

function SectionHeading({ eyebrow, title, href, action = 'See the shelf' }: { eyebrow: string; title: string; href?: string; action?: string }) {
  return <div className="mb-7 flex items-end justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{eyebrow}</p><h2 className="serif mt-2 text-3xl leading-none md:text-4xl">{title}</h2></div>{href && <Button href={href} variant="ghost" className="hidden sm:inline-flex">{action}<ArrowRight size={15} /></Button>}</div>;
}

function Home() {
  const { data, isLoading, isError, refetch } = useGetLibrarySummary();
  const summary = data;
  return <Shell><main>
    <section className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-20 pt-16 md:grid-cols-[1fr_1.05fr] md:items-center md:pb-28 md:pt-24 lg:px-8">
      <div className="rise-in"><p className="mono mb-5 text-[10px] uppercase tracking-[.24em] text-[hsl(var(--accent))]">A public digital library</p><h1 className="serif max-w-[610px] text-[clamp(3.5rem,7vw,6.5rem)] leading-[.92] tracking-[-.055em]">Good things<br /><em>stay with you.</em></h1><p className="mt-7 max-w-[470px] text-lg leading-8 text-[hsl(var(--muted-foreground))]">OpenShelf is a trusted place to find legally available books, independent films, and the ideas that reward your attention.</p><div className="mt-8 flex flex-wrap gap-3"><Button href="/books">Browse the collection <ArrowRight size={16} /></Button><Button href="/about" variant="outline">How it works</Button></div></div>
      <div className="rise-in delay-2 relative mx-auto w-full max-w-[520px]"><div className="absolute -right-3 -top-6 h-32 w-32 rounded-full bg-[hsl(var(--accent)/.18)] blur-2xl" /><div className="relative grid grid-cols-[.78fr_1fr] items-end gap-3"><div className="rotate-[-6deg]"><Cover large book={{ id: 0, title: 'The Quiet Architecture of Attention', author: 'Mira Sol', description: '', category: 'Essays', coverUrl: null, fileUrl: null, fileType: 'PDF', fileSize: 0, createdAt: '', downloadCount: 0 }} /></div><div className="rotate-[4deg] pt-14"><div className="overflow-hidden rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-lg"><div className="flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[.15em] opacity-75">Now showing</span><Film size={17} /></div><div className="mt-24"><p className="serif text-3xl leading-none">The long way<br />home</p><p className="mt-3 text-xs opacity-70">A film by Jun Park · 38 min</p></div></div></div></div><div className="absolute -bottom-5 left-1/3 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-xs shadow-sm"><Sparkles className="mr-2 inline text-[hsl(var(--accent))]" size={13} /> Curated, not crowded</div></div>
    </section>
    <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.38)]"><div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4 lg:px-8"><div><span className="serif text-3xl">{summary?.bookCount ?? '—'}</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">books to browse</p></div><div><span className="serif text-3xl">{summary?.videoCount ?? '—'}</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">films and talks</p></div><div><span className="serif text-3xl">04</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">ways to wander</p></div><div><span className="serif text-3xl">01</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">open invitation</p></div></div></section>
    <section className="mx-auto max-w-[1240px] px-5 pt-20 lg:px-8">{isLoading ? <LoadingGrid /> : isError ? <StateMessage error title="The shelf is taking a moment" body="We couldn't reach the library just now." retry={refetch} /> : <><SectionHeading eyebrow="The short list" title="Worth your next hour" href="/books" /><div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{(summary?.featuredBooks ?? []).slice(0, 5).map(book => <BookCard key={book.id} book={book} />)}</div></>}</section>
    <section className="mx-auto max-w-[1240px] px-5 pt-20 lg:px-8">{isLoading ? <LoadingGrid kind="video" /> : <><SectionHeading eyebrow="Watch closely" title="Films with something to say" href="/videos" action="View all films" /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{(summary?.featuredVideos ?? []).slice(0, 3).map(video => <VideoCard key={video.id} video={video} />)}</div></>}</section>
    <section className="mx-5 mt-24 overflow-hidden rounded-3xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] md:mx-auto md:max-w-[1240px]"><div className="grid items-center md:grid-cols-[1.2fr_1fr]"><div className="p-8 md:p-14"><p className="mono text-[10px] uppercase tracking-[.22em] opacity-65">The OpenShelf promise</p><h2 className="serif mt-4 text-4xl leading-tight md:text-5xl">A library should feel like a place, not a database.</h2><p className="mt-5 max-w-lg text-sm leading-7 opacity-75">We keep the collection human-sized, the provenance clear, and the door open. Everything here is shared with permission or belongs in the public domain.</p><Button href="/content-policy" variant="soft" className="mt-7">Read our content policy <ArrowRight size={15} /></Button></div><div className="hidden h-full min-h-[310px] bg-[radial-gradient(circle_at_40%_45%,hsl(10_57%_62%/.9),transparent_20%),radial-gradient(circle_at_70%_65%,hsl(38_42%_97%/.18),transparent_25%),linear-gradient(145deg,hsl(174_37%_31%),hsl(190_27%_16%))] md:block" /></div></section>
  </main></Shell>;
}

function SearchBar({ value, onChange, placeholder = 'Search the collection' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="relative w-full max-w-[440px]"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} data-testid="input-search" className="h-12 w-full rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-11 pr-4 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div>;
}

function LibraryToolbar({ kind, search, setSearch, category, setCategory, categories }: { kind: 'books' | 'videos'; search: string; setSearch: (v: string) => void; category: string; setCategory: (v: string) => void; categories: Category[] }) {
  return <div className="flex flex-col gap-3 border-y border-[hsl(var(--border))] py-4 sm:flex-row sm:items-center sm:justify-between"><SearchBar value={search} onChange={setSearch} placeholder={`Search ${kind}`} /><div className="flex items-center gap-2 overflow-x-auto"><SlidersHorizontal size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><button onClick={() => setCategory('')} className={`shrink-0 rounded-full px-3 py-2 text-xs ${!category ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]'}`} data-testid="button-filter-all">All</button>{categories.map(c => <button key={c.name} onClick={() => setCategory(c.name)} className={`shrink-0 rounded-full px-3 py-2 text-xs ${category === c.name ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]'}`} data-testid={`button-filter-${c.name.toLowerCase().replace(/\s/g, '-')}`}>{c.name}</button>)}</div></div>;
}

function Books() {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') ?? '');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category } : {}) }), [search, category]);
  const q = useListBooks(params); const cats = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><div className="mb-10 flex items-end justify-between gap-6"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">The book room</p><h1 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Books to get lost in.</h1><p className="mt-4 max-w-lg text-[hsl(var(--muted-foreground))]">Public-domain classics and contemporary work shared with care.</p></div><BookOpen className="hidden text-[hsl(var(--accent)/.6)] md:block" size={58} strokeWidth={1} /></div><LibraryToolbar kind="books" search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={cats.data ?? []} /><div className="mt-8">{q.isLoading ? <LoadingGrid /> : q.isError ? <StateMessage error title="The shelves are closed for a moment" body="Try again in a little while." retry={q.refetch} /> : !q.data?.length ? <StateMessage title="No title matches that search" body="Try another phrase or browse every category." /> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{q.data.map(book => <BookCard key={book.id} book={book} />)}</div>}</div></main></Shell>;
}

function Videos() {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') ?? '');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category } : {}) }), [search, category]);
  const q = useListVideos(params); const cats = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><div className="mb-10"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">The screening room</p><h1 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Watch with intent.</h1><p className="mt-4 max-w-lg text-[hsl(var(--muted-foreground))]">Independent films, patient conversations, and moving images with a point of view.</p></div><LibraryToolbar kind="videos" search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={cats.data ?? []} /><div className="mt-8">{q.isLoading ? <LoadingGrid kind="video" /> : q.isError ? <StateMessage error title="The screening room is quiet" body="Try again in a little while." retry={q.refetch} /> : !q.data?.length ? <StateMessage title="No film matches that search" body="Try another phrase or browse every category." /> : <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{q.data.map(video => <VideoCard key={video.id} video={video} />)}</div>}</div></main></Shell>;
}

function BookDetail() {
  const { id } = useParams<{ id: string }>(); const bookId = Number(id); const q = useGetBook(bookId); const [requested, setRequested] = useState(false); const dl = useGetBookDownload(bookId, { query: { enabled: requested, queryKey: getGetBookDownloadQueryKey(bookId) } });
  const book = q.data;
  const download = () => { setRequested(true); };
  if (q.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><LoadingGrid /></main></Shell>;
  if (q.isError || !book) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="This title isn't on the shelf" body="It may have moved, or the link may be old." /></main></Shell>;
  if (dl.data?.url) window.setTimeout(() => { window.location.href = dl.data!.url; }, 50);
  return <Shell><main className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 lg:px-8"><Link href="/books" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-books"><ArrowLeft size={15} /> Back to books</Link><div className="grid gap-10 py-12 md:grid-cols-[280px_1fr] md:gap-16"><Cover book={book} large /><div className="pt-2"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{book.category} · {book.fileType}</p><h1 className="serif mt-4 text-5xl leading-[.98] tracking-[-.04em] md:text-6xl">{book.title}</h1><p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">By {book.author}</p><p className="mt-8 max-w-xl text-[15px] leading-8 text-[hsl(var(--muted-foreground))]">{book.description}</p><div className="mt-8 flex flex-wrap items-center gap-3"><Button onClick={download} disabled={dl.isLoading}>{dl.isLoading ? 'Preparing file…' : <><Download size={16} /> Download {book.fileType}</>}</Button><Button variant="soft"><Heart size={16} /> Save for later</Button></div><div className="mt-8 flex gap-6 border-t border-[hsl(var(--border))] pt-5 text-xs text-[hsl(var(--muted-foreground))]"><span>{book.fileSize ? `${(book.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Digital file'}</span><span>{book.downloadCount.toLocaleString()} downloads</span></div></div></div></main></Shell>;
}

function VideoDetail() {
  const { id } = useParams<{ id: string }>(); const videoId = Number(id); const q = useGetVideo(videoId); const [requested, setRequested] = useState(false); const dl = useGetVideoDownload(videoId, { query: { enabled: requested, queryKey: getGetVideoDownloadQueryKey(videoId) } }); const video = q.data;
  if (q.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><LoadingGrid kind="video" /></main></Shell>;
  if (q.isError || !video) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="This film isn't available" body="It may have moved, or the link may be old." /></main></Shell>;
  if (dl.data?.url) window.setTimeout(() => { window.location.href = dl.data!.url; }, 50);
  return <Shell><main className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 lg:px-8"><Link href="/videos" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]" data-testid="link-back-videos"><ArrowLeft size={15} /> Back to videos</Link><div className="pt-10"><div className="relative overflow-hidden rounded-2xl bg-[hsl(190_27%_22%)]">{video.videoUrl ? <video src={video.videoUrl} controls poster={video.thumbnailUrl ?? undefined} className="aspect-video w-full" /> : <VideoThumb video={video} large />}</div><div className="grid gap-8 py-9 md:grid-cols-[1fr_260px]"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{video.category} · {video.duration}</p><h1 className="serif mt-3 text-4xl leading-tight md:text-5xl">{video.title}</h1><p className="mt-5 max-w-2xl text-[15px] leading-8 text-[hsl(var(--muted-foreground))]">{video.description}</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.6)] p-5"><p className="text-sm font-semibold">Keep watching</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Share this film with someone who likes a slower pace.</p><Button variant="outline" className="mt-5 w-full" onClick={() => setRequested(true)} disabled={!video.downloadEnabled || dl.isLoading}>{video.downloadEnabled ? <><Download size={15} /> Download</> : 'Download unavailable'}</Button></div></div></div></main></Shell>;
}

function Categories() {
  const q = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Ways in</p><h1 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Follow a thread.</h1><p className="mt-5 max-w-xl text-[hsl(var(--muted-foreground))]">Start with a subject, then see where it leads. Each shelf holds books and moving images together.</p><div className="mt-12">{q.isLoading ? <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(i => <div className="skeleton h-36 rounded-2xl" key={i} />)}</div> : q.isError ? <StateMessage error title="Categories are out of reach" body="Try again in a little while." retry={q.refetch} /> : <div className="grid gap-4 md:grid-cols-2">{(q.data ?? []).map((c, i) => <div key={c.name} className="hover-lift group flex items-end justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6" data-testid={`card-category-${c.name}`}><div><span className="mono text-xs text-[hsl(var(--accent))]">0{i + 1}</span><h2 className="serif mt-5 text-3xl">{c.name}</h2></div><div className="flex gap-2"><Button href={`/books?category=${encodeURIComponent(c.name)}`} variant="soft">{c.bookCount} books</Button><Button href={`/videos?category=${encodeURIComponent(c.name)}`} variant="ghost">{c.videoCount} films <ArrowRight size={14} /></Button></div></div>)}</div>}</div></main></Shell>;
}

function About() { return <Shell><main className="mx-auto max-w-[1000px] px-5 pb-16 pt-16 lg:px-8"><div className="max-w-3xl"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Why this exists</p><h1 className="serif mt-4 text-6xl leading-[.95] tracking-[-.05em] md:text-8xl">Make room<br /><em>for the good stuff.</em></h1><p className="mt-8 max-w-2xl text-xl leading-8 text-[hsl(var(--muted-foreground))]">The internet has never had a shortage of things to consume. It has a shortage of places to look carefully.</p></div><div className="mt-20 grid gap-12 border-t border-[hsl(var(--border))] pt-12 md:grid-cols-3"><div><ShieldCheck className={teal} /><h2 className="serif mt-5 text-2xl">Permission first</h2><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">We only share works that are in the public domain, openly licensed, or submitted by the people who have the right to share them.</p></div><div><Heart className={teal} /><h2 className="serif mt-5 text-2xl">A human pace</h2><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">No infinite scroll, no engagement tricks. A considered collection makes it easier to choose, finish, and return.</p></div><div><FileText className={teal} /><h2 className="serif mt-5 text-2xl">Clear provenance</h2><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Every item has a source, a format, and a way to contact us. Trust is part of the interface.</p></div></div><div className="mt-20 rounded-3xl bg-[hsl(var(--secondary))] p-8 md:p-12"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Our north star</p><blockquote className="serif mt-5 max-w-3xl text-3xl leading-tight md:text-5xl">“A good library does not tell you what to think. It gives you better things to think with.”</blockquote></div></main></Shell>; }

function LegalPage({ type }: { type: 'terms' | 'policy' }) { const policy = type === 'policy'; return <Shell><main className="mx-auto max-w-[900px] px-5 pb-16 pt-16 lg:px-8"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{policy ? 'Copyright & distribution' : 'The small print'}</p><h1 className="serif mt-4 text-6xl tracking-[-.04em]">{policy ? 'Content Policy' : 'Terms of Service'}</h1><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Last updated 14 February 2024</p><div className="prose prose-stone mt-12 max-w-none prose-headings:font-[var(--app-font-serif)] prose-headings:font-medium prose-p:text-[hsl(var(--muted-foreground))] prose-p:leading-8"><h2>{policy ? 'The short version' : 'Welcome to OpenShelf'}</h2><p>{policy ? 'OpenShelf is a discovery and access layer for material that is legally available to share. We are not a file-hosting free-for-all, and we do not knowingly make copyrighted work available without permission.' : 'OpenShelf is a curated digital library operated as a public-interest project. By using the site, you agree to use materials lawfully and to respect the rights of authors, filmmakers, publishers, and contributors.'}</p><h2>{policy ? 'What we accept' : 'Using the collection'}</h2><p>{policy ? 'Public-domain works, Creative Commons and other openly licensed works, and material supplied by a rights holder or authorized representative. We record the source and distribution terms when an item is added.' : 'You may browse, stream, and download materials according to the permissions attached to each item. Do not redistribute, sell, or alter a work when its license does not allow it.'}</p><h2>{policy ? 'A concern about an item?' : 'Our responsibilities'}</h2><p>{policy ? 'Send a report with the title, the specific URL, your relationship to the work, and a concise explanation. We review complete reports promptly and may restrict access while we investigate.' : 'We work to keep descriptions accurate and links functional, but the collection is provided as-is. If you see an error, broken link, or rights concern, please contact the library team.'}</p><h2>Contact</h2><p>For a copyright report or question about these terms, write to <strong>rights@openshelf.org</strong>. Please do not send passwords or payment information.</p></div></main></Shell>; }

function Contact() { const [sent, setSent] = useState(false); return <Shell><main className="mx-auto grid max-w-[1000px] gap-14 px-5 pb-16 pt-16 md:grid-cols-[.85fr_1fr] lg:px-8"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Write to us</p><h1 className="serif mt-4 text-6xl leading-[.95] tracking-[-.05em]">Keep the shelf honest.</h1><p className="mt-6 text-[hsl(var(--muted-foreground))]">Found a broken link, want to suggest a work, or need to report a copyright concern? We read every note.</p><div className="mt-10 border-t border-[hsl(var(--border))] pt-5 text-sm"><p className="font-semibold">Rights & copyright</p><p className="mt-1 text-[hsl(var(--muted-foreground))]">rights@openshelf.org</p></div></div><form onSubmit={e => { e.preventDefault(); setSent(true); }} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8">{sent ? <div className="py-12 text-center"><Check className="mx-auto text-[hsl(var(--primary))]" size={30} /><h2 className="serif mt-5 text-3xl">Note received.</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Thanks for helping us keep this place useful.</p><Button onClick={() => setSent(false)} variant="soft" className="mt-6">Send another</Button></div> : <><label className="text-sm font-semibold">Your email<input required type="email" className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-contact-email" /></label><label className="mt-5 block text-sm font-semibold">What can we help with?<select className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm outline-none" data-testid="select-contact-type"><option>Copyright or rights report</option><option>Suggest a book or film</option><option>Broken link or metadata</option><option>Something else</option></select></label><label className="mt-5 block text-sm font-semibold">Your note<textarea required rows={5} className="mt-2 w-full resize-none rounded-lg border bg-transparent p-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="textarea-contact-message" /></label><Button type="submit" className="mt-6 w-full">Send note <Send size={15} /></Button></>}</form></main></Shell>; }

function AuthPage({ signUp = false }: { signUp?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  return <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] md:grid-cols-[.85fr_1.15fr]"><div className="hidden bg-[hsl(var(--primary))] p-10 text-[hsl(var(--primary-foreground))] md:flex md:flex-col md:justify-between"><Logo /><div><p className="mono text-[10px] uppercase tracking-[.2em] opacity-70">A shelf of your own</p><p className="serif mt-4 max-w-md text-5xl leading-tight">Keep the good ones close.</p><p className="mt-5 max-w-sm text-sm leading-7 opacity-70">Save a quiet corner of OpenShelf for the books and films you want to return to.</p></div><p className="text-xs opacity-60">OpenShelf · Digital library</p></div><div className="flex items-center justify-center p-5"><div className="w-full max-w-[390px]"><div className="mb-10 md:hidden"><Logo /></div>{submitted ? <div className="text-center"><Check className="mx-auto text-[hsl(var(--primary))]" size={30} /><h1 className="serif mt-5 text-4xl">{signUp ? 'You’re on the list.' : 'Welcome back.'}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Authentication is ready to connect with your Clerk account.</p><Button href="/" className="mt-7 w-full">Return to OpenShelf</Button></div> : <><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{signUp ? 'Join the library' : 'Member access'}</p><h1 className="serif mt-3 text-5xl">{signUp ? 'Make a place for it.' : 'Good to see you.'}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{signUp ? 'Create an account to save titles and build your own reading list.' : 'Sign in to pick up where you left off.'}</p><form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="mt-8"><label className="text-sm font-semibold">Email address<input required type="email" className="mt-2 h-12 w-full rounded-lg border bg-[hsl(var(--card))] px-3 outline-none focus:border-[hsl(var(--primary))]" data-testid="input-auth-email" /></label><label className="mt-4 block text-sm font-semibold">Password<input required type="password" className="mt-2 h-12 w-full rounded-lg border bg-[hsl(var(--card))] px-3 outline-none focus:border-[hsl(var(--primary))]" data-testid="input-auth-password" /></label><Button type="submit" className="mt-6 w-full">{signUp ? 'Create account' : 'Sign in'} <ArrowRight size={15} /></Button></form><p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{signUp ? 'Already have an account? ' : 'New to OpenShelf? '}<Link href={signUp ? '/sign-in' : '/sign-up'} className="font-semibold text-[hsl(var(--primary))]" data-testid="link-auth-switch">{signUp ? 'Sign in' : 'Create one'}</Link></p></>}</div></div></div>;
}

function AdminLogin() {
  const { isSignedIn } = useAuth();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-5"><div className="w-full max-w-[420px] rounded-3xl bg-[hsl(var(--card))] p-7 shadow-xl md:p-10"><Logo /><p className="mono mt-12 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Staff access</p><h1 className="serif mt-3 text-4xl">Back of the shelf.</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The catalog desk is for OpenShelf contributors. Sign in with your authorized staff account to continue.</p><Button href={isSignedIn ? '/admin' : '/sign-in'} className="mt-8 w-full">{isSignedIn ? 'Enter workspace' : 'Continue to secure sign in'} <ArrowRight size={15} /></Button><Link href="/" className="mt-6 block text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="link-admin-back">Return to public library</Link></div></div>;
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-5"><div className="flex items-center justify-between text-[hsl(var(--sidebar-foreground)/.62)]"><span className="mono text-[10px] uppercase tracking-[.16em]">{label}</span>{icon}</div><p className="serif mt-5 text-4xl text-[hsl(var(--sidebar-foreground))]">{value}</p></div>;
}

type EditorState = { kind: 'book' | 'video'; id?: number; title: string; author?: string; description: string; category: string; coverUrl?: string; fileUrl?: string; fileType?: BookInput['fileType']; fileSize?: number; duration?: string; thumbnailUrl?: string; videoUrl?: string; downloadEnabled?: boolean; featured?: boolean };
const emptyBook: EditorState = { kind: 'book', title: '', author: '', description: '', category: '', coverUrl: '', fileUrl: '', fileType: 'PDF', fileSize: 0, featured: false };
const emptyVideo: EditorState = { kind: 'video', title: '', description: '', category: '', thumbnailUrl: '', videoUrl: '', duration: '', downloadEnabled: false, featured: false };

function CatalogEditor({ state, setState, close, refresh }: { state: EditorState; setState: (s: EditorState) => void; close: () => void; refresh: () => void }) {
  const createBook = useCreateBook(); const updateBook = useUpdateBook(); const createVideo = useCreateVideo(); const updateVideo = useUpdateVideo(); const upload = useRequestUploadUrl();
  const submit = (e: FormEvent) => { e.preventDefault(); if (state.kind === 'book') { const data: BookInput = { title: state.title, author: state.author ?? '', description: state.description, category: state.category, coverUrl: state.coverUrl || null, fileUrl: state.fileUrl || null, fileType: state.fileType ?? 'PDF', fileSize: Number(state.fileSize) || 0, featured: state.featured }; const done = () => { refresh(); close(); }; state.id ? updateBook.mutate({ id: state.id, data }, { onSuccess: done }) : createBook.mutate({ data }, { onSuccess: done }); } else { const data: VideoInput = { title: state.title, description: state.description, category: state.category, thumbnailUrl: state.thumbnailUrl || null, videoUrl: state.videoUrl || null, duration: state.duration ?? '', downloadEnabled: state.downloadEnabled, featured: state.featured }; const done = () => { refresh(); close(); }; state.id ? updateVideo.mutate({ id: state.id, data }, { onSuccess: done }) : createVideo.mutate({ data }, { onSuccess: done }); } };
  const busy = createBook.isPending || updateBook.isPending || createVideo.isPending || updateVideo.isPending;
  const patch = (key: keyof EditorState, value: string | boolean) => setState({ ...state, [key]: value });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[hsl(193_25%_19%/.52)] p-4"><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[hsl(var(--card))] p-6 shadow-xl"><div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">{state.id ? 'Edit item' : 'New item'}</p><h2 className="serif mt-1 text-3xl">{state.kind === 'book' ? 'Add a book' : 'Add a video'}</h2></div><button type="button" onClick={close} data-testid="button-close-editor"><X size={20} /></button></div><div className="mt-6 grid gap-4"><label className="text-sm font-semibold">Title<input required value={state.title} onChange={e => patch('title', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-title" /></label>{state.kind === 'book' && <label className="text-sm font-semibold">Author<input required value={state.author} onChange={e => patch('author', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-author" /></label>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Category<input required value={state.category} onChange={e => patch('category', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-category" /></label>{state.kind === 'book' ? <label className="text-sm font-semibold">Format<select value={state.fileType} onChange={e => patch('fileType', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="select-editor-format"><option>PDF</option><option>EPUB</option><option>MOBI</option><option>TXT</option></select></label> : <label className="text-sm font-semibold">Duration<input required value={state.duration} onChange={e => patch('duration', e.target.value)} placeholder="38 min" className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-duration" /></label>}</div><label className="text-sm font-semibold">Description<textarea required rows={4} value={state.description} onChange={e => patch('description', e.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm" data-testid="textarea-editor-description" /></label><label className="text-sm font-semibold">{state.kind === 'book' ? 'Cover URL' : 'Thumbnail URL'}<input value={(state.kind === 'book' ? state.coverUrl : state.thumbnailUrl) ?? ''} onChange={e => patch(state.kind === 'book' ? 'coverUrl' : 'thumbnailUrl', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-image-url" /></label><label className="text-sm font-semibold">{state.kind === 'book' ? 'File URL' : 'Video URL'}<input value={(state.kind === 'book' ? state.fileUrl : state.videoUrl) ?? ''} onChange={e => patch(state.kind === 'book' ? 'fileUrl' : 'videoUrl', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-media-url" /></label>{state.kind === 'book' && <div className="flex items-center gap-3"><input type="number" min="0" value={state.fileSize} onChange={e => patch('fileSize', e.target.value)} placeholder="File size in bytes" className="h-11 flex-1 rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-filesize" /><input type="file" className="max-w-[180px] text-xs" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } }); }} data-testid="input-editor-upload" /></div>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.featured ?? false} onChange={e => patch('featured', e.target.checked)} data-testid="checkbox-editor-featured" /> Feature this item</label>{state.kind === 'video' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.downloadEnabled ?? false} onChange={e => patch('downloadEnabled', e.target.checked)} data-testid="checkbox-editor-download" /> Allow downloads</label>}</div><div className="mt-7 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save to catalog'}</Button></div></form></div>;
}

function Admin() {
  const [tab, setTab] = useState<'overview' | 'books' | 'videos'>('overview'); const [editor, setEditor] = useState<EditorState | null>(null); const qc = useQueryClient();
  const stats = useGetAdminStats(); const books = useListBooks(); const videos = useListVideos(); const delBook = useDeleteBook(); const delVideo = useDeleteVideo();
  const refresh = () => { qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }); qc.invalidateQueries({ queryKey: getListBooksQueryKey() }); qc.invalidateQueries({ queryKey: getListVideosQueryKey() }); qc.invalidateQueries({ queryKey: getGetLibrarySummaryQueryKey() }); qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); };
  const confirmDelete = (kind: 'book' | 'video', id: number) => { if (window.confirm('Remove this item from the catalog?')) { kind === 'book' ? delBook.mutate({ id }, { onSuccess: refresh }) : delVideo.mutate({ id }, { onSuccess: refresh }); } };
  return <Shell admin><div className="flex min-h-[100dvh]"><aside className="hidden w-[245px] shrink-0 flex-col bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] md:flex"><Logo /><p className="mono mb-3 mt-14 px-3 text-[10px] uppercase tracking-[.18em] opacity-50">Workspace</p><button onClick={() => setTab('overview')} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${tab === 'overview' ? 'bg-[hsl(var(--sidebar-accent))]' : 'opacity-70 hover:opacity-100'}`} data-testid="button-admin-overview"><BarChart3 size={17} /> Overview</button><button onClick={() => setTab('books')} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${tab === 'books' ? 'bg-[hsl(var(--sidebar-accent))]' : 'opacity-70 hover:opacity-100'}`} data-testid="button-admin-books"><BookOpen size={17} /> Books</button><button onClick={() => setTab('videos')} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${tab === 'videos' ? 'bg-[hsl(var(--sidebar-accent))]' : 'opacity-70 hover:opacity-100'}`} data-testid="button-admin-videos"><Film size={17} /> Videos</button><div className="mt-auto"><Link href="/" className="flex items-center gap-3 px-3 py-3 text-sm opacity-65 hover:opacity-100" data-testid="link-admin-library"><ArrowLeft size={17} /> Public library</Link></div></aside><div className="min-w-0 flex-1"><div className="flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] px-5 lg:px-10"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]">Catalog desk</p><h1 className="serif text-2xl">{tab === 'overview' ? 'A clear view of the library.' : tab === 'books' ? 'Books' : 'Videos'}</h1></div><div className="flex items-center gap-2"><Link href="/" className="rounded-full p-2 text-[hsl(var(--muted-foreground))] md:hidden" data-testid="link-mobile-admin-library"><ArrowLeft size={18} /></Link><span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--secondary))]"><CircleUserRound size={17} /></span></div></div><main className="mx-auto max-w-[1200px] p-5 lg:p-10">{tab === 'overview' ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.isLoading ? [1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />) : <><StatCard label="Books" value={stats.data?.bookCount ?? 0} icon={<BookOpen size={16} />} /><StatCard label="Videos" value={stats.data?.videoCount ?? 0} icon={<Film size={16} />} /><StatCard label="Downloads" value={stats.data?.totalDownloads ?? 0} icon={<Download size={16} />} /><StatCard label="Views" value={stats.data?.totalViews ?? 0} icon={<BarChart3 size={16} />} /></>}</div><div className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]">Collection shape</p><h2 className="serif mt-2 text-3xl">Category breakdown</h2></div><LayoutGrid className="text-[hsl(var(--muted-foreground))]" size={20} /></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{(stats.data?.categoryBreakdown ?? []).map(c => <div key={c.name} className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/.6)] px-4 py-3 text-sm"><span>{c.name}</span><span className="mono text-xs text-[hsl(var(--muted-foreground))]">{c.bookCount} books · {c.videoCount} films</span></div>)}</div></div></> : <CatalogList tab={tab} books={books.data ?? []} videos={videos.data ?? []} onAdd={() => setEditor(tab === 'books' ? { ...emptyBook } : { ...emptyVideo })} onEdit={(item) => setEditor(tab === 'books' ? { kind: 'book', id: item.id, title: item.title, author: (item as Book).author, description: item.description, category: item.category, coverUrl: (item as Book).coverUrl ?? '', fileUrl: (item as Book).fileUrl ?? '', fileType: (item as Book).fileType as BookInput['fileType'], fileSize: (item as Book).fileSize, featured: item.featured } : { kind: 'video', id: item.id, title: item.title, description: item.description, category: item.category, thumbnailUrl: (item as Video).thumbnailUrl ?? '', videoUrl: (item as Video).videoUrl ?? '', duration: (item as Video).duration, downloadEnabled: (item as Video).downloadEnabled, featured: item.featured })} onDelete={id => confirmDelete(tab === 'books' ? 'book' : 'video', id)} />}</main></div></div>{editor && <CatalogEditor state={editor} setState={setEditor} close={() => setEditor(null)} refresh={refresh} />}</Shell>;
}

function CatalogList({ tab, books, videos, onAdd, onEdit, onDelete }: { tab: 'books' | 'videos'; books: Book[]; videos: Video[]; onAdd: () => void; onEdit: (item: Book | Video) => void; onDelete: (id: number) => void }) {
  const items = tab === 'books' ? books : videos;
  return <div><div className="mb-6 flex items-center justify-between"><p className="text-sm text-[hsl(var(--muted-foreground))]">{items.length} items in catalog</p><Button onClick={onAdd}><Plus size={16} /> Add {tab === 'books' ? 'book' : 'video'}</Button></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{items.length === 0 ? <StateMessage title={`No ${tab} yet`} body="Add the first item to begin the shelf." /> : items.map(item => <div key={item.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><div className="hidden h-12 w-9 shrink-0 overflow-hidden rounded bg-[hsl(var(--secondary))] sm:block">{tab === 'books' ? <Cover book={item as Book} /> : <VideoThumb video={item as Video} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.category} · {tab === 'books' ? (item as Book).author : (item as Video).duration}</p></div><span className="hidden rounded-full bg-[hsl(var(--secondary))] px-2 py-1 mono text-[10px] sm:inline">{item.featured ? 'Featured' : 'Standard'}</span><button onClick={() => onEdit(item)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" data-testid={`button-edit-${tab}-${item.id}`}><Settings2 size={16} /></button><button onClick={() => onDelete(item.id)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))]" data-testid={`button-delete-${tab}-${item.id}`}><Trash2 size={16} /></button></div>)}</div></div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUser.current !== undefined && previousUser.current !== userId) qc.clear();
    previousUser.current = userId;
  }), [addListener, qc]);
  return null;
}

function ClerkSignInPage({ signUp = false }: { signUp?: boolean }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4">
    {signUp
      ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}
  </div>;
}

function AdminRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><p className="mono text-xs uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Checking access…</p></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Admin />;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Home} /><Route path="/books" component={Books} /><Route path="/books/:id" component={BookDetail} />
    <Route path="/videos" component={Videos} /><Route path="/videos/:id" component={VideoDetail} /><Route path="/categories" component={Categories} />
    <Route path="/about" component={About} /><Route path="/contact" component={Contact} /><Route path="/terms"><LegalPage type="terms" /></Route><Route path="/content-policy"><LegalPage type="policy" /></Route>
    <Route path="/admin/login" component={AdminLogin} /><Route path="/admin" component={AdminRoute} />
    <Route path="/sign-in/*?" component={() => <ClerkSignInPage />} /><Route path="/sign-up/*?" component={() => <ClerkSignInPage signUp />} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Get started today' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to))}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkCacheInvalidator />
      <Router />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;
