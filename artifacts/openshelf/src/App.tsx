import { type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ptBR } from '@clerk/localizations';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, ChevronDown, CircleUserRound, Mail,
  Download, FileText, Film, Headphones, Heart, Info,
  Menu, Play, Plus, Search, Send, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Trash2, UploadCloud, X, Youtube, GraduationCap, Globe2,
  BookMarked, Compass, UsersRound, PlayCircle, ArrowUpRight,
  Images, Maximize2, CalendarDays, Clock3, MapPin, ExternalLink, Copy, Eye, EyeOff,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  getGetBookDownloadQueryKey, getGetBookQueryKey,
  getGetLibrarySummaryQueryKey, getGetVideoDownloadQueryKey, getGetVideoQueryKey,
  getListAdminEventsQueryKey, getListBooksQueryKey, getListCategoriesQueryKey, getListEventsQueryKey, getListImagesQueryKey, getListVideosQueryKey,
  type Book, type BookInput, type Category, type ContactMessage, type Event as CatalogEvent, type EventInput, type EventUpdate, type Image, type ImageInput, type Video, type VideoInput,
  useCreateBook, useCreateCategory, useCreateImage, useCreateVideo, useDeleteBook, useDeleteCategory, useDeleteImage, useDeleteVideo, useGetAdminAnalytics,
  useGetBook, useGetBookDownload, useGetLibrarySummary, useGetVideo,
  useCreateContactMessage, useGetEvent, useGetVideoDownload, useListAdminContactMessages, useListAdminEvents, useListBooks, useListCategories, useListEvents, useListImages, useListVideos,
  useRequestImageUploadUrl, useRequestUploadUrl, useUpdateBook, useUpdateEvent, useUpdateImage, useUpdateVideo,
  useCreateEvent, useDeleteEvent, useDuplicateEvent, useUpdateAdminContactMessage,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient();
const teal = 'text-[hsl(var(--primary))]';
const savedBooksStorageKey = 'nur-al-sunnah:saved-books';
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
GlobalWorkerOptions.workerSrc = pdfWorker;

function appUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${basePath}${value}` : value;
}

type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the library.
  }
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/sunnah-brasil-logo.png`,
    unsafe_disableDevelopmentModeWarnings: true,
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

function Button({ children, onClick, href, variant = 'primary', className = '', disabled = false, type = 'button', ariaLabel, ariaPressed, dataTestId }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
  className?: string; disabled?: boolean; type?: 'button' | 'submit'; ariaLabel?: string; ariaPressed?: boolean; dataTestId?: string;
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
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-pressed={ariaPressed} className={cls} data-testid={dataTestId ?? 'button-action'}>{children}</button>;
}

function Logo({ onDark = false }: { onDark?: boolean }) {
  return <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
    <img src={`${basePath}/sunnah-brasil-logo.png`} alt="Nur Al-Sunnah" className={`h-14 w-[125px] object-contain object-left ${onDark ? 'rounded-lg bg-white p-1 mix-blend-normal' : 'mix-blend-multiply'}`} />
  </Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const [search, setSearch] = useState('');
   const items = [['Início', '/'], ['Livros', '/books'], ['Vídeos', '/videos'], ['Imagens', '/images'], ['Eventos', '/events'], ['Categorias', '/categories'], ['Sobre', '/about']];
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    window.location.href = `${basePath}/books${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`;
  };
  return <header className="sticky top-0 z-40 border-b border-[#e3e9e7] bg-[#eee6da]/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-[72px] max-w-[1240px] items-center justify-between gap-5 px-5 lg:px-8">
      <Logo />
      <nav className="hidden items-center gap-0.5 lg:flex">{items.map(([label, href]) =>
        <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`} className={`rounded-full px-3 py-2 text-[13px] transition-colors ${location === href ? 'bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>{label}</Link>)}</nav>
      <div className="hidden items-center gap-2 md:flex">
        <form onSubmit={submitSearch} className="relative hidden xl:block">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input aria-label="Buscar livros e vídeos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar livros, vídeos..." className="h-10 w-[190px] rounded-full border border-[hsl(var(--border))] bg-white pl-9 pr-3 text-xs outline-none transition focus:border-[#075C45]" />
        </form>
        <Button href="/books" className="bg-[#075C45] px-4">Explorar biblioteca</Button>
      </div>
      <button onClick={() => setOpen(!open)} className="rounded-full p-2 lg:hidden" data-testid="button-mobile-menu" aria-label={open ? 'Fechar menu' : 'Abrir menu'}>{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <div className="border-t border-[hsl(var(--border))] px-5 pb-5 pt-4 lg:hidden">
      <form onSubmit={submitSearch} className="relative mb-3"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input aria-label="Buscar livros e vídeos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar livros, vídeos..." className="h-12 w-full rounded-full border border-[hsl(var(--border))] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#075C45]" /></form>
      {items.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href} className="block border-b border-[hsl(var(--border)/.55)] py-3 text-sm" data-testid={`link-mobile-${label.toLowerCase().replace(/\s/g, '-')}`}>{label}</Link>)}<Button href="/books" className="mt-4 w-full bg-[#075C45]">Explorar biblioteca</Button>
    </div>}
  </header>;
}

