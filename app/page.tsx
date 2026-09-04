import Link from "next/link";
import { th } from "@/lib/i18n";

const features = [
  { number: "01", title: th.landing.features.searchTitle, body: th.landing.features.searchBody },
  { number: "02", title: th.landing.features.thailandTitle, body: th.landing.features.thailandBody },
  { number: "03", title: th.landing.features.personalTitle, body: th.landing.features.personalBody },
] as const;

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_18%,rgba(232,184,75,0.18),transparent_28%),radial-gradient(circle_at_10%_85%,rgba(126,85,207,0.12),transparent_30%),linear-gradient(145deg,#09090c_25%,#121116_100%)]"
      />
      <div aria-hidden="true" className="landing-grid absolute inset-0 -z-10 opacity-30" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="text-base font-bold tracking-tight text-accent">
          {th.meta.brand}
        </Link>
        <Link
          href="/discover"
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-medium transition hover:border-accent/70 hover:text-accent"
        >
          {th.landing.headerCta}
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:pb-24 lg:pt-24">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold tracking-wide text-accent sm:text-sm">
            <span className="size-1.5 rounded-full bg-accent" />
            {th.landing.eyebrow}
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.1] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {th.landing.titleLineOne}
            <span className="mt-2 block text-accent">{th.landing.titleLineTwo}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-muted sm:text-lg">
            {th.landing.description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/discover"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover"
            >
              {th.landing.primaryCta}
              <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link
              href="/streaming"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border-strong bg-surface/50 px-7 py-3 text-sm font-semibold transition hover:border-accent/50 hover:text-accent"
            >
              {th.landing.secondaryCta}
            </Link>
          </div>

          <p className="mt-5 text-xs text-subtle">{th.landing.helper}</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg" aria-label={th.landing.previewLabel}>
          <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-surface/90 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:p-7">
            <div className="flex items-center justify-between border-b border-border pb-5">
              <div>
                <p className="text-xs text-muted">{th.landing.previewEyebrow}</p>
                <p className="mt-1 font-bold">{th.landing.previewTitle}</p>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">TH</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {th.landing.previewTopics.map((topic, index) => (
                <span
                  key={topic}
                  className={index < 2 ? "rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-foreground" : "rounded-full border border-border-strong px-3 py-2 text-xs text-muted"}
                >
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">
              {th.landing.previewMovies.map((movie, index) => (
                <div key={movie}>
                  <div
                    aria-hidden="true"
                    className={`aspect-[2/3] rounded-xl border border-white/10 ${index === 0 ? "bg-[linear-gradient(155deg,#72603c,#17151b_70%)]" : index === 1 ? "bg-[linear-gradient(155deg,#3b536d,#15161c_70%)]" : "bg-[linear-gradient(155deg,#684148,#17151b_70%)]"}`}
                  >
                    <div className="flex h-full items-end p-2">
                      <span className="text-[10px] font-semibold text-white/70">{index + 1}</span>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold">{movie}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs">
              <span className="text-muted">{th.landing.previewResult}</span>
              <span className="font-bold text-accent">{th.landing.previewMatch}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-black/15">
        <div className="mx-auto grid w-full max-w-7xl gap-px px-5 py-5 sm:grid-cols-3 sm:px-8 lg:px-12">
          {features.map((feature) => (
            <article key={feature.number} className="border-border px-0 py-6 sm:border-l sm:px-7 sm:first:border-l-0 lg:px-10">
              <p className="text-xs font-bold tracking-[0.2em] text-accent">{feature.number}</p>
              <h2 className="mt-3 text-base font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
