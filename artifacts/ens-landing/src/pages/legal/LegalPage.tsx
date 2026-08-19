import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ENSLogo } from '@/components/ENSLogo';
import { SkipToContent, MAIN_CONTENT_ID } from '@/components/SkipToContent';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { COUNSEL_REVIEWED, LEGAL_DOCUMENTS, getLegalDocument } from './content';

export default function LegalPage({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const doc = getLegalDocument(slug);

  useEffect(() => {
    document.title = doc ? `${doc.title} — ENS Platform` : 'ENS Platform';
  }, [doc]);

  if (!doc) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-2xl font-bold">Document not found</h1>
        <Button onClick={() => navigate('/')} className="rounded-full px-6">Back to home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SkipToContent />
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <ENSLogo size="sm" href="/" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="ghost"
              className="rounded-full px-4 font-semibold gap-2"
              onClick={() => navigate('/')}
              data-testid="btn-legal-home"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </Button>
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} className="container mx-auto px-6 py-16 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Legal</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="legal-title">
          {doc.title}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-4">{doc.summary}</p>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated <time dateTime={doc.updated}>{doc.updated}</time>
        </p>

        {!COUNSEL_REVIEWED && (
          <div
            className="mb-12 flex gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5"
            data-testid="legal-review-notice"
          >
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Pending legal review</p>
              <p className="text-muted-foreground leading-relaxed">
                This document accurately describes how the platform works today, but it has not yet been
                reviewed by a qualified lawyer. It must be reviewed before the platform accepts customers
                in production.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold mb-4 tracking-tight">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-[15px] text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2.5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-[15px] text-muted-foreground leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <nav className="mt-16 pt-8 border-t border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Other legal documents
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL_DOCUMENTS.filter((other) => other.slug !== doc.slug).map((other) => (
              <li key={other.slug}>
                <a
                  href={`/${other.slug}`}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {other.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
