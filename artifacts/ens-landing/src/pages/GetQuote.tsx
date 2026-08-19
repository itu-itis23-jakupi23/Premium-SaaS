import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowLeft, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { ENSLogo } from "@/components/ENSLogo";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { submitLead } from "@/lib/platform-api";

export default function GetQuote() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = t("getQuote.pageTitle");
  }, [t]);

  const schema = z.object({
    companyName: z.string().min(1, t("getQuote.validation.company")),
    contactName: z.string().min(1, t("getQuote.validation.name")),
    contactEmail: z.string().email(t("getQuote.validation.email")),
    phone: z.string().optional(),
    exhibitionName: z.string().optional(),
    boothSize: z.string().optional(),
    budget: z.string().optional(),
    timeline: z.string().optional(),
    message: z.string().optional(),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "", contactName: "", contactEmail: "", phone: "",
      exhibitionName: "", boothSize: "", budget: "", timeline: "", message: "",
    },
  });
  const { register, handleSubmit, formState } = form;

  async function onSubmit(values: Values) {
    setError("");
    try {
      await submitLead(values);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("getQuote.error"));
    }
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-blueprint-grid opacity-60 dark:opacity-30" aria-hidden="true" />
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-primary/5 blur-3xl rounded-full" aria-hidden="true" />

      <main id={MAIN_CONTENT_ID} className="relative z-10 mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <ENSLogo size="md" showTagline href="/" />
        </div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {submitted ? (
            <Card className="border-border/70 bg-card/85 backdrop-blur-2xl shadow-2xl">
              <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{t("getQuote.success.title")}</h1>
                <p className="max-w-md text-sm text-muted-foreground">{t("getQuote.success.body")}</p>
                <Link href="/" className="mt-2">
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> {t("getQuote.success.back")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70 bg-card/85 backdrop-blur-2xl shadow-2xl">
              <CardContent className="px-6 py-8">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">{t("getQuote.title")}</h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t("getQuote.subtitle")}</p>
                </div>

                {error && (
                  <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("getQuote.fields.company")} required error={formState.errors.companyName?.message}>
                      <Input {...register("companyName")} data-testid="input-company" autoComplete="organization" />
                    </Field>
                    <Field label={t("getQuote.fields.name")} required error={formState.errors.contactName?.message}>
                      <Input {...register("contactName")} data-testid="input-name" autoComplete="name" />
                    </Field>
                    <Field label={t("getQuote.fields.email")} required error={formState.errors.contactEmail?.message}>
                      <Input type="email" {...register("contactEmail")} data-testid="input-email" autoComplete="email" />
                    </Field>
                    <Field label={t("getQuote.fields.phone")}>
                      <Input {...register("phone")} autoComplete="tel" />
                    </Field>
                    <Field label={t("getQuote.fields.exhibition")}>
                      <Input {...register("exhibitionName")} placeholder={t("getQuote.placeholders.exhibition")} />
                    </Field>
                    <Field label={t("getQuote.fields.boothSize")}>
                      <Input {...register("boothSize")} placeholder={t("getQuote.placeholders.boothSize")} />
                    </Field>
                    <Field label={t("getQuote.fields.budget")}>
                      <select
                        {...register("budget")}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">{t("getQuote.placeholders.select")}</option>
                        <option>&lt; $10k</option>
                        <option>$10k – $25k</option>
                        <option>$25k – $50k</option>
                        <option>$50k – $100k</option>
                        <option>$100k+</option>
                      </select>
                    </Field>
                    <Field label={t("getQuote.fields.timeline")}>
                      <Input {...register("timeline")} placeholder={t("getQuote.placeholders.timeline")} />
                    </Field>
                  </div>

                  <Field label={t("getQuote.fields.message")}>
                    <Textarea rows={4} {...register("message")} placeholder={t("getQuote.placeholders.message")} />
                  </Field>

                  <Button type="submit" className="w-full" disabled={formState.isSubmitting} data-testid="button-submit-quote">
                    {formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t("getQuote.submit")}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    {t("getQuote.disclaimer")}{" "}
                    <Link href="/privacy" className="text-primary hover:underline">{t("getQuote.privacyLink")}</Link>.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  // Generate a unique id and associate the label with the control, so every
  // field has a programmatic label and a unique id (no autofill/a11y warnings).
  const generatedId = useId();
  const child = isValidElement<{ id?: string }>(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: children.props.id ?? generatedId })
    : children;
  const controlId = (isValidElement<{ id?: string }>(children) && children.props.id) || generatedId;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={controlId} className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {child}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