function Footer() {
  return <footer className="mt-24 border-t border-[#dbe4e2] bg-[#f5f8f7]">
    <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
      <div><Logo /><p className="mt-4 max-w-[290px] text-sm leading-6 text-[#607274]">Conhecimento que atravessa fronteiras. Uma biblioteca digital pública, simples e acessível.</p></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[#075C45]">Explorar</p><div className="grid gap-2 text-sm"><Link href="/books">Livros</Link><Link href="/videos">Vídeos</Link><Link href="/images" data-testid="link-footer-images">Imagens</Link><Link href="/events">Eventos</Link><Link href="/categories">Categorias</Link></div></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[#075C45]">Nur Al-Sunnah</p><div className="grid gap-2 text-sm"><Link href="/about">Sobre</Link><Link href="/contact">Contato e direitos</Link><Link href="/content-policy">Política de conteúdo</Link><Link href="/terms">Termos de uso</Link></div></div>
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-[#075C45]">Transparência</p><p className="text-sm leading-6 text-[#607274]">Se você acredita que algum conteúdo viola seus direitos autorais, entre em contato conosco para análise.</p><Link href="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#075C45]">Falar com a equipe <ArrowUpRight size={14} /></Link></div>
    </div><div className="mx-auto max-w-[1240px] border-t border-[#dbe4e2] px-5 py-5 text-xs text-[#607274] lg:px-8">© {new Date().getFullYear()} Nur Al-Sunnah · Acesso gratuito ao conhecimento</div>
  </footer>;
}

function Shell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const [location] = useLocation();
  const publicPageClass = stripBase(location) === '/' ? 'site-home' : 'site-inner';
  return admin ? <div className="min-h-[100dvh] bg-[hsl(var(--background))]">{children}</div> : <div className={`site-grain site-public ${publicPageClass} min-h-[100dvh]`}><Header />{children}<Footer /></div>;
}

function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px' });

    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function LoadingGrid({ kind = 'book' }: { kind?: 'book' | 'video' }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{[1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse" data-testid={`skeleton-${kind}-${i}`}><div className={`skeleton aspect-[3/4] rounded-[14px] ${kind === 'video' ? 'aspect-video' : ''}`} /><div className="skeleton mt-3 h-4 w-4/5 rounded" /><div className="skeleton mt-2 h-3 w-2/5 rounded" /></div>)}</div>;
}

function StateMessage({ error = false, title, body, retry }: { error?: boolean; title: string; body: string; retry?: () => void }) {
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-16 text-center" data-testid={error ? 'state-error' : 'state-empty'}><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-[hsl(var(--secondary))]">{error ? <Info size={19} /> : <BookOpen size={19} />}</div><h3 className="serif text-xl">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{body}</p>{retry && <Button onClick={retry} variant="outline" className="mt-5">Tentar novamente</Button>}</div>;
}

function handleDepthPointerMove(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  element.style.setProperty('--depth-rotate-x', `${(-y * 3).toFixed(2)}deg`);
  element.style.setProperty('--depth-rotate-y', `${(x * 3).toFixed(2)}deg`);
  element.style.setProperty('--depth-shift-x', `${(x * 2).toFixed(1)}px`);
}

function resetDepthPointer(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget;
  element.style.setProperty('--depth-rotate-x', '0deg');
  element.style.setProperty('--depth-rotate-y', '0deg');
  element.style.setProperty('--depth-shift-x', '0px');
}

function Cover({ book, large = false }: { book: Book; large?: boolean }) {
  return <div className={`book-cover ${large ? 'aspect-[3/4] max-w-[280px] rounded-2xl' : 'aspect-[3/4] rounded-[14px]'} shadow-sm`}>
    {book.coverUrl ? <img src={appUrl(book.coverUrl)} alt={book.title} className="relative z-[1] h-full w-full object-cover" /> : <div className="relative z-[1] flex h-full flex-col justify-between p-5 text-[hsl(var(--primary-foreground))]"><span className="mono text-[10px] uppercase tracking-[.15em] opacity-75">Edição Nur Al-Sunnah</span><div><h3 className={`serif leading-[1.02] ${large ? 'text-3xl' : 'text-xl'}`}>{book.title}</h3><p className="mt-2 text-xs opacity-75">{book.author}</p></div></div>}
  </div>;
}

function VideoThumb({ video, large = false }: { video: Video; large?: boolean }) {
  return <div className={`relative overflow-hidden rounded-[14px] bg-[hsl(190_27%_22%)] ${large ? 'aspect-video' : 'aspect-video'}`}>{video.thumbnailUrl ? <img src={appUrl(video.thumbnailUrl)} alt={video.title} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_78%_18%,hsl(10_57%_62%/.8),transparent_32%),linear-gradient(135deg,hsl(190_27%_22%),hsl(174_37%_31%))] p-4 text-[hsl(var(--primary-foreground))]"><Youtube className="opacity-80" size={24} /><span className="serif text-xl leading-tight">{video.title}</span></div>}<span className="absolute bottom-3 right-3 rounded bg-[hsl(193_25%_19%/.78)] px-2 py-1 mono text-[10px] text-white">{video.duration}</span><span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[hsl(var(--accent))] text-white shadow-md transition-transform group-hover:scale-110"><Play size={17} fill="currentColor" /></span></div>;
}

function BookCard({ book }: { book: Book }) {
  return <Link href={`/books/${book.id}`} className="group depth-card block" onPointerMove={handleDepthPointerMove} onPointerLeave={resetDepthPointer} data-testid={`card-book-${book.id}`}><Cover book={book} /><div className="px-1 pt-3"><p className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{book.category}</p><h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-[hsl(var(--primary))]">{book.title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{book.author}</p></div></Link>;
}

function VideoCard({ video }: { video: Video }) {
  return <Link href={`/videos/${video.id}`} className="group depth-card block" onPointerMove={handleDepthPointerMove} onPointerLeave={resetDepthPointer} data-testid={`card-video-${video.id}`}><VideoThumb video={video} /><div className="px-1 pt-3"><p className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{video.category}</p><h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-[hsl(var(--primary))]">{video.title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{video.viewCount.toLocaleString()} visualizações</p></div></Link>;
}

function SectionHeading({ eyebrow, title, href, action = 'Ver a estante' }: { eyebrow: string; title: string; href?: string; action?: string }) {
  return <div className="mb-7 flex items-end justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{eyebrow}</p><h2 className="serif mt-2 text-3xl leading-none md:text-4xl">{title}</h2></div>{href && <Button href={href} variant="ghost" className="hidden sm:inline-flex">{action}<ArrowRight size={15} /></Button>}</div>;
}

const formatEventDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
};

const formatEventTime = (event: CatalogEvent) => `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}`;

function useCountdown(target: string) {
  const getRemaining = () => Math.max(0, new Date(target).getTime() - Date.now());
  const [remaining, setRemaining] = useState(getRemaining);
  useEffect(() => {
    if (getRemaining() <= 0) return;
    let timer = 0;
    timer = window.setInterval(() => {
      const next = getRemaining();
      setRemaining(next);
      if (next <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    totalSeconds,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function Countdown({ target, compact = false, transparent = false }: { target: string; compact?: boolean; transparent?: boolean }) {
  const countdown = useCountdown(target);
  if (countdown.totalSeconds <= 0) return <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">O evento já começou</span>;
  const values = compact
    ? [['Dias', countdown.days], ['H', countdown.hours], ['M', countdown.minutes], ['S', countdown.seconds]]
    : [['dias', countdown.days], ['horas', countdown.hours], ['min', countdown.minutes], ['seg', countdown.seconds]];
  return <div className={`flex items-center gap-2 ${compact && !transparent ? 'text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--foreground))]'}`} aria-label="Contagem regressiva">
    {values.map(([label, value]) => <span key={String(label)} className={`rounded-lg px-2 py-1.5 text-center ${compact && !transparent ? 'bg-white/12' : 'border border-[#dbe4e2] bg-[#e9f3ef]'}`}><strong className="mono block text-base leading-none">{String(value).padStart(2, '0')}</strong><small className="mt-1 block text-[8px] uppercase tracking-wider opacity-70">{label}</small></span>)}
  </div>;
}

function EventImage({ event, className = '' }: { event: CatalogEvent; className?: string }) {
  return <div className={`overflow-hidden bg-[hsl(var(--secondary))] ${className}`}>
    {event.imageUrl ? <img src={appUrl(event.imageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-40 items-center justify-center bg-[radial-gradient(circle_at_72%_18%,hsl(10_57%_62%/.5),transparent_32%),linear-gradient(135deg,hsl(190_27%_22%),hsl(174_37%_31%))] text-white"><CalendarDays size={42} strokeWidth={1.3} /></div>}
  </div>;
}

function EventCard({ event }: { event: CatalogEvent }) {
  const isUpcoming = event.status === 'upcoming';
  return <Link href={`/events/${event.id}`} className="group block overflow-hidden rounded-2xl border border-[#dbe4e2] bg-white transition-all hover:-translate-y-1 hover:border-[#75b79f] hover:shadow-[0_14px_30px_rgba(7,27,44,.1)]" data-testid={`card-event-${event.id}`}>
    <EventImage event={event} className="aspect-[16/9]" />
    <div className="p-5">
      <div className="flex items-center justify-between gap-3"><span className={`mono text-[10px] uppercase tracking-[.15em] ${isUpcoming ? 'text-[#075C45]' : 'text-[#8a6e4b]'}`}>{isUpcoming ? 'Próximo evento' : 'Evento realizado'}</span><CalendarDays size={15} className="text-[#075C45]" /></div>
      <h2 className="mt-3 line-clamp-2 text-xl font-bold leading-tight text-[#071B2C] group-hover:text-[#075C45]">{event.title}</h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#607274]">{event.shortDescription}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#607274]"><span className="flex items-center gap-1.5"><Clock3 size={13} />{formatEventDate(event.eventDate)} · {formatEventTime(event)}</span><span className="flex items-center gap-1.5"><MapPin size={13} />{event.city}</span></div>
    </div>
  </Link>;
}

function NextEventBanner({ event }: { event: CatalogEvent }) {
  return <section className="sticky top-[76px] z-20 mx-auto -mb-5 max-w-[1240px] px-4 pt-2 lg:px-8">
    <div className="relative overflow-hidden rounded-2xl border border-[#dbe4e2] bg-transparent text-[#163d3a]">
      <div className="relative grid gap-3 p-3 md:grid-cols-[1fr_auto] md:items-center md:p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-[#075C45]"><CalendarDays size={12} /> Próximo evento</div>
          <h2 className="serif mt-1 max-w-2xl text-xl leading-tight md:text-2xl">{event.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[11px] text-[#607274]"><span className="flex items-center gap-1"><Clock3 size={12} />{formatEventDate(event.eventDate)} · {formatEventTime(event)}</span><span className="flex items-center gap-1"><MapPin size={12} />{event.city}</span></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button href={`/events/${event.id}`} className="!px-3 !py-2 !text-xs">Ver detalhes <ArrowRight size={13} /></Button><Countdown target={event.startsAt} compact transparent /></div>
        </div>
        <EventImage event={event} className="hidden aspect-square w-24 rounded-xl md:block lg:w-28" />
      </div>
    </div>
  </section>;
}

function Home() {
  const { data: summary, isLoading, isError, refetch } = useGetLibrarySummary();
  const events = useListEvents({ query: { queryKey: getListEventsQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  useScrollReveal();
  const featuredBooks = summary?.featuredBooks ?? [];
  const featuredVideos = summary?.featuredVideos ?? [];
  const highlightedItems = useMemo(() => {
    const seen = new Set<string>();
    return [...featuredBooks, ...featuredVideos, ...(summary?.recentlyAdded ?? [])].filter(item => {
      const key = `${'author' in item ? 'book' : 'video'}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }, [featuredBooks, featuredVideos, summary?.recentlyAdded]);
  const nextEvent = events.data?.find(event => event.status === 'upcoming');
  return <Shell><main className="overflow-x-clip">
     {nextEvent && <NextEventBanner event={nextEvent} />}
    <section className="home-hero relative border-b border-[#dbe4e2] bg-transparent">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] bg-[radial-gradient(circle_at_60%_40%,rgba(7,92,69,.09),transparent_55%)] lg:block" />
       <div className="hero-content relative z-10 mx-auto max-w-[1240px] px-5 pb-10 pt-10 md:pb-20 md:pt-16 lg:px-8 lg:pt-20">
        <div className="mx-auto max-w-[780px] text-center">
           <h1 className="serif rise-in delay-1 mx-auto max-w-[780px] text-[clamp(3.2rem,6.2vw,5.8rem)] font-bold leading-[.98] tracking-[-.06em] text-[#071B2C]">Conhecimento que <span className="text-[#075C45]">transforma vidas.</span></h1>
           <p className="rise-in delay-2 mx-auto mt-6 max-w-[535px] text-base leading-7 text-[#53666b] md:text-lg">Encontre livros e vídeos gratuitos para aprender, estudar e ampliar seus conhecimentos.</p>
            <div className="rise-in delay-3 mt-7 flex flex-wrap justify-center gap-2 sm:gap-3">
              <Button href="/books" className="depth-button whitespace-nowrap bg-[#075C45] px-4 py-2.5 text-[13px] sm:px-5 sm:text-sm">Explorar livros</Button>
              <Button href="/videos" variant="primary" className="depth-button whitespace-nowrap !bg-[#071B2C] !px-4 !py-2.5 !text-[13px] !text-white hover:!bg-[#102d43] sm:!px-5 sm:!text-sm">Assistir vídeos</Button>
          </div>
        </div>
      </div>
    </section>
      <section data-reveal className="reveal-on-scroll mx-auto max-w-[1240px] px-5 pb-8 pt-12 sm:pb-2 sm:pt-16 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#075C45]">Descubra algo novo</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em] text-[#071B2C] md:text-4xl">Conteúdos em destaque</h2><p className="mt-2 text-sm text-[#607274]">Descubra alguns dos conteúdos disponíveis na nossa biblioteca.</p></div><Button href="/books" variant="ghost" className="hidden sm:inline-flex">Ver biblioteca <ArrowRight size={15} /></Button></div>
        {isLoading ? <LoadingGrid /> : isError ? <StateMessage error title="A biblioteca está indisponível" body="Não conseguimos carregar os conteúdos agora." retry={refetch} /> : <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">{highlightedItems.map(item => 'author' in item ? <Link href={`/books/${item.id}`} key={`book-${item.id}`} className="group depth-card mx-auto block w-full max-w-[205px] sm:max-w-[240px]" onPointerMove={handleDepthPointerMove} onPointerLeave={resetDepthPointer} data-testid={`card-featured-book-${item.id}`}><Cover book={item} /></Link> : <Link href={`/videos/${item.id}`} key={`video-${item.id}`} className="group depth-card mx-auto block w-full max-w-[220px] sm:max-w-[240px]" onPointerMove={handleDepthPointerMove} onPointerLeave={resetDepthPointer} data-testid={`card-featured-video-${item.id}`}><VideoThumb video={item} /></Link>)}</div>}
    </section>
      <section data-reveal id="como-funciona" className="reveal-on-scroll mx-auto max-w-[1240px] px-5 py-16 md:py-24 lg:px-8">
       <div className="rounded-3xl bg-[#f1f6f4] px-5 py-8 md:px-16 md:py-16">
         <div className="mx-auto max-w-5xl">
           <p className="text-sm font-bold uppercase tracking-[.18em] text-[#075C45]">Sobre Nós</p>
           <div className="mt-5 space-y-5 text-sm leading-7 text-[#53666b] md:mt-7 md:space-y-6 md:text-lg md:leading-8">
            <p>Nur Al-Sunnah reúne conhecimento islâmico em um espaço simples e acessível, com livros, vídeos, imagens e eventos para aprender, estudar e aprofundar seus conhecimentos.</p>
            <p className="border-t border-[#cbdcd5] pt-5 font-semibold text-[#075C45]">Nur Al-Sunnah — Conhecimento, Sunnah e orientação para todos.</p>
          </div>
        </div>
      </div>
    </section>
  </main></Shell>;
}

function SearchBar({ value, onChange, placeholder = 'Buscar na coleção' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="relative w-full max-w-[440px]"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} data-testid="input-search" className="h-12 w-full rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-11 pr-4 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div>;
}

function LibraryToolbar({ kind, search, setSearch, category, setCategory, categories }: { kind: 'books' | 'videos'; search: string; setSearch: (v: string) => void; category: string; setCategory: (v: string) => void; categories: Category[] }) {
  return <div className="flex flex-col gap-3 border-y border-[hsl(var(--border))] py-4 sm:flex-row sm:items-center sm:justify-between"><SearchBar value={search} onChange={setSearch} placeholder={`Buscar ${kind === 'books' ? 'livros' : 'vídeos'}`} /><div className="flex items-center gap-2 overflow-x-auto"><SlidersHorizontal size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><button onClick={() => setCategory('')} className={`shrink-0 rounded-full px-3 py-2 text-xs ${!category ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]'}`} data-testid="button-filter-all">Todos</button>{categories.map(c => <button key={c.name} onClick={() => setCategory(c.name)} className={`shrink-0 rounded-full px-3 py-2 text-xs ${category === c.name ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]'}`} data-testid={`button-filter-${c.name.toLowerCase().replace(/\s/g, '-')}`}>{c.name}</button>)}</div></div>;
}

function Books() {
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') ?? ''); const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') ?? '');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category } : {}) }), [search, category]);
  const q = useListBooks(params); const cats = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><div className="mb-10"><div><h1 className="serif text-5xl tracking-[-.04em] md:text-6xl">A SALA DOS LIVROS</h1></div></div><LibraryToolbar kind="books" search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={cats.data ?? []} /><div className="mt-8">{q.isLoading ? <LoadingGrid /> : q.isError ? <StateMessage error title="As estantes estão fechadas por um momento" body="Tente novamente daqui a pouco." retry={q.refetch} /> : !q.data?.length ? <StateMessage title="Nenhum título corresponde à busca" body="Tente outra frase ou explore todas as categorias." /> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{q.data.map(book => <BookCard key={book.id} book={book} />)}</div>}</div></main></Shell>;
}

function Videos() {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') ?? '');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category } : {}) }), [search, category]);
  const q = useListVideos(params); const cats = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><div className="mb-10"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">A sala dos vídeos</p><h1 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Vídeos para aprender.</h1><p className="mt-4 max-w-lg text-[hsl(var(--muted-foreground))]">Aulas, palestras e vídeos para aprender, refletir e aprofundar seus conhecimentos.</p></div><LibraryToolbar kind="videos" search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={cats.data ?? []} /><div className="mt-8">{q.isLoading ? <LoadingGrid kind="video" /> : q.isError ? <StateMessage error title="A área de vídeos está indisponível" body="Tente novamente daqui a pouco." retry={q.refetch} /> : !q.data?.length ? <StateMessage title="Nenhum vídeo corresponde à busca" body="Tente outra frase ou explore todas as categorias." /> : <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{q.data.map(video => <VideoCard key={video.id} video={video} />)}</div>}</div></main></Shell>;
}

type GalleryItem = { id: string; title: string; description: string; category: string; src: string; alt: string };

function GalleryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const imagesQuery = useListImages(undefined, { query: { queryKey: getListImagesQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const downloadName = (item: GalleryItem) => {
    const extension = item.src.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg';
    const safeTitle = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || `imagem-${item.id}`;
    return `${safeTitle}.${extension}`;
  };
  const galleryItems = useMemo<GalleryItem[]>(() => (imagesQuery.data ?? []).map(image => ({
    id: String(image.id),
    title: image.title,
    description: image.description,
    category: image.category,
    src: appUrl(image.imageUrl) ?? image.imageUrl,
    alt: image.alt,
  })), [imagesQuery.data]);
  const categories = ['Todos', ...Array.from(new Set(galleryItems.map(item => item.category)))];
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return galleryItems.filter(item => {
      const matchesCategory = category === 'Todos' || item.category === category;
      const matchesSearch = !query || `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase('pt-BR').includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, galleryItems, search]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-20 pt-14 lg:px-8">
    <div className="mb-10">
      <p className="mono text-[10px] uppercase tracking-[.2em] text-[#075C45]">A sala das imagens</p>
      <h1 className="serif mt-3 text-5xl leading-[.98] tracking-[-.05em] text-[#071B2C] md:text-6xl">Imagens para contemplar.</h1>
      <p className="mt-4 max-w-lg text-[hsl(var(--muted-foreground))]">Uma coleção de imagens para contemplar, compartilhar e levar consigo.</p>
    </div>

    <section className="mt-10" aria-label="Buscar e filtrar imagens">
      <div className="flex flex-col gap-4 border-b border-[#dbe4e2] pb-5 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-[460px]">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#607274]" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar uma lembrança..." aria-label="Buscar imagens" data-testid="input-images-search" className="h-12 w-full rounded-full border border-[#dbe4e2] bg-[#fffdf8] pl-11 pr-4 text-sm outline-none transition focus:border-[#075C45] focus:ring-4 focus:ring-[#075C45]/10" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por categoria">
          {categories.map(itemCategory => <button key={itemCategory} onClick={() => setCategory(itemCategory)} aria-pressed={category === itemCategory} data-testid={`button-images-filter-${itemCategory.toLowerCase()}`} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${category === itemCategory ? 'bg-[#075C45] text-white' : 'bg-[#e9f3ef] text-[#315b55] hover:bg-[#d5e6dd]'}`}>{itemCategory}</button>)}
        </div>
      </div>
    </section>

    <section className="mt-8" aria-live="polite">
      {imagesQuery.isLoading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="skeleton h-64 rounded-2xl" />)}</div> : imagesQuery.isError ? <StateMessage error title="A galeria está indisponível" body="Tente novamente em alguns instantes." retry={imagesQuery.refetch} /> : filteredItems.length === 0 ? <div className="rounded-2xl border border-[#dbe4e2] bg-[#fffdf8] px-6 py-16 text-center" data-testid="state-images-empty"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-[#e9f3ef] text-[#075C45]"><Search size={19} /></div><h2 className="serif text-2xl text-[#071B2C]">Nenhuma imagem encontrada</h2><p className="mx-auto mt-2 max-w-sm text-sm text-[#607274]">Tente outra palavra ou escolha uma categoria diferente.</p><button onClick={() => { setSearch(''); setCategory('Todos'); }} data-testid="button-images-clear-filters" className="mt-5 rounded-full border border-[#dbe4e2] px-4 py-2 text-sm font-semibold text-[#075C45] transition hover:border-[#075C45]">Limpar filtros</button></div> : <div className="grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 md:auto-rows-[200px] lg:grid-cols-4">
        {filteredItems.map((item, index) => <button key={item.id} onClick={() => { trackEvent('image_opened', { content_type: 'image' }); setSelected(item); }} data-testid={`card-image-${item.id}`} aria-label={`Abrir imagem: ${item.title}`} className={`group relative overflow-hidden rounded-2xl border border-[#dbe4e2] bg-[#dfeae4] text-left shadow-[0_5px_16px_rgba(7,27,44,.05)] transition duration-300 hover:-translate-y-1 hover:border-[#75b79f] hover:shadow-[0_14px_30px_rgba(7,27,44,.12)] focus:outline-none focus:ring-4 focus:ring-[#075C45]/20 ${index === 0 ? 'sm:row-span-2 lg:col-span-2 lg:row-span-2' : index === 3 ? 'lg:col-span-2' : ''}`}>
          <img src={item.src} alt={item.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#071b2c]/80 via-[#071b2c]/35 to-transparent px-5 pb-4 pt-12 text-white"><span className="mono block text-[9px] uppercase tracking-[.18em] text-[#d6e6d9]">{item.category}</span><span className="mt-1 block font-semibold">{item.title}</span></span>
          <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#fffdf8]/90 text-[#075C45] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus:opacity-100"><Maximize2 size={15} /></span>
        </button>)}
      </div>}
    </section>
  </main>
  {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b2c]/75 p-4 backdrop-blur-sm" role="presentation" onClick={() => setSelected(null)}>
    <div role="dialog" aria-modal="true" aria-labelledby="gallery-dialog-title" aria-describedby="gallery-dialog-description" className="relative grid max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-2xl bg-[#fffdf8] shadow-2xl md:grid-cols-[1.2fr_.8fr]" onClick={event => event.stopPropagation()}>
      <button onClick={() => setSelected(null)} aria-label="Fechar imagem" data-testid="button-images-close-lightbox" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-[#fffdf8]/90 text-[#071B2C] shadow-sm transition hover:bg-white"><X size={20} /></button>
      <div className="min-h-[280px] bg-[#e7f0eb] md:min-h-[520px]"><img src={selected.src} alt={selected.alt} className="h-full w-full object-cover" /></div>
      <div className="flex flex-col justify-center p-7 md:p-10"><span className="mono text-[10px] uppercase tracking-[.2em] text-[#075C45]">{selected.category}</span><h2 id="gallery-dialog-title" className="serif mt-3 text-4xl leading-tight tracking-[-.04em] text-[#071B2C] md:text-5xl">{selected.title}</h2><p id="gallery-dialog-description" className="mt-4 text-sm leading-7 text-[#607274]">{selected.description}</p><p className="mt-8 border-t border-[#dbe4e2] pt-5 text-xs leading-5 text-[#607274]">Abra espaço para uma pausa. Às vezes, uma imagem é o começo de uma reflexão.</p><div className="mt-7 flex flex-wrap gap-3"><a href={selected.src} download={downloadName(selected)} onClick={() => trackEvent('image_downloaded', { content_type: 'image' })} data-testid="link-images-download" className="inline-flex items-center gap-2 rounded-full bg-[#075C45] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"><Download size={16} /> Baixar imagem</a><button onClick={() => setSelected(null)} data-testid="button-images-lightbox-done" className="inline-flex items-center gap-2 rounded-full border border-[#dbe4e2] px-4 py-2.5 text-sm font-semibold text-[#075C45] transition hover:border-[#075C45]">Voltar à galeria <ArrowLeft size={15} /></button></div></div>
    </div>
  </div>}
  </Shell>;
}

function EventsPage() {
  const eventsQuery = useListEvents({ query: { queryKey: getListEventsQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const events = (eventsQuery.data ?? []).filter(event => event.status === view);
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-20 pt-14 lg:px-8">
    <div className="mb-10">
      <p className="mono text-[10px] uppercase tracking-[.2em] text-[#075C45]">Agenda Nur Al-Sunnah</p>
      <h1 className="serif mt-3 max-w-3xl text-5xl leading-[.98] tracking-[-.05em] text-[#071B2C] md:text-6xl">Encontros para aprender e partilhar.</h1>
      <p className="mt-4 max-w-lg text-[hsl(var(--muted-foreground))]">Acompanhe palestras, aulas e encontros islâmicos publicados pela plataforma Nur Al-Sunnah.</p>
    </div>
    <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-[#dbe4e2] pb-4">
      <button onClick={() => setView('upcoming')} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${view === 'upcoming' ? 'bg-[#075C45] text-white' : 'bg-[#e9f3ef] text-[#315b55]'}`} data-testid="button-events-upcoming">Próximos</button>
      <button onClick={() => setView('past')} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${view === 'past' ? 'bg-[#075C45] text-white' : 'bg-[#e9f3ef] text-[#315b55]'}`} data-testid="button-events-past">Realizados</button>
    </div>
    <section className="mt-8" aria-live="polite">
      {eventsQuery.isLoading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="skeleton h-96 rounded-2xl" />)}</div> : eventsQuery.isError ? <StateMessage error title="Os eventos estão indisponíveis" body="Tente novamente em alguns instantes." retry={eventsQuery.refetch} /> : events.length === 0 ? <StateMessage title={view === 'upcoming' ? 'Ainda não há próximos eventos' : 'Ainda não há eventos realizados'} body={view === 'upcoming' ? 'Volte em breve para acompanhar a próxima agenda.' : 'Os eventos concluídos aparecerão aqui.'} /> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{events.map(event => <EventCard key={event.id} event={event} />)}</div>}
    </section>
  </main></Shell>;
}

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventQuery = useGetEvent(Number(id));
  const event = eventQuery.data;
  if (eventQuery.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><div className="skeleton h-[520px] rounded-3xl" /></main></Shell>;
  if (eventQuery.isError || !event) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="Este evento não está disponível" body="O evento pode ter sido removido ou o link pode estar desatualizado." /></main></Shell>;
  const upcoming = event.status === 'upcoming';
  return <Shell><main className="mx-auto max-w-[1100px] px-5 pb-20 pt-10 lg:px-8">
    <Link href="/events" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-events"><ArrowLeft size={15} /> Voltar aos eventos</Link>
    <div className="mt-8 overflow-hidden rounded-3xl border border-[#dbe4e2] bg-white">
      <div className="grid md:grid-cols-[.9fr_1.1fr]"><EventImage event={event} className="min-h-64 md:min-h-[440px]" /><div className="p-7 md:p-12"><span className="mono text-[10px] uppercase tracking-[.2em] text-[#075C45]">{upcoming ? 'Próximo evento' : 'Evento realizado'}</span><h1 className="serif mt-4 text-4xl leading-tight tracking-[-.04em] text-[#071B2C] md:text-6xl">{event.title}</h1><p className="mt-5 text-base leading-7 text-[#607274]">{event.shortDescription}</p><div className="mt-7 grid gap-4 border-y border-[#dbe4e2] py-5 text-sm text-[#53666b]"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 shrink-0 text-[#075C45]" size={18} /><span><strong className="block text-[#071B2C]">Data e hora</strong>{formatEventDate(event.eventDate)} · {formatEventTime(event)}<small className="mt-1 block text-xs text-[#607274]">{event.timezone}</small></span></div><div className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[#075C45]" size={18} /><span><strong className="block text-[#071B2C]">{event.venue}</strong>{event.address}, {event.city}</span></div></div>{upcoming && <div className="mt-6"><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#075C45]">Começa em</p><Countdown target={event.startsAt} /></div>}<div className="mt-7 flex flex-wrap gap-3"><a href={event.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#075C45] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110" data-testid="link-event-map"><MapPin size={15} /> Abrir no Google Maps <ExternalLink size={14} /></a>{event.externalUrl && <a href={event.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dbe4e2] px-4 py-2.5 text-sm font-semibold text-[#075C45] transition hover:border-[#075C45]" data-testid="link-event-external">Mais informações <ExternalLink size={14} /></a>}</div></div></div>
      <div className="border-t border-[#dbe4e2] px-7 py-8 md:px-12"><h2 className="serif text-3xl text-[#071B2C]">Sobre este evento</h2><p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-8 text-[#607274]">{event.fullDescription}</p></div>
    </div>
  </main></Shell>;
}

function BookDetail() {
  const { id } = useParams<{ id: string }>(); const bookId = Number(id); const q = useGetBook(bookId); const [requested, setRequested] = useState(false); const [saved, setSaved] = useState(false); const dl = useGetBookDownload(bookId, { query: { enabled: requested, queryKey: getGetBookDownloadQueryKey(bookId) } });
  const book = q.data;
  const downloadableType = book && (book.fileType === 'PDF' || book.fileType === 'TXT') ? 'PDF' : book?.fileType;
  const canDownload = Boolean(book?.fileUrl);
  const download = () => { trackEvent('book_download_started', { content_type: 'book' }); setRequested(true); };
  useEffect(() => {
    try {
      const savedBooks = JSON.parse(window.localStorage.getItem(savedBooksStorageKey) ?? '[]');
      setSaved(Array.isArray(savedBooks) && savedBooks.includes(bookId));
    } catch {
      setSaved(false);
    }
  }, [bookId]);
  const toggleSaved = () => {
    try {
      const savedBooks = JSON.parse(window.localStorage.getItem(savedBooksStorageKey) ?? '[]');
      const current = Array.isArray(savedBooks) ? savedBooks.filter((value): value is number => typeof value === 'number') : [];
      const next = current.includes(bookId) ? current.filter(value => value !== bookId) : [...current, bookId];
      window.localStorage.setItem(savedBooksStorageKey, JSON.stringify(next));
      setSaved(next.includes(bookId));
      trackEvent(next.includes(bookId) ? 'book_saved' : 'book_unsaved', { content_type: 'book', book_id: bookId });
    } catch {
      setSaved(value => !value);
    }
  };
  useEffect(() => {
    if (dl.data?.url) window.location.assign(appUrl(dl.data.url) ?? dl.data.url);
  }, [dl.data?.url]);
  if (q.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><LoadingGrid /></main></Shell>;
  if (q.isError || !book) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="Este título não está na estante" body="Ele pode ter sido movido ou o link pode estar desatualizado." /></main></Shell>;
  return <Shell><main className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 lg:px-8"><Link href="/books" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-books"><ArrowLeft size={15} /> Voltar aos livros</Link><div className="grid gap-10 py-12 md:grid-cols-[280px_1fr] md:gap-16"><Cover book={book} large /><div className="pt-2"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{book.category} · {downloadableType}</p><h1 className="serif mt-4 text-5xl leading-[.98] tracking-[-.04em] md:text-6xl">{book.title}</h1><p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">Por {book.author}</p><p className="mt-8 max-w-xl text-[15px] leading-8 text-[hsl(var(--muted-foreground))]">{book.description}</p><div className="mt-8 flex flex-wrap items-center gap-3"><Button onClick={download} disabled={!canDownload || dl.isLoading}>{!canDownload ? 'PDF indisponível' : dl.isLoading ? `Preparando ${downloadableType}…` : <><Download size={16} /> Baixar {downloadableType}</>}</Button>{canDownload && <a href={`${basePath}/books/${book.id}/read`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--secondary-foreground))] transition-all duration-200 hover:bg-[hsl(var(--border))]" data-testid="link-book-read"><BookOpen size={16} /> Ler</a>}<Button onClick={toggleSaved} variant="soft" ariaLabel={saved ? 'Remover dos itens guardados' : 'Guardar para depois'} ariaPressed={saved} dataTestId="button-save-book"><Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Guardado' : 'Guardar para depois'}</Button></div>{dl.isError && <p className="mt-3 text-sm text-[hsl(var(--destructive))]">Não foi possível preparar o download. Tente novamente.</p>}{!canDownload && <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Este livro ainda não possui um arquivo disponível.</p>}<div className="mt-8 flex gap-6 border-t border-[hsl(var(--border))] pt-5 text-xs text-[hsl(var(--muted-foreground))]"><span>{book.fileSize ? `${(book.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Arquivo digital'}</span><span>{book.downloadCount.toLocaleString()} downloads</span></div></div></div></main></Shell>;
}

function PdfReader({ url, title }: { url: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    const loadingTask = getDocument({ url });
    setPdf(null);
    setPageNumber(1);
    setPageCount(0);
    setIsLoading(true);
    setError(false);
    loadingTask.promise.then(documentProxy => {
      if (disposed) {
        return;
      }
      setPdf(documentProxy);
      setPageCount(documentProxy.numPages);
      setIsLoading(false);
    }).catch(() => {
      if (!disposed) {
        setIsLoading(false);
        setError(true);
      }
    });
    return () => {
      disposed = true;
      void loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let disposed = false;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;
    setIsPageLoading(true);
    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (disposed || !canvasRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(920, Math.max(280, window.innerWidth - 56));
        const scale = Math.min(1.5, maxWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        renderTask = page.render({
          canvas,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (!disposed) setIsPageLoading(false);
      } catch {
        if (!disposed) {
          setIsPageLoading(false);
          setError(true);
        }
      }
    };
    void renderPage();
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  return <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] shadow-[0_12px_35px_rgba(7,27,44,.08)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <p className="text-sm font-semibold" data-testid="text-reader-title">{title}</p>
      {pdf && <div className="flex items-center gap-2"><button type="button" onClick={() => setPageNumber(current => Math.max(1, current - 1))} disabled={pageNumber <= 1 || isPageLoading} className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-semibold transition hover:bg-[hsl(var(--border))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-reader-previous">Anterior</button><span className="min-w-[108px] text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-reader-page">Página {pageNumber} de {pageCount}</span><button type="button" onClick={() => setPageNumber(current => Math.min(pageCount, current + 1))} disabled={pageNumber >= pageCount || isPageLoading} className="rounded-full bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-reader-next">Próxima</button></div>}
    </div>
    <div className="flex min-h-[520px] justify-center overflow-auto p-4 md:p-8">
      {isLoading ? <div className="flex min-h-[460px] items-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="status-reader-loading">Carregando o livro…</div> : error ? <div className="flex min-h-[460px] max-w-sm flex-col items-center justify-center text-center"><FileText className="text-[hsl(var(--muted-foreground))]" size={28} /><p className="mt-4 font-semibold">Não foi possível abrir este livro.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Tente baixar o PDF para continuar a leitura.</p></div> : <div className="relative"><canvas ref={canvasRef} aria-label={`Página ${pageNumber} de ${title}`} className="block max-w-full rounded-sm bg-white shadow-md" data-testid="canvas-reader-page" />{isPageLoading && <span className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-[10px] font-semibold text-[hsl(var(--primary-foreground))]">Renderizando…</span>}</div>}
    </div>
  </div>;
}

function BookReader() {
  const { id } = useParams<{ id: string }>(); const bookId = Number(id); const q = useGetBook(bookId); const book = q.data;
  const canRead = Boolean(book?.fileUrl && (book.fileType === 'PDF' || book.fileType === 'TXT'));
  if (q.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><LoadingGrid /></main></Shell>;
  if (q.isError || !book) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="Este título não está na estante" body="Ele pode ter sido movido ou o link pode estar desatualizado." /></main></Shell>;
  const readerUrl = `${basePath}/api/books/${book.id}/read/file`;
  const downloadUrl = `${basePath}/api/books/${book.id}/download/file`;
  return <Shell><main className="mx-auto max-w-[1180px] px-5 pb-16 pt-8 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><Link href={`/books/${book.id}`} className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-book-detail"><ArrowLeft size={15} /> Voltar ao livro</Link><div className="flex flex-wrap items-center gap-2"><Button href={`/books/${book.id}`} variant="soft"><Info size={15} /> Detalhes</Button>{book.fileUrl && <a href={downloadUrl} download className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all duration-200 hover:brightness-110" data-testid="link-reader-download"><Download size={15} /> Baixar PDF</a>}</div></div><div className="py-8"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Leitor digital · {book.category}</p><h1 className="serif mt-3 max-w-4xl text-4xl leading-tight tracking-[-.04em] md:text-5xl">{book.title}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Por {book.author}</p></div>{canRead ? <PdfReader url={readerUrl} title={book.title} /> : <StateMessage title="Leitura indisponível" body="Este livro ainda não possui um arquivo compatível para leitura no app." />}</main></Shell>;
}

function VideoDetail() {
  const { id } = useParams<{ id: string }>(); const videoId = Number(id); const q = useGetVideo(videoId); const [requested, setRequested] = useState(false); const dl = useGetVideoDownload(videoId, { query: { enabled: requested, queryKey: getGetVideoDownloadQueryKey(videoId) } }); const video = q.data;
  useEffect(() => {
    if (dl.data?.url) window.location.assign(appUrl(dl.data.url) ?? dl.data.url);
  }, [dl.data?.url]);
  if (q.isLoading) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><LoadingGrid kind="video" /></main></Shell>;
  if (q.isError || !video) return <Shell><main className="mx-auto max-w-5xl px-5 py-20"><StateMessage error title="Este vídeo não está disponível" body="Ele pode ter sido movido ou o link pode estar desatualizado." /></main></Shell>;
  const canDownload = Boolean(video.downloadEnabled && video.videoUrl);
  return <Shell><main className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 lg:px-8"><Link href="/videos" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]" data-testid="link-back-videos"><ArrowLeft size={15} /> Voltar aos vídeos</Link><div className="pt-10"><div className="relative overflow-hidden rounded-2xl bg-[hsl(190_27%_22%)]">{video.videoUrl ? <video src={appUrl(video.videoUrl)} controls poster={appUrl(video.thumbnailUrl)} className="aspect-video w-full" /> : <VideoThumb video={video} large />}</div><div className="grid gap-8 py-9 md:grid-cols-[1fr_260px]"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{video.category} · {video.duration}</p><h1 className="serif mt-3 text-4xl leading-tight md:text-5xl">{video.title}</h1><p className="mt-5 max-w-2xl text-[15px] leading-8 text-[hsl(var(--muted-foreground))]">{video.description}</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.6)] p-5"><p className="text-sm font-semibold">Disponibilidade</p><Button variant="outline" className="mt-5 w-full" onClick={() => { trackEvent('video_download_started', { content_type: 'video' }); setRequested(true); }} disabled={!canDownload || dl.isLoading}>{!canDownload ? 'MP4 indisponível' : dl.isLoading ? 'Preparando MP4…' : <><Download size={15} /> Baixar MP4</>}</Button>{dl.isError && <p className="mt-3 text-xs leading-5 text-[hsl(var(--destructive))]">Não foi possível preparar o MP4. Tente novamente.</p>}</div></div></div></main></Shell>;
}

function Categories() {
  const q = useListCategories();
  return <Shell><main className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 lg:px-8"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Formas de entrar</p><h1 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Siga um caminho.</h1><p className="mt-5 max-w-xl text-[hsl(var(--muted-foreground))]">Comece por um assunto e veja onde ele leva. Cada categoria reúne livros e vídeos.</p><div className="mt-12">{q.isLoading ? <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(i => <div className="skeleton h-36 rounded-2xl" key={i} />)}</div> : q.isError ? <StateMessage error title="As categorias estão indisponíveis" body="Tente novamente daqui a pouco." retry={q.refetch} /> : <div className="grid gap-4 md:grid-cols-2">{(q.data ?? []).map((c, i) => <div key={c.name} className="hover-lift group flex items-end justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6" data-testid={`card-category-${c.name}`}><div><span className="mono text-xs text-[hsl(var(--accent))]">0{i + 1}</span><h2 className="serif mt-5 text-3xl">{c.name}</h2></div><div className="flex gap-2"><Button href={`/books?category=${encodeURIComponent(c.name)}`} variant="soft">{c.bookCount} livros</Button><Button href={`/videos?category=${encodeURIComponent(c.name)}`} variant="ghost">{c.videoCount} vídeos <ArrowRight size={14} /></Button></div></div>)}</div>}</div></main></Shell>;
}

function About() {
  return <Shell><main className="mx-auto max-w-[1000px] px-5 pb-16 pt-16 lg:px-8">
    <div className="max-w-4xl">
      <p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Sobre Nós</p>
      <h1 className="serif mt-4 text-6xl leading-[.95] tracking-[-.05em] md:text-8xl">Nur Al-Sunnah</h1>
      <div className="mt-10 space-y-6 text-base leading-8 text-[hsl(var(--muted-foreground))]">
        <p>Nur Al-Sunnah, fundada por Sheikh Jumma Momade Anli, é uma plataforma digital dedicada à divulgação e ao acesso ao conhecimento islâmico. O seu objetivo é tornar conteúdos de benefício mais acessíveis, reunindo num só espaço livros, vídeos, áudios, artigos, palestras, aulas e outros materiais islâmicos.</p>
        <p>A plataforma foi criada para proporcionar um ambiente simples e organizado, onde qualquer pessoa possa aprender, estudar, pesquisar e aprofundar os seus conhecimentos sobre o Islão, independentemente da sua localização.</p>
        <p>Através da tecnologia, Nur Al-Sunnah procura preservar, organizar e divulgar o conhecimento islâmico, aproximando as pessoas de conteúdos que possam contribuir para a aprendizagem, reflexão e compreensão da religião.</p>
        <p className="border-t border-[hsl(var(--border))] pt-6 font-semibold text-[hsl(var(--accent))]">Nur Al-Sunnah — Conhecimento, Sunnah e orientação para todos.</p>
      </div>
    </div>
  </main></Shell>;
}

  function LegalPage({ type }: { type: 'terms' | 'policy' }) { const policy = type === 'policy'; return <Shell><main className="mx-auto max-w-[900px] px-5 pb-16 pt-16 lg:px-8"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{policy ? 'Direitos autorais e distribuição' : 'Informações legais'}</p><h1 className="serif mt-4 text-6xl tracking-[-.04em]">{policy ? 'Política de conteúdo' : 'Termos de uso'}</h1><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Última atualização: 14 de fevereiro de 2024</p><div className="prose prose-stone mt-12 max-w-none prose-headings:font-[var(--app-font-serif)] prose-headings:font-medium prose-p:text-[hsl(var(--muted-foreground))] prose-p:leading-8"><h2>{policy ? 'Em resumo' : 'Bem-vindo à plataforma Nur Al-Sunnah'}</h2><p>{policy ? 'A plataforma Nur Al-Sunnah é uma camada de descoberta e acesso a materiais que podem ser compartilhados legalmente. Não somos um espaço para hospedagem indiscriminada de arquivos e não disponibilizamos conscientemente obras protegidas por direitos autorais sem autorização.' : 'A plataforma Nur Al-Sunnah é uma biblioteca digital selecionada e mantida como um projeto de interesse público. Ao utilizar o site, você concorda em usar os materiais de forma legal e respeitar os direitos de autores, cineastas, editoras e colaboradores.'}</p><h2>{policy ? 'O que aceitamos' : 'Uso da coleção'}</h2><p>{policy ? 'Obras em domínio público, obras com licença Creative Commons ou outras licenças abertas e materiais fornecidos pelo titular dos direitos ou por um representante autorizado. Registramos a fonte e os termos de distribuição quando um item é adicionado.' : 'Você pode navegar, assistir e baixar materiais de acordo com as permissões associadas a cada item. Não redistribua, venda ou altere uma obra quando a licença não permitir essas ações.'}</p><h2>{policy ? 'Tem uma preocupação sobre um item?' : 'Nossas responsabilidades'}</h2><p>{policy ? 'Envie um relato com o título, a URL específica, sua relação com a obra e uma explicação objetiva. Analisamos relatos completos com agilidade e podemos restringir o acesso enquanto investigamos.' : 'Trabalhamos para manter as descrições corretas e os links funcionais, mas a coleção é fornecida no estado em que se encontra. Se encontrar um erro, link quebrado ou preocupação relacionada a direitos, entre em contato com a equipe da biblioteca.'}</p><h2>Contato</h2><p>Para relatar uma questão de direitos autorais ou tirar dúvidas sobre estes termos, acesse a página de contato. Não envie senhas nem informações de pagamento.</p></div></main></Shell>; }

function Contact() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Relato de direitos autorais');
  const [message, setMessage] = useState('');
  const submitMessage = useCreateContactMessage();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    submitMessage.mutate({ data: { email, topic, message } }, {
      onSuccess: () => {
        setEmail('');
        setTopic('Relato de direitos autorais');
        setMessage('');
        setSent(true);
      },
    });
  };

  return <Shell><main className="mx-auto grid max-w-[1000px] gap-14 px-5 pb-16 pt-16 md:grid-cols-[.85fr_1fr] lg:px-8"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Fale conosco</p><h1 className="serif mt-4 text-6xl leading-[.95] tracking-[-.05em]">Uma estante sempre correta.</h1><p className="mt-6 text-[hsl(var(--muted-foreground))]">Encontrou um link quebrado, quer sugerir uma obra ou precisa relatar uma preocupação com direitos autorais? Use o formulário ao lado para enviar sua mensagem.</p><div className="mt-10 border-t border-[hsl(var(--border))] pt-5 text-sm"><p className="font-semibold">Direitos autorais</p><p className="mt-1 text-[hsl(var(--muted-foreground))]">Use o formulário ao lado para enviar uma mensagem sobre direitos autorais, sugestões ou links quebrados.</p></div></div><form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8">{sent ? <div className="py-12 text-center"><Check className="mx-auto text-[hsl(var(--primary))]" size={30} /><h2 className="serif mt-5 text-3xl">Obrigado pelo contato.</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">A sua mensagem foi recebida pela equipe da biblioteca.</p><Button onClick={() => setSent(false)} variant="soft" className="mt-6">Enviar outra</Button></div> : <><label className="text-sm font-semibold">Seu e-mail<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-contact-email" /></label><label className="mt-5 block text-sm font-semibold">Como podemos ajudar?<select value={topic} onChange={event => setTopic(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm outline-none" data-testid="select-contact-type"><option>Relato de direitos autorais</option><option>Sugerir um livro ou vídeo</option><option>Link quebrado ou metadados</option><option>Outro assunto</option></select></label><label className="mt-5 block text-sm font-semibold">Sua mensagem<textarea required rows={5} value={message} onChange={event => setMessage(event.target.value)} className="mt-2 w-full resize-none rounded-lg border bg-transparent p-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="textarea-contact-message" /></label>{submitMessage.isError && <p className="mt-4 text-sm text-[hsl(var(--destructive))]" role="alert">Não foi possível enviar a mensagem. Tente novamente.</p>}<Button type="submit" disabled={submitMessage.isPending} className="mt-6 w-full">{submitMessage.isPending ? 'Enviando…' : <>Enviar mensagem <Send size={15} /></>}</Button></>}</form></main></Shell>;
}

function AuthPage({ signUp = false }: { signUp?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  return <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] md:grid-cols-[.85fr_1.15fr]"><div className="hidden bg-[hsl(var(--primary))] p-10 text-[hsl(var(--primary-foreground))] md:flex md:flex-col md:justify-between"><Logo /><div><p className="mono text-[10px] uppercase tracking-[.2em] opacity-70">Uma estante só sua</p><p className="serif mt-4 max-w-md text-5xl leading-tight">Guarde os bons.</p><p className="mt-5 max-w-sm text-sm leading-7 opacity-70">Reserve um canto tranquilo na plataforma Nur Al-Sunnah para os livros e vídeos aos quais você quer voltar.</p></div><p className="text-xs opacity-60">Nur Al-Sunnah · Biblioteca digital</p></div><div className="flex items-center justify-center p-5"><div className="w-full max-w-[390px]"><div className="mb-10 md:hidden"><Logo /></div>{submitted ? <div className="text-center"><Check className="mx-auto text-[hsl(var(--primary))]" size={30} /><h1 className="serif mt-5 text-4xl">{signUp ? 'Você está na lista.' : 'Bem-vindo de volta.'}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">A autenticação está pronta para se conectar à sua conta Clerk.</p><Button href="/" className="mt-7 w-full">Voltar à biblioteca</Button></div> : <><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{signUp ? 'Entrar na biblioteca' : 'Acesso de membro'}</p><h1 className="serif mt-3 text-5xl">{signUp ? 'Crie um espaço para isso.' : 'Bom ver você.'}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{signUp ? 'Crie uma conta para guardar títulos e montar sua própria lista de leitura.' : 'Entre para continuar de onde parou.'}</p><form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="mt-8"><label className="text-sm font-semibold">Endereço de e-mail<input required type="email" className="mt-2 h-12 w-full rounded-lg border bg-[hsl(var(--card))] px-3 outline-none focus:border-[hsl(var(--primary))]" data-testid="input-auth-email" /></label><label className="mt-4 block text-sm font-semibold">Palavra-passe<input required type="password" className="mt-2 h-12 w-full rounded-lg border bg-[hsl(var(--card))] px-3 outline-none focus:border-[hsl(var(--primary))]" data-testid="input-auth-password" /></label><Button type="submit" className="mt-6 w-full">{signUp ? 'Criar conta' : 'Entrar'} <ArrowRight size={15} /></Button></form><p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{signUp ? 'Já tem uma conta? ' : 'É novo na biblioteca Nur Al-Sunnah? '}<Link href={signUp ? '/sign-in' : '/sign-up'} className="font-semibold text-[hsl(var(--primary))]" data-testid="link-auth-switch">{signUp ? 'Entrar' : 'Criar uma conta'}</Link></p></>}</div></div></div>;
}

function AdminLogin() {
  const { isSignedIn } = useAuth();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-5"><div className="w-full max-w-[420px] rounded-3xl bg-[hsl(var(--card))] p-7 shadow-xl md:p-10"><Logo /><p className="mono mt-12 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Acesso da equipe</p><h1 className="serif mt-3 text-4xl">Por trás da estante.</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">O catálogo é destinado aos colaboradores da plataforma Nur Al-Sunnah. Entre com sua conta autorizada para continuar.</p><Button href={isSignedIn ? '/admin' : '/sign-in'} className="mt-8 w-full">{isSignedIn ? 'Entrar no painel' : 'Continuar para o acesso seguro'} <ArrowRight size={15} /></Button><Link href="/" className="mt-6 block text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="link-admin-back">Voltar à biblioteca pública</Link></div></div>;
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <div className="rounded-xl border border-[hsl(var(--border))] bg-white p-5 shadow-[var(--shadow-sm)] transition-all hover:border-[hsl(var(--primary)/.4)] hover:shadow-md">
    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
      <span className="text-[hsl(var(--primary))]">
        {icon}
      </span>
      <span className="mono text-[10px] uppercase tracking-[.12em]">{label}</span>
    </div>
    <div className="mt-3">
      <p className="serif text-3xl font-medium text-[hsl(var(--foreground))]">{value}</p>
    </div>
  </div>;
}

type EditorState = { kind: 'book' | 'video'; id?: number; title: string; author?: string; description: string; category: string; coverUrl?: string; fileUrl?: string; fileType?: BookInput['fileType']; fileSize?: number; duration?: string; thumbnailUrl?: string; videoUrl?: string; downloadEnabled?: boolean; featured?: boolean };
const emptyBook: EditorState = { kind: 'book', title: '', author: 'Autor não informado', description: 'Livro digital para leitura e estudo.', category: 'Islam', coverUrl: '', fileUrl: '', fileType: 'PDF', fileSize: 0, featured: false };
const emptyVideo: EditorState = { kind: 'video', title: '', description: '', category: '', thumbnailUrl: '', videoUrl: '', duration: '', downloadEnabled: false, featured: false };
type EventDraft = { id?: number; title: string; shortDescription: string; fullDescription: string; eventDate: string; startTime: string; endTime: string; timezone: string; imageId: number | null; venue: string; city: string; address: string; mapsUrl: string; externalUrl: string; published: boolean };
const emptyEvent: EventDraft = { title: '', shortDescription: '', fullDescription: '', eventDate: '', startTime: '18:00', endTime: '20:00', timezone: 'Africa/Maputo', imageId: null, venue: '', city: '', address: '', mapsUrl: '', externalUrl: '', published: false };

const bookFileType = (name: string): BookInput['fileType'] => {
  const extension = name.split('.').pop()?.toUpperCase();
  return extension === 'EPUB' || extension === 'MOBI' || extension === 'TXT' ? extension : 'PDF';
};

const bookTitleFromFilename = (name: string) => {
  const title = name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return title || 'Livro sem título';
};

const extractBookMetadata = async (file: File): Promise<Pick<EditorState, 'title' | 'author' | 'description' | 'category' | 'fileType'>> => {
  const defaults = {
    title: bookTitleFromFilename(file.name),
    author: 'Autor não informado',
    description: 'Livro digital para leitura e estudo.',
    category: 'Islam',
    fileType: bookFileType(file.name),
  } satisfies Pick<EditorState, 'title' | 'author' | 'description' | 'category' | 'fileType'>;

  if (defaults.fileType !== 'PDF') return defaults;

  try {
    const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
    const metadata = await pdf.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    const value = (key: string) => typeof info[key] === 'string' && info[key] ? String(info[key]).trim() : '';
    const title = value('Title');
    const author = value('Author');
    const subject = value('Subject');
    return {
      ...defaults,
      title: title || defaults.title,
      author: author || defaults.author,
      description: subject || defaults.description,
    };
  } catch {
    return defaults;
  }
};

const renderPdfCover = async (file: File): Promise<Blob> => {
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create cover canvas');
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode cover image')), 'image/jpeg', 0.88);
  });
};

const formatVideoDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}` : `${minutes}:${String(remaining).padStart(2, '0')}`;
};

const extractVideoMetadata = async (file: File): Promise<{ title: string; duration: string }> => {
  const source = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = source;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Could not read video metadata'));
    });
    return { title: bookTitleFromFilename(file.name), duration: formatVideoDuration(duration) };
  } finally {
    URL.revokeObjectURL(source);
  }
};

const renderVideoCover = async (file: File): Promise<Blob> => {
  const source = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = source;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) / 2));
      };
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Could not render video cover'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create cover canvas');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode video cover')), 'image/jpeg', 0.88);
    });
  } finally {
    URL.revokeObjectURL(source);
  }
};

function CatalogEditor({ state, setState, close, refresh }: { state: EditorState; setState: (action: SetStateAction<EditorState>) => void; close: () => void; refresh: () => void }) {
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();
  const createVideo = useCreateVideo();
  const updateVideo = useUpdateVideo();
  const upload = useRequestUploadUrl();
  const galleryImages = useListImages(undefined, { query: { queryKey: getListImagesQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const [uploading, setUploading] = useState<'cover' | 'file' | 'video' | 'thumbnail' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const patch = (key: keyof EditorState, value: string | boolean) => setState(current => ({ ...current, [key]: value }));

  const uploadObject = async (file: Blob, name: string, contentType: string) => {
    const result = await upload.mutateAsync({
      data: {
        name,
        size: file.size,
        contentType,
      },
    });
    const response = await fetch(result.uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!response.ok) throw new Error('Upload failed');
    return result.objectPath;
  };

  const uploadFile = async (file: File, field: 'coverUrl' | 'fileUrl' | 'videoUrl' | 'thumbnailUrl') => {
    setUploadError('');
    setUploading(field === 'coverUrl' || field === 'thumbnailUrl' ? 'cover' : field === 'videoUrl' ? 'video' : 'file');
    try {
      let metadata: Partial<Pick<EditorState, 'title' | 'author' | 'description' | 'category' | 'fileType' | 'duration'>> | null = null;
      if (field === 'fileUrl' && state.kind === 'book') {
        metadata = await extractBookMetadata(file);
      }
      if (field === 'videoUrl' && state.kind === 'video') {
        const videoMetadata = await extractVideoMetadata(file);
        metadata = { ...videoMetadata, description: 'Vídeo para aprendizagem, reflexão e benefício.', category: 'Islam' };
      }
      const objectPath = await uploadObject(file, file.name, file.type || 'application/octet-stream');
      let coverPath: string | null = null;
      const shouldGenerateCover = field === 'fileUrl' && state.kind === 'book' && !state.coverUrl && metadata?.fileType === 'PDF';
      const shouldGenerateVideoCover = field === 'videoUrl' && state.kind === 'video' && !state.thumbnailUrl;
      if (shouldGenerateCover) {
        try {
          const coverBlob = await renderPdfCover(file);
          coverPath = await uploadObject(coverBlob, `${file.name}.cover.jpg`, 'image/jpeg');
        } catch {
          setUploadError('Arquivo enviado, mas não foi possível gerar a capa automática.');
        }
      }
      if (shouldGenerateVideoCover) {
        try {
          const coverBlob = await renderVideoCover(file);
          coverPath = await uploadObject(coverBlob, `${file.name}.cover.jpg`, 'image/jpeg');
        } catch {
          setUploadError('Vídeo enviado, mas não foi possível gerar a capa automática. Você pode escolher uma capa da galeria.');
        }
      }
      setState(current => ({
        ...current,
        ...(metadata ?? {}),
        [field]: `/api/storage${objectPath}`,
        ...(field === 'fileUrl' ? { fileSize: file.size } : {}),
        ...(coverPath ? { [state.kind === 'video' ? 'thumbnailUrl' : 'coverUrl']: `/api/storage${coverPath}` } : {}),
      }));
    } catch {
      setUploadError('Não foi possível enviar o arquivo. Tente novamente.');
    } finally {
      setUploading(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (state.kind === 'book') {
      const data: BookInput = {
        title: state.title,
        author: state.author ?? '',
        description: state.description,
        category: state.category,
        coverUrl: state.coverUrl || null,
        fileUrl: state.fileUrl || null,
        fileType: state.fileType ?? 'PDF',
        fileSize: Number(state.fileSize) || 0,
        featured: state.featured,
      };
      const done = () => { refresh(); close(); };
      state.id ? updateBook.mutate({ id: state.id, data }, { onSuccess: done, onError: () => setSaveError('Não foi possível atualizar o livro. Verifique os campos e tente novamente.') }) : createBook.mutate({ data }, { onSuccess: done, onError: () => setSaveError('Não foi possível criar o livro. Verifique os campos e tente novamente.') });
    } else {
      const data: VideoInput = {
        title: state.title,
        description: state.description,
        category: state.category,
        thumbnailUrl: state.thumbnailUrl || null,
        videoUrl: state.videoUrl || null,
        duration: state.duration ?? '',
        downloadEnabled: state.downloadEnabled,
        featured: state.featured,
      };
      const done = () => { refresh(); close(); };
      state.id ? updateVideo.mutate({ id: state.id, data }, { onSuccess: done, onError: () => setSaveError('Não foi possível atualizar o vídeo. Verifique os campos e tente novamente.') }) : createVideo.mutate({ data }, { onSuccess: done, onError: () => setSaveError('Não foi possível criar o vídeo. Verifique os campos e tente novamente.') });
    }
  };

  const busy = createBook.isPending || updateBook.isPending || createVideo.isPending || updateVideo.isPending || uploading !== null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[hsl(193_25%_19%/.52)] p-4">
    <form onSubmit={submit} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[hsl(var(--card))] p-6 shadow-xl">
       <div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">{state.id ? 'Editar item' : 'Novo item'}</p><h2 className="serif mt-1 text-3xl">{state.kind === 'book' ? 'Adicionar livro' : 'Adicionar vídeo'}</h2></div><button type="button" onClick={close} data-testid="button-close-editor"><X size={20} /></button></div>
      <div className="mt-6 grid gap-4">
         <label className="text-sm font-semibold">Título<input required value={state.title} onChange={e => patch('title', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-title" /></label>
         {state.kind === 'book' && <label className="text-sm font-semibold">Autor<input required value={state.author} onChange={e => patch('author', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-author" /></label>}
        <div className="grid gap-4 sm:grid-cols-2">
           <label className="text-sm font-semibold">Categoria<input required value={state.category} onChange={e => patch('category', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-category" /></label>
           {state.kind === 'book' ? <label className="text-sm font-semibold">Formato<select value={state.fileType} onChange={e => patch('fileType', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="select-editor-format"><option>PDF</option><option>EPUB</option><option>MOBI</option><option>TXT</option></select></label> : <label className="text-sm font-semibold">Duração<input required value={state.duration} onChange={e => patch('duration', e.target.value)} placeholder="38 min" className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-duration" /></label>}
        </div>
         <label className="text-sm font-semibold">Descrição<textarea required rows={4} value={state.description} onChange={e => patch('description', e.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm" data-testid="textarea-editor-description" /></label>
        {state.kind === 'book' ? <div className="grid gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud size={15} />Capa do livro</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-2 block w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadFile(file, 'coverUrl'); }} data-testid="input-editor-cover-upload" /><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{uploading === 'cover' ? 'Enviando capa…' : state.coverUrl ? 'Capa pronta para salvar' : 'JPG, PNG ou WebP'}</span></label>
          <label className="text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud size={15} />Arquivo do livro</span><input type="file" accept=".pdf,.epub,.mobi,.txt,application/pdf,application/epub+zip,text/plain" disabled={busy} className="mt-2 block w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadFile(file, 'fileUrl'); }} data-testid="input-editor-file-upload" /><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{uploading === 'file' ? 'Enviando arquivo…' : state.fileUrl ? 'Arquivo pronto para salvar' : 'PDF, EPUB, MOBI ou TXT'}</span></label>
        </div> : <div className="grid gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] p-4">
           <label className="text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud size={15} />Arquivo de vídeo</span><input type="file" accept="video/*,.mp4,.webm,.mov" disabled={busy} className="mt-2 block w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadFile(file, 'videoUrl'); }} data-testid="input-editor-video-upload" /><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{uploading === 'video' ? 'Enviando vídeo e criando capa…' : state.videoUrl ? 'Vídeo pronto para salvar' : 'Envie um vídeo para gerar o título e a duração'}</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
             <label className="text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud size={15} />Enviar capa</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} className="mt-2 block w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadFile(file, 'thumbnailUrl'); }} data-testid="input-editor-video-cover-upload" /><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{uploading === 'cover' ? 'Enviando capa…' : state.thumbnailUrl ? 'Capa pronta' : 'Opcional se for usado o primeiro frame do vídeo'}</span></label>
             <label className="text-sm font-semibold">Escolher da galeria<select value={state.thumbnailUrl ?? ''} onChange={e => patch('thumbnailUrl', e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="select-editor-video-gallery-cover"><option value="">Usar capa gerada</option>{(galleryImages.data ?? []).map(image => <option key={image.id} value={image.imageUrl}>{image.title}</option>)}</select><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">Selecione uma imagem pública existente para a capa.</span></label>
          </div>
           {state.thumbnailUrl && <img src={state.thumbnailUrl} alt="Pré-visualização da capa do vídeo" className="max-h-48 w-full rounded-xl object-contain bg-[hsl(var(--secondary))]" />}
        </div>}
          {(uploadError || saveError) && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{saveError || uploadError}</p>}
         <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.featured ?? false} onChange={e => patch('featured', e.target.checked)} data-testid="checkbox-editor-featured" /> Destacar este item</label>
         {state.kind === 'video' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.downloadEnabled ?? false} onChange={e => patch('downloadEnabled', e.target.checked)} data-testid="checkbox-editor-download" /> Permitir downloads</label>}
      </div>
       <div className="mt-7 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar no catálogo'}</Button></div>
    </form>
  </div>;
}

type ImageDraft = { id?: number; title: string; description: string; category: string; imageUrl: string; alt: string; featured?: boolean };
const emptyImage: ImageDraft = { title: '', description: 'Imagem para contemplação, reflexão e lembrança.', category: 'Islam', imageUrl: '', alt: '', featured: false };

function ImageEditor({ image, close, refresh }: { image?: Image; close: () => void; refresh: () => void }) {
  const [draft, setDraft] = useState<ImageDraft>(image ? { id: image.id, title: image.title, description: image.description, category: image.category, imageUrl: image.imageUrl, alt: image.alt, featured: image.featured } : emptyImage);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const upload = useRequestImageUploadUrl();
  const create = useCreateImage();
  const update = useUpdateImage();

  const chooseFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const title = bookTitleFromFilename(file.name);
      const result = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const response = await fetch(result.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      setDraft(current => ({ ...current, title, alt: title, imageUrl: `/api/storage${result.objectPath}` }));
    } catch {
      setError('Não foi possível enviar a imagem. Use JPG, PNG ou WebP de até 10 MB.');
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.imageUrl) {
      setError('Selecione uma imagem antes de salvar.');
      return;
    }
    const data: ImageInput = { title: draft.title, description: draft.description, category: draft.category || 'Islam', imageUrl: draft.imageUrl, alt: draft.alt || draft.title, featured: draft.featured };
    const done = () => { refresh(); close(); };
    draft.id ? update.mutate({ id: draft.id, data }, { onSuccess: done, onError: () => setError('Não foi possível atualizar a imagem. Verifique os campos e tente novamente.') }) : create.mutate({ data }, { onSuccess: done, onError: () => setError('Não foi possível criar a imagem. Verifique os campos e tente novamente.') });
  };

  const busy = uploading || create.isPending || update.isPending;
   return <div className="fixed inset-0 z-50 grid place-items-center bg-[hsl(193_25%_19%/.52)] p-4"><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[hsl(var(--card))] p-6 shadow-xl"><div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">{draft.id ? 'Editar imagem' : 'Nova imagem'}</p><h2 className="serif mt-1 text-3xl">Adicionar à galeria</h2></div><button type="button" onClick={close} data-testid="button-close-image-editor"><X size={20} /></button></div><label className="mt-6 block rounded-xl border border-dashed border-[hsl(var(--primary)/.45)] bg-[hsl(var(--secondary)/.35)] p-5 text-sm font-semibold"><span className="flex items-center gap-2"><UploadCloud size={16} />Enviar arquivo de imagem</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} className="mt-3 block w-full text-xs" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void chooseFile(file); }} data-testid="input-editor-gallery-upload" /><span className="mt-2 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{uploading ? 'Enviando e gerando metadados…' : draft.imageUrl ? 'Imagem pronta — título e detalhes gerados a partir do nome do arquivo.' : 'JPG, PNG, WebP ou GIF · máximo de 10 MB'}</span></label>{draft.imageUrl && <img src={appUrl(draft.imageUrl)} alt={draft.alt || draft.title} className="mt-4 max-h-56 w-full rounded-xl object-contain bg-[hsl(var(--secondary))]" />}<div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Título<input required value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-image-title" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Categoria<input required value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-image-category" /></label><label className="text-sm font-semibold">Texto alternativo<input required value={draft.alt} onChange={event => setDraft(current => ({ ...current, alt: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-editor-image-alt" /></label></div><label className="text-sm font-semibold">Descrição<textarea required rows={3} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm" data-testid="textarea-editor-image-description" /></label>{error && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.featured ?? false} onChange={event => setDraft(current => ({ ...current, featured: event.target.checked }))} data-testid="checkbox-editor-image-featured" /> Destacar esta imagem</label></div><div className="mt-7 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar imagem'}</Button></div></form></div>;
}

function EventEditor({ event, close, refresh }: { event?: CatalogEvent; close: () => void; refresh: () => void }) {
  const [draft, setDraft] = useState<EventDraft>(event ? { id: event.id, title: event.title, shortDescription: event.shortDescription, fullDescription: event.fullDescription, eventDate: event.eventDate, startTime: event.startTime, endTime: event.endTime ?? '', timezone: event.timezone, imageId: event.imageId, venue: event.venue, city: event.city, address: event.address, mapsUrl: event.mapsUrl, externalUrl: event.externalUrl ?? '', published: event.published } : emptyEvent);
  const images = useListImages(undefined, { query: { queryKey: getListImagesQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const [error, setError] = useState('');
  const patch = (key: keyof EventDraft, value: string | boolean | number | null) => setDraft(current => ({ ...current, [key]: value }));
  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError('');
    const data: EventInput = { title: draft.title, shortDescription: draft.shortDescription, fullDescription: draft.fullDescription, eventDate: draft.eventDate, startTime: draft.startTime, endTime: draft.endTime || null, timezone: draft.timezone || 'Africa/Maputo', imageId: draft.imageId, venue: draft.venue, city: draft.city, address: draft.address, mapsUrl: draft.mapsUrl, externalUrl: draft.externalUrl || null, published: draft.published };
    const done = () => { refresh(); close(); };
    if (draft.id) update.mutate({ id: draft.id, data: data as EventUpdate }, { onSuccess: done, onError: () => setError('Não foi possível atualizar o evento.') });
    else create.mutate({ data }, { onSuccess: done, onError: () => setError('Não foi possível criar o evento.') });
  };
  const busy = create.isPending || update.isPending;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[hsl(193_25%_19%/.52)] p-4">
    <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[hsl(var(--card))] p-6 shadow-xl md:p-7">
      <div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">{draft.id ? 'Editar evento' : 'Novo evento'}</p><h2 className="serif mt-1 text-3xl">{draft.id ? 'Atualizar agenda' : 'Criar evento'}</h2></div><button type="button" onClick={close} data-testid="button-close-event-editor"><X size={20} /></button></div>
      <div className="mt-6 grid gap-4">
        <label className="text-sm font-semibold">Título<input required value={draft.title} onChange={event => patch('title', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-title" /></label>
        <label className="text-sm font-semibold">Descrição curta<textarea required rows={2} value={draft.shortDescription} onChange={event => patch('shortDescription', event.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm" data-testid="textarea-event-short-description" /></label>
        <label className="text-sm font-semibold">Descrição completa<textarea required rows={5} value={draft.fullDescription} onChange={event => patch('fullDescription', event.target.value)} className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm" data-testid="textarea-event-full-description" /></label>
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Data<input required type="date" value={draft.eventDate} onChange={event => patch('eventDate', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-date" /></label><label className="text-sm font-semibold">Início<input required type="time" value={draft.startTime} onChange={event => patch('startTime', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-start-time" /></label><label className="text-sm font-semibold">Fim<input type="time" value={draft.endTime} onChange={event => patch('endTime', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-end-time" /></label></div>
        <label className="text-sm font-semibold">Fuso horário<input required value={draft.timezone} onChange={event => patch('timezone', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-timezone" /><span className="mt-1 block text-xs font-normal text-[hsl(var(--muted-foreground))]">Padrão: Africa/Maputo</span></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Local<input required value={draft.venue} onChange={event => patch('venue', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-venue" /></label><label className="text-sm font-semibold">Cidade<input required value={draft.city} onChange={event => patch('city', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-city" /></label></div>
        <label className="text-sm font-semibold">Endereço<input required value={draft.address} onChange={event => patch('address', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-address" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Link do Google Maps<input required type="url" value={draft.mapsUrl} onChange={event => patch('mapsUrl', event.target.value)} placeholder="https://maps.google.com/..." className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-maps-url" /></label><label className="text-sm font-semibold">Link externo (opcional)<input type="url" value={draft.externalUrl} onChange={event => patch('externalUrl', event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="input-event-external-url" /></label></div>
        <label className="text-sm font-semibold">Imagem da biblioteca<select value={draft.imageId ?? ''} onChange={event => patch('imageId', event.target.value ? Number(event.target.value) : null)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" data-testid="select-event-image"><option value="">Sem imagem</option>{(images.data ?? []).map(image => <option key={image.id} value={image.id}>{image.title}</option>)}</select><span className="mt-1 block text-xs font-normal text-[hsl(var(--muted-foreground))]">Escolha uma imagem já publicada na galeria.</span></label>
        {draft.imageId && images.data?.find(image => image.id === draft.imageId) && <img src={images.data.find(image => image.id === draft.imageId)?.imageUrl} alt="" className="h-36 w-full rounded-xl object-cover" />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={event => patch('published', event.target.checked)} data-testid="checkbox-event-published" /> Publicar evento agora</label>
        {error && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>}
      </div>
      <div className="mt-7 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar evento'}</Button></div>
    </form>
  </div>;
}

function ImageList({ images, onAdd, onEdit, onDelete }: { images: Image[]; onAdd: () => void; onEdit: (image: Image) => void; onDelete: (id: number) => void }) {
  return <div><div className="mb-6 flex items-center justify-between"><p className="text-sm text-[hsl(var(--muted-foreground))]">{images.length} imagens na galeria</p><Button onClick={onAdd}><Plus size={16} /> Adicionar imagem</Button></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{images.length === 0 ? <StateMessage title="Nenhuma imagem ainda" body="Envie a primeira imagem para começar a galeria pública." /> : images.map(image => <div key={image.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><img src={appUrl(image.imageUrl)} alt={image.alt} className="h-12 w-16 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{image.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{image.category}</p></div><span className="hidden rounded-full bg-[hsl(var(--secondary))] px-2 py-1 mono text-[10px] sm:inline">{image.featured ? 'Destacada' : 'Padrão'}</span><button onClick={() => onEdit(image)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" data-testid={`button-edit-images-${image.id}`}><Settings2 size={16} /></button><button onClick={() => onDelete(image.id)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))]" data-testid={`button-delete-images-${image.id}`}><Trash2 size={16} /></button></div>)}</div></div>;
}

type AnalyticsPeriodKey = 'today' | '7d' | '30d' | '90d' | '12m' | 'custom';

const analyticsPeriodLabels: Record<AnalyticsPeriodKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '12m': 'Últimos 12 meses',
  custom: 'Período personalizado',
};

const formatCount = (value: number | undefined) => new Intl.NumberFormat('pt-BR').format(value ?? 0);
const formatDate = (value: string, withTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', withTime ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' }).format(date);
};

function AnalyticsSkeleton() {
  return <div className="space-y-5" aria-label="Carregando análises">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <div className="skeleton h-28 rounded-2xl" key={item} />)}</div>
    <div className="skeleton h-80 rounded-2xl" />
    <div className="grid gap-5 lg:grid-cols-2"><div className="skeleton h-72 rounded-2xl" /><div className="skeleton h-72 rounded-2xl" /></div>
  </div>;
}

function AnalyticsCard({ eyebrow, title, children, className = '' }: { eyebrow?: string; title: string; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 max-w-full rounded-xl border border-[hsl(var(--border))] bg-white p-5 shadow-sm transition-all hover:shadow-[var(--shadow-sm)] md:p-6 ${className}`}>
    <div className="flex items-start justify-between gap-4">
      <div>{eyebrow && <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{eyebrow}</p>}<h2 className="serif mt-1 text-xl font-medium tracking-[-.02em]">{title}</h2></div>
    </div>
    {children}
  </section>;
}

function EmptyAnalytics({ label }: { label: string }) {
  return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[hsl(var(--border))] px-5 text-center text-sm text-[hsl(var(--muted-foreground))]">{label}</div>;
}

function SegmentList({ items, label }: { items: { name: string; visitors: number }[]; label: string }) {
  if (!items.length) return <EmptyAnalytics label={label} />;
  const max = Math.max(...items.map(item => item.visitors), 1);
  return <div className="mt-5 space-y-4">{items.slice(0, 6).map(item => <div key={item.name}>
    <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{item.name}</span><span className="mono shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">{formatCount(item.visitors)}</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--secondary))]" aria-hidden="true"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.max((item.visitors / max) * 100, item.visitors ? 4 : 0)}%` }} /></div>
  </div>)}</div>;
}

function Overview({ onAddBook, onAddVideo, onAddImage, onAddEvent }: { onAddBook: () => void; onAddVideo: () => void; onAddImage: () => void; onAddEvent: () => void }) {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>('30d');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const params = useMemo(() => ({
    period,
    ...(period === 'custom' && start ? { start } : {}),
    ...(period === 'custom' && end ? { end } : {}),
  }), [period, start, end]);
  const analytics = useGetAdminAnalytics(params);
  const adminEvents = useListAdminEvents();
  const data = analytics.data;
  const hasTraffic = Boolean(data?.traffic.length);
  const hasLiveVisitors = Boolean(data?.liveVisitors.visitors.length);
  const upcomingEventCount = adminEvents.data?.filter(event => event.status === 'upcoming').length ?? 0;

  return <div className="min-w-0 max-w-full space-y-6">
    <div className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-white p-2 pl-6 md:flex-row md:items-center shadow-[var(--shadow-sm)]">
      <div className="flex-1 py-4">
        <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Bem-vindo de volta</p>
        <h2 className="serif mt-2 text-3xl font-medium tracking-[-.02em]">A biblioteca, em contexto.</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Leitura objetiva do acervo e do uso público, sem identificar visitantes.</p>
      </div>
      <div className="hidden h-[90px] w-64 items-center justify-center rounded-lg bg-[url('/sunnah-islamic-background.png')] bg-cover bg-center bg-no-repeat px-5 opacity-80 md:flex">
        <p className="serif text-sm italic text-[#19383b]">"O conhecimento é uma luz."</p>
      </div>
      <div className="flex flex-col gap-2 p-4 md:border-l border-[hsl(var(--border))] md:pl-6">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Período
          <select aria-label="Selecionar período das análises" value={period} onChange={event => setPeriod(event.target.value as AnalyticsPeriodKey)} className="mt-1 block h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--primary))] sm:w-44"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="12m">Últimos 12 meses</option><option value="custom">Personalizado</option></select>
        </label>
        {period === 'custom' && <div className="flex gap-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">De<input aria-label="Data inicial" type="date" value={start} onChange={event => setStart(event.target.value)} className="mt-1 block h-9 rounded-md border border-[hsl(var(--border))] bg-white px-2 text-xs outline-none focus:border-[hsl(var(--primary))]" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Até<input aria-label="Data final" type="date" value={end} onChange={event => setEnd(event.target.value)} className="mt-1 block h-9 rounded-md border border-[hsl(var(--border))] bg-white px-2 text-xs outline-none focus:border-[hsl(var(--primary))]" /></label></div>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <button onClick={onAddBook} className="flex items-center justify-center gap-2 rounded-xl bg-[#19383b] py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110"><BookOpen size={16} /> Adicionar livro</button>
      <button onClick={onAddVideo} className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--secondary)/.5)]"><PlayCircle size={16} /> Adicionar vídeo</button>
      <button onClick={onAddImage} className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--secondary)/.5)]"><Images size={16} /> Adicionar imagem</button>
      <button onClick={onAddEvent} className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--secondary)/.5)]"><CalendarDays size={16} /> Adicionar evento</button>
    </div>

    {analytics.isLoading ? <AnalyticsSkeleton /> : analytics.isError ? <StateMessage error title="Não foi possível carregar as análises" body="Tente novamente em alguns instantes." retry={analytics.refetch} /> : data ? <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Livros no acervo" value={formatCount(data.summary.bookCount)} icon={<BookOpen size={16} />} />
        <StatCard label="Vídeos no acervo" value={formatCount(data.summary.videoCount)} icon={<PlayCircle size={16} />} />
        <StatCard label="Imagens no acervo" value={formatCount(data.summary.imageCount)} icon={<Images size={16} />} />
        <StatCard label="Próximos eventos" value={formatCount(upcomingEventCount)} icon={<CalendarDays size={16} />} />
        <StatCard label="Downloads totais" value={formatCount(data.summary.totalDownloads)} icon={<Download size={16} />} />
        <StatCard label="Visitantes no período" value={formatCount(data.summary.totalVisitors)} icon={<UsersRound size={16} />} />
        <StatCard label="Visualizações de páginas" value={formatCount(data.summary.totalPageviews)} icon={<BarChart3 size={16} />} />
      </div>
      <AnalyticsCard eyebrow={analyticsPeriodLabels[period]} title="Tráfego ao longo do tempo" className="overflow-hidden bg-white">
        {hasTraffic ? <div className="mt-6 h-64 min-w-0 max-w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.traffic} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={value => formatDate(String(value))} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} minTickGap={28} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} /><Tooltip labelFormatter={value => formatDate(String(value), true)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} /><Line type="monotone" dataKey="visitors" name="Visitantes" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="pageviews" name="Visualizações" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <div className="mt-5"><EmptyAnalytics label="Ainda não há dados de tráfego para este período." /></div>}
        <div className="mt-4 flex flex-wrap gap-5 text-xs text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />Visitantes</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Visualizações</span></div>
      </AnalyticsCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnalyticsCard eyebrow="Acesso agora" title={`${formatCount(data.liveVisitors.count)} visitantes ativos`} className="bg-white">
          {hasLiveVisitors ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-[hsl(var(--border))] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="pb-3 font-medium">Página</th><th className="pb-3 font-medium">Dispositivo</th><th className="pb-3 text-right font-medium">Visto</th></tr></thead><tbody>{data.liveVisitors.visitors.slice(0, 8).map((visitor, index) => <tr key={`${visitor.path}-${visitor.lastSeenAt}-${index}`} className="border-b border-[hsl(var(--border)/.7)] last:border-0"><td className="max-w-[170px] truncate py-3">{visitor.path}</td><td className="py-3 text-[hsl(var(--muted-foreground))]">{visitor.device || 'Não informado'}</td><td className="py-3 text-right text-xs text-[hsl(var(--muted-foreground))]">{formatDate(visitor.lastSeenAt, true)}</td></tr>)}</tbody></table><p className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">Dados agregados; nenhum nome, endereço ou identificador pessoal é exibido.</p></div> : <div className="mt-5"><EmptyAnalytics label="Não há visitantes ativos neste momento." /></div>}
        </AnalyticsCard>
        <AnalyticsCard eyebrow="Registro" title="Atividade recente" className="bg-white">{data.recentActivity.length ? <div className="mt-5 divide-y divide-[hsl(var(--border))]">{data.recentActivity.slice(0, 7).map((item, index) => <div key={`${item.createdAt}-${index}`} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="flex items-start gap-3 min-w-0"><span className="mt-0.5 text-[hsl(var(--muted-foreground))]">{item.type === 'book' ? <BookOpen size={14}/> : item.type === 'video' ? <PlayCircle size={14}/> : item.type === 'image' ? <Images size={14}/> : item.type === 'download' ? <Download size={14}/> : <CalendarDays size={14}/>}</span><div className="min-w-0"><p className="truncate text-sm">{item.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.type === 'book' ? 'Livro' : item.type === 'video' ? 'Vídeo' : item.type === 'image' ? 'Imagem' : item.type === 'download' ? 'Download' : 'Evento'}</p></div></div><div className="flex shrink-0 flex-col items-end gap-1"><span className="text-[11px] text-[hsl(var(--muted-foreground))]">{formatDate(item.createdAt, true)}</span></div></div>)}</div> : <div className="mt-5"><EmptyAnalytics label="Ainda não há atividade recente." /></div>}</AnalyticsCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnalyticsCard eyebrow="Downloads" title="Ritmo de downloads" className="bg-white">
          <div className="mt-5 grid grid-cols-2 divide-x divide-[hsl(var(--border))] rounded-xl bg-[hsl(var(--secondary)/.5)] py-3 text-center sm:grid-cols-4"><div><p className="mono text-lg">{formatCount(data.downloads.total)}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">No período</p></div><div><p className="mono text-lg">{formatCount(data.downloads.today)}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Hoje</p></div><div><p className="mono text-lg">{formatCount(data.downloads.week)}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">7 dias</p></div><div><p className="mono text-lg">{formatCount(data.downloads.month)}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">30 dias</p></div></div>
          {data.downloads.leaders.length ? <div className="mt-5 space-y-3">{data.downloads.leaders.slice(0, 5).map(leader => <div key={leader.title} className="flex items-center justify-between gap-4 text-sm"><span className="truncate">{leader.title}</span><span className="mono shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{formatCount(leader.downloads)}</span></div>)}</div> : <div className="mt-5"><EmptyAnalytics label="Ainda não há downloads registrados." /></div>}
        </AnalyticsCard>
        <AnalyticsCard eyebrow="Conteúdo" title="Mais acessados" className="bg-white">
          {data.popularContent.length ? <div className="mt-5 divide-y divide-[hsl(var(--border))]">{data.popularContent.slice(0, 7).map(item => <div key={`${item.type}-${item.path}`} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"><span className="mono w-6 text-xs text-[hsl(var(--muted-foreground))]">{item.type === 'book' ? 'L' : item.type === 'video' ? 'V' : 'I'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{item.path}</p></div><span className="mono text-xs text-[hsl(var(--muted-foreground))]">{formatCount(item.views)}</span></div>)}</div> : <div className="mt-5"><EmptyAnalytics label="Ainda não há conteúdo popular neste período." /></div>}
        </AnalyticsCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnalyticsCard eyebrow="Origem" title="Fontes de tráfego" className="bg-white"><SegmentList items={data.trafficSources} label="Ainda não há fontes de tráfego." /></AnalyticsCard>
        <AnalyticsCard eyebrow="Ambiente" title="Dispositivos" className="bg-white"><SegmentList items={data.devices} label="Ainda não há dados de dispositivos." /></AnalyticsCard>
      </div>
    </> : <EmptyAnalytics label="Não há dados disponíveis para este período." />}
  </div>;
}

function AdminCategories({ categories }: { categories: Category[] }) {
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const qc = useQueryClient();
  const create = useCreateCategory();
  const remove = useDeleteCategory();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice({ kind: 'error', text: 'Introduza um nome para a categoria.' });
      return;
    }
    setNotice(null);
    create.mutate({ data: { name: trimmedName } }, {
      onSuccess: () => {
        setName('');
        setNotice({ kind: 'success', text: 'Categoria adicionada.' });
        refresh();
      },
      onError: (error) => setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível adicionar a categoria. Verifique se ela já existe.' }),
    });
  };

  const deleteCategory = (category: Category) => {
    if (category.bookCount > 0 || category.videoCount > 0) {
      setNotice({ kind: 'error', text: 'Esta categoria ainda está sendo usada. Reclassifique o conteúdo antes de removê-la.' });
      return;
    }
    if (!window.confirm(`Remover a categoria "${category.name}"?`)) return;
    setNotice(null);
    remove.mutate({ name: category.name }, {
      onSuccess: () => {
        setNotice({ kind: 'success', text: 'Categoria removida.' });
        refresh();
      },
      onError: (error) => setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível remover a categoria.' }),
    });
  };

  return <div>
    <div className="mb-6"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Organização</p><h2 className="serif mt-2 text-4xl tracking-[-.04em]">Categorias</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Adicione categorias para organizar o acervo. Categorias com conteúdo vinculado não podem ser removidas.</p></div>
    <form onSubmit={submit} className="mb-6 flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm font-semibold">Nova categoria<input required value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Ex.: História islâmica" className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-admin-category-name" /></label>
      <Button type="submit" disabled={create.isPending} dataTestId="button-admin-add-category">{create.isPending ? 'A adicionar…' : 'Adicionar categoria'}</Button>
    </form>
    {notice && <p className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.kind === 'error' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`} role="status">{notice.text}</p>}
    {categories.length === 0 ? <StateMessage title="Nenhuma categoria ainda" body="Adicione a primeira categoria para começar a organizar o acervo." /> : <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{categories.map(category => { const inUse = category.bookCount > 0 || category.videoCount > 0; return <div key={category.name} className="flex flex-col gap-4 border-b border-[hsl(var(--border))] p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{category.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{inUse ? 'Conteúdo disponível no acervo' : 'Sem conteúdo vinculado'}</p></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div className="flex gap-5 text-right text-xs text-[hsl(var(--muted-foreground))]"><span><strong className="mono block text-sm text-[hsl(var(--foreground))]">{formatCount(category.bookCount)}</strong>livros</span><span><strong className="mono block text-sm text-[hsl(var(--foreground))]">{formatCount(category.videoCount)}</strong>vídeos</span></div><button type="button" onClick={() => deleteCategory(category)} disabled={inUse || remove.isPending} title={inUse ? 'Reclassifique o conteúdo antes de remover' : 'Remover categoria'} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))] disabled:cursor-not-allowed disabled:opacity-35" data-testid={`button-admin-delete-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}><Trash2 size={16} /></button></div></div>; })}</div>}
  </div>;
}

function AdminEvents({ events, onAdd, onEdit, onDelete, onDuplicate, onTogglePublish }: { events: CatalogEvent[]; onAdd: () => void; onEdit: (event: CatalogEvent) => void; onDelete: (id: number) => void; onDuplicate: (id: number) => void; onTogglePublish: (event: CatalogEvent) => void }) {
  const [filter, setFilter] = useState<'all' | 'draft' | 'upcoming' | 'past'>('all');
  const filtered = events.filter(event => filter === 'all' || event.status === filter);
  const statusLabel = (status: CatalogEvent['status']) => status === 'draft' ? 'Rascunho' : status === 'upcoming' ? 'Publicado · Próximo' : 'Publicado · Realizado';
  return <div>
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Agenda pública</p><h2 className="serif mt-2 text-4xl tracking-[-.04em]">Eventos</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Crie e publique encontros sem alterar o acervo existente.</p></div><Button onClick={onAdd}><Plus size={16} /> Novo evento</Button></div>
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{[['all', 'Todos'], ['upcoming', 'Próximos'], ['draft', 'Rascunhos'], ['past', 'Realizados']].map(([value, label]) => <button key={value} onClick={() => setFilter(value as typeof filter)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${filter === value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]'}`}>{label}</button>)}</div>
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{filtered.length === 0 ? <StateMessage title="Nenhum evento encontrado" body={filter === 'all' ? 'Crie o primeiro evento da agenda.' : 'Não há eventos nesta categoria.'} /> : filtered.map(event => <div key={event.id} className="flex flex-col gap-4 border-b border-[hsl(var(--border))] p-4 last:border-0 sm:flex-row sm:items-center"><EventImage event={event} className="h-20 w-28 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatEventDate(event.eventDate)} · {formatEventTime(event)} · {event.city}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${event.status === 'draft' ? 'bg-[hsl(var(--secondary))]' : event.status === 'past' ? 'bg-[#f4eadb] text-[#8a6e4b]' : 'bg-[#e5f2eb] text-[#075C45]'}`}>{statusLabel(event.status)}</span></div><div className="flex shrink-0 flex-wrap gap-1"><button onClick={() => onTogglePublish(event)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" title={event.published ? 'Despublicar' : 'Publicar'} data-testid={`button-toggle-event-${event.id}`}>{event.published ? <EyeOff size={16} /> : <Eye size={16} />}</button><button onClick={() => onDuplicate(event.id)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" title="Duplicar" data-testid={`button-duplicate-event-${event.id}`}><Copy size={16} /></button><button onClick={() => onEdit(event)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" title="Editar" data-testid={`button-edit-event-${event.id}`}><Settings2 size={16} /></button><button onClick={() => onDelete(event.id)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))]" title="Excluir" data-testid={`button-delete-event-${event.id}`}><Trash2 size={16} /></button></div></div>)}</div>
  </div>;
}

function AdminMessages() {
  const messages = useListAdminContactMessages();
  const update = useUpdateAdminContactMessage();
  const [error, setError] = useState('');
  const items = messages.data ?? [];
  const unread = items.filter(message => !message.read).length;

  const toggleRead = (message: ContactMessage) => {
    setError('');
    update.mutate({ id: message.id, data: { read: !message.read } }, {
      onError: () => setError('Não foi possível atualizar o estado da mensagem.'),
    });
  };

  return <div>
    <div className="mb-6"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Comunicação</p><h2 className="serif mt-2 text-4xl tracking-[-.04em]">Mensagens</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Relatos, sugestões e pedidos enviados pelo formulário público.</p></div>
    {messages.isLoading ? <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="skeleton h-32 rounded-2xl" />)}</div> : messages.isError ? <StateMessage error title="Não foi possível carregar as mensagens" body="Tente novamente em alguns instantes." retry={messages.refetch} /> : <><div className="mb-5 flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3 text-sm"><Mail size={16} className="text-[hsl(var(--primary))]" /><span>{unread === 0 ? 'Todas as mensagens foram lidas.' : `${formatCount(unread)} ${unread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}.`}</span></div>{error && <p className="mb-5 rounded-xl bg-[hsl(var(--destructive)/.1)] px-4 py-3 text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>}{items.length === 0 ? <StateMessage title="Nenhuma mensagem ainda" body="As mensagens enviadas pelo contato público aparecerão aqui." /> : <div className="space-y-3">{items.map(message => <article key={message.id} className={`rounded-2xl border bg-[hsl(var(--card))] p-5 ${message.read ? 'border-[hsl(var(--border))]' : 'border-[hsl(var(--primary)/.45)] shadow-sm'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{message.topic}</span>{!message.read && <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--primary))]">Nova</span>}</div><a href={`mailto:${message.email}`} className="mt-1 block truncate text-sm text-[hsl(var(--primary))] hover:underline">{message.email}</a></div><time dateTime={message.createdAt} className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(message.createdAt, true)}</time></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--muted-foreground))]">{message.message}</p><div className="mt-4 flex justify-end"><Button variant="ghost" onClick={() => toggleRead(message)} disabled={update.isPending}>{message.read ? 'Marcar como não lida' : 'Marcar como lida'}</Button></div></article>)}</div>}</>}
  </div>;
}

function AdminSettings() {
  return <div>
    <div className="mb-6"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Espaço privado</p><h2 className="serif mt-2 text-4xl tracking-[-.04em]">Configurações</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Informações do painel e princípios de privacidade da biblioteca.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <AnalyticsCard eyebrow="Acesso" title="Conta administrativa"><div className="mt-5 rounded-xl bg-[hsl(var(--secondary)/.55)] p-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">O painel é protegido por uma palavra-passe administrativa dedicada, guardada nos Secrets do projeto, com uma sessão curta e segura.</div></AnalyticsCard>
      <AnalyticsCard eyebrow="Privacidade" title="Análises anónimas"><div className="mt-5 rounded-xl bg-[hsl(var(--secondary)/.55)] p-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">As análises guardam apenas dados agregados: caminhos públicos, dispositivo, país aproximado e um identificador com hash rotativo. Não guardamos nomes, emails, endereços exatos ou URLs de referência brutos.</div></AnalyticsCard>
    </div>
  </div>;
}

function Admin() {
  const [tab, setTab] = useState<'overview' | 'books' | 'videos' | 'images' | 'events' | 'categories' | 'messages' | 'settings'>('overview');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [imageEditor, setImageEditor] = useState<Image | 'new' | null>(null);
  const [eventEditor, setEventEditor] = useState<CatalogEvent | 'new' | null>(null);
  const qc = useQueryClient();
  const books = useListBooks();
  const videos = useListVideos();
  const images = useListImages(undefined, { query: { queryKey: getListImagesQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0 } });
  const events = useListAdminEvents();
  const categories = useListCategories();
  const messages = useListAdminContactMessages();
  const delBook = useDeleteBook();
  const delVideo = useDeleteVideo();
  const delImage = useDeleteImage();
  const delEvent = useDeleteEvent();
  const duplicateEvent = useDuplicateEvent();
  const updateEvent = useUpdateEvent();
  const [notice, setNotice] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
    qc.invalidateQueries({ queryKey: getListVideosQueryKey() });
    qc.invalidateQueries({ queryKey: getListImagesQueryKey() });
    qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
    qc.invalidateQueries({ queryKey: getListAdminEventsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetLibrarySummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  };

  const confirmDelete = (kind: 'book' | 'video' | 'image' | 'event', id: number) => {
    if (!window.confirm(kind === 'image' ? 'Remover esta imagem da galeria pública?' : kind === 'event' ? 'Excluir este evento? Esta ação não pode ser desfeita.' : 'Remover este item do catálogo?')) return;
    setNotice('');
    const onError = () => setNotice('Não foi possível remover este item. Tente novamente.');
    if (kind === 'book') delBook.mutate({ id }, { onSuccess: refresh, onError });
    if (kind === 'video') delVideo.mutate({ id }, { onSuccess: refresh, onError });
    if (kind === 'image') delImage.mutate({ id }, { onSuccess: refresh, onError });
    if (kind === 'event') delEvent.mutate({ id }, { onSuccess: refresh, onError });
  };

  const togglePublish = (event: CatalogEvent) => {
    const data: EventInput = { title: event.title, shortDescription: event.shortDescription, fullDescription: event.fullDescription, eventDate: event.eventDate, startTime: event.startTime, endTime: event.endTime, timezone: event.timezone, imageId: event.imageId, venue: event.venue, city: event.city, address: event.address, mapsUrl: event.mapsUrl, externalUrl: event.externalUrl, published: !event.published };
    setNotice('');
    updateEvent.mutate({ id: event.id, data }, { onSuccess: refresh, onError: () => setNotice('Não foi possível alterar a publicação do evento.') });
  };
  const duplicate = (id: number) => {
    setNotice('');
    duplicateEvent.mutate({ id }, { onSuccess: refresh, onError: () => setNotice('Não foi possível duplicar o evento.') });
  };

  const heading = tab === 'overview' ? 'Visão geral' : tab === 'books' ? 'Livros' : tab === 'videos' ? 'Vídeos' : tab === 'images' ? 'Imagens' : tab === 'events' ? 'Eventos' : tab === 'categories' ? 'Categorias' : tab === 'messages' ? 'Mensagens' : 'Configurações';
  const navItems = [{ key: 'overview', label: 'Visão geral', icon: <BarChart3 size={17} /> }, { key: 'books', label: 'Livros', icon: <BookOpen size={17} /> }, { key: 'videos', label: 'Vídeos', icon: <Film size={17} /> }, { key: 'images', label: 'Imagens', icon: <Images size={17} /> }, { key: 'events', label: 'Eventos', icon: <CalendarDays size={17} /> }, { key: 'categories', label: 'Categorias', icon: <BookMarked size={17} /> }, { key: 'messages', label: messages.data?.some(message => !message.read) ? 'Mensagens · novas' : 'Mensagens', icon: <Mail size={17} /> }, { key: 'settings', label: 'Configurações', icon: <Settings2 size={17} /> }] as const;
  const renderNav = (mobile = false) => navItems.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={mobile ? `shrink-0 rounded-full px-3 py-2 text-xs ${tab === item.key ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]'}` : `flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${tab === item.key ? 'bg-[hsl(var(--sidebar-accent))]' : 'opacity-70 hover:opacity-100'}`} data-testid={`button-admin-${item.key}`}>{item.icon}{item.label}</button>);
  return <Shell admin><div className="flex min-h-[100dvh]"><aside className="hidden w-[245px] shrink-0 flex-col bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] md:flex"><Logo /><p className="mono mb-3 mt-14 px-3 text-[10px] uppercase tracking-[.18em] opacity-50">Espaço privado</p>{renderNav()}<div className="mt-auto"><Link href="/" className="flex items-center gap-3 px-3 py-3 text-sm opacity-65 hover:opacity-100" data-testid="link-admin-library"><ArrowLeft size={17} /> Biblioteca pública</Link></div></aside><div className="min-w-0 flex-1 overflow-x-hidden"><div className="flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] px-5 lg:px-10"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]">Painel administrativo</p><h1 className="serif text-2xl">{heading}</h1></div><div className="flex items-center gap-2"><Link href="/" className="rounded-full p-2 text-[hsl(var(--muted-foreground))] md:hidden" data-testid="link-mobile-admin-library"><ArrowLeft size={18} /></Link><span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--secondary))]"><CircleUserRound size={17} /></span></div></div><nav className="flex max-w-[100vw] gap-1 overflow-x-auto border-b border-[hsl(var(--border))] px-5 py-2 md:hidden" aria-label="Seções administrativas">{renderNav(true)}</nav><main className="mx-auto w-full min-w-0 max-w-[1200px] p-5 lg:p-10">{notice && <p className="mb-5 rounded-xl bg-[hsl(var(--destructive)/.1)] px-4 py-3 text-sm text-[hsl(var(--destructive))]" role="alert">{notice}</p>}{tab === 'overview' ? <Overview onAddBook={() => setEditor({ ...emptyBook })} onAddVideo={() => setEditor({ ...emptyVideo })} onAddImage={() => setImageEditor('new')} onAddEvent={() => setEventEditor('new')} /> : tab === 'images' ? <ImageList images={images.data ?? []} onAdd={() => setImageEditor('new')} onEdit={image => setImageEditor(image)} onDelete={id => confirmDelete('image', id)} /> : tab === 'events' ? <AdminEvents events={events.data ?? []} onAdd={() => setEventEditor('new')} onEdit={event => setEventEditor(event)} onDelete={id => confirmDelete('event', id)} onDuplicate={duplicate} onTogglePublish={togglePublish} /> : tab === 'categories' ? <AdminCategories categories={categories.data ?? []} /> : tab === 'messages' ? <AdminMessages /> : tab === 'settings' ? <AdminSettings /> : <CatalogList tab={tab} books={books.data ?? []} videos={videos.data ?? []} onAdd={() => setEditor(tab === 'books' ? { ...emptyBook } : { ...emptyVideo })} onEdit={(item) => setEditor(tab === 'books' ? { kind: 'book', id: item.id, title: item.title, author: (item as Book).author, description: item.description, category: item.category, coverUrl: (item as Book).coverUrl ?? '', fileUrl: (item as Book).fileUrl ?? '', fileType: (item as Book).fileType as BookInput['fileType'], fileSize: (item as Book).fileSize, featured: item.featured } : { kind: 'video', id: item.id, title: item.title, description: item.description, category: item.category, thumbnailUrl: (item as Video).thumbnailUrl ?? '', videoUrl: (item as Video).videoUrl ?? '', duration: (item as Video).duration, downloadEnabled: (item as Video).downloadEnabled, featured: item.featured })} onDelete={id => confirmDelete(tab === 'books' ? 'book' : 'video', id)} />}</main></div></div>{editor && <CatalogEditor state={editor} setState={setEditor} close={() => setEditor(null)} refresh={refresh} />}{imageEditor && <ImageEditor image={imageEditor === 'new' ? undefined : imageEditor} close={() => setImageEditor(null)} refresh={refresh} />}{eventEditor && <EventEditor event={eventEditor === 'new' ? undefined : eventEditor} close={() => setEventEditor(null)} refresh={refresh} />}</Shell>;
}

function CatalogList({ tab, books, videos, onAdd, onEdit, onDelete }: { tab: 'books' | 'videos'; books: Book[]; videos: Video[]; onAdd: () => void; onEdit: (item: Book | Video) => void; onDelete: (id: number) => void }) {
  const items = tab === 'books' ? books : videos;
  return <div><div className="mb-6 flex items-center justify-between"><p className="text-sm text-[hsl(var(--muted-foreground))]">{items.length} itens no catálogo</p><Button onClick={onAdd}><Plus size={16} /> Adicionar {tab === 'books' ? 'livro' : 'vídeo'}</Button></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{items.length === 0 ? <StateMessage title={tab === 'books' ? 'Nenhum livro ainda' : 'Nenhum vídeo ainda'} body="Adicione o primeiro item para começar a estante." /> : items.map(item => <div key={item.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><div className="hidden h-12 w-9 shrink-0 overflow-hidden rounded bg-[hsl(var(--secondary))] sm:block">{tab === 'books' ? <Cover book={item as Book} /> : <VideoThumb video={item as Video} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.category} · {tab === 'books' ? (item as Book).author : (item as Video).duration}</p></div><span className="hidden rounded-full bg-[hsl(var(--secondary))] px-2 py-1 mono text-[10px] sm:inline">{item.featured ? 'Destacado' : 'Padrão'}</span><button onClick={() => onEdit(item)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" data-testid={`button-edit-${tab}-${item.id}`}><Settings2 size={16} /></button><button onClick={() => onDelete(item.id)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))]" data-testid={`button-delete-${tab}-${item.id}`}><Trash2 size={16} /></button></div>)}</div></div>;
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

function AnalyticsTracker() {
  const [location] = useLocation();
  useEffect(() => {
    if (location.startsWith('/admin') || location.startsWith('/sign-in') || location.startsWith('/sign-up')) return;
    let visitorId = window.localStorage.getItem('sunnah_visitor_id');
    if (!visitorId) {
      visitorId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem('sunnah_visitor_id', visitorId);
    }
    void fetch(`${basePath}/api/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        path: location,
        title: document.title,
        referrer: document.referrer || undefined,
        eventType: 'pageview',
      }),
      keepalive: true,
    }).catch(() => undefined);
    trackEvent('page_view', { path: location });
  }, [location]);
  return null;
}

function ClerkSignInPage({ signUp = false }: { signUp?: boolean }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4">
    {signUp
      ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}
  </div>;
}

function AdminAccessGate() {
  const [state, setState] = useState<'checking' | 'locked' | 'unlocked' | 'error'>('checking');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`${basePath}/api/admin/access`, { credentials: 'include' })
      .then(async response => {
        if (!active) return;
        const payload = response.ok ? await response.json().catch(() => null) : null;
        if (response.ok && payload?.authorized === true) {
          setState('unlocked');
        } else if (response.ok && payload?.authorized === false) {
          setState('locked');
        } else if (response.status === 403) {
          setState('error');
          setMessage('A sua conta não tem acesso ao painel administrativo.');
        } else {
          setState('error');
          setMessage('Não foi possível verificar a proteção adicional.');
        }
      })
      .catch(() => {
        if (active) {
          setState('error');
          setMessage('Não foi possível contactar o servidor.');
        }
      });
    return () => { active = false; };
  }, []);

  if (state === 'unlocked') return <Admin />;
  if (state === 'checking') return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><p className="mono text-xs uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">A verificar proteção…</p></div>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`${basePath}/api/admin/access`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setPassword('');
        setState('unlocked');
      } else if (response.status === 401) {
        setMessage('Palavra-passe incorreta.');
       } else if (response.status === 403) {
         setMessage('A sua conta Clerk não está autorizada como administradora.');
      } else if (response.status === 503) {
        setMessage('A proteção adicional ainda não foi configurada no servidor.');
      } else {
        setMessage('Não foi possível desbloquear o painel.');
      }
    } catch {
      setMessage('Não foi possível contactar o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-5"><div className="w-full max-w-[420px] rounded-3xl bg-[hsl(var(--card))] p-7 shadow-xl md:p-10"><Logo /><p className="mono mt-12 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Proteção do painel</p><h1 className="serif mt-3 text-4xl">Confirmar acesso.</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Introduza a palavra-passe de administrador para abrir o painel administrativo.</p>{state === 'error' ? <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.1)] p-4 text-sm text-[hsl(var(--destructive))]" role="alert">{message}</p> : <form onSubmit={submit} className="mt-7"><label className="text-sm font-semibold">Palavra-passe de administrador<span className="relative mt-2 block"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 pr-12 outline-none focus:border-[hsl(var(--primary))]" autoFocus /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-inset]">{showPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}</button></span></label>{message && <p className="mt-3 text-sm text-[hsl(var(--destructive))]" role="alert">{message}</p>}<Button type="submit" disabled={submitting} className="mt-6 w-full">{submitting ? 'A verificar…' : 'Abrir painel'}</Button></form>}<Link href="/" className="mt-6 block text-center text-xs text-[hsl(var(--muted-foreground))]">Voltar à biblioteca</Link></div></div>;
}

function AdminRoute() {
  return <AdminAccessGate />;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Home} /><Route path="/books" component={Books} /><Route path="/books/:id/read" component={BookReader} /><Route path="/books/:id" component={BookDetail} />
    <Route path="/videos" component={Videos} /><Route path="/videos/:id" component={VideoDetail} /><Route path="/images" component={GalleryPage} /><Route path="/events" component={EventsPage} /><Route path="/events/:id" component={EventDetail} /><Route path="/categories" component={Categories} />
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
    localization={ptBR}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to))}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkCacheInvalidator />
      <AnalyticsTracker />
      <Router />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;
