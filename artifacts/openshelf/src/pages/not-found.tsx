import { ArrowLeft, LibraryBig } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><LibraryBig size={22} /></span>
        <p className="mono mt-8 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">The empty aisle</p>
        <h1 className="serif mt-3 text-5xl">Nothing on this page.</h1>
        <p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">The link may have gone stale. There are still plenty of good places to browse.</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))]" data-testid="link-not-found-home"><ArrowLeft size={15} /> Return to OpenShelf</Link>
      </div>
    </div>
  );
}
