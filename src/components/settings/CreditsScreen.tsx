"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ExternalLinkIcon, GitHubIcon, HeartIcon } from "@/components/ui/icons";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLocale, useT } from "@/lib/i18n/useT";

const CREATOR = { name: "IPandragonI", url: "https://github.com/IPandragonI" };
const REPOSITORY = "https://github.com/IPandragonI/Cherry";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "local";
const BUILT_AT = process.env.NEXT_PUBLIC_BUILD_TIME;

const TECH: { name: string; url: string; role: MessageKey }[] = [
  { name: "Next.js", url: "https://nextjs.org", role: "credits.tech.next" },
  { name: "React", url: "https://react.dev", role: "credits.tech.react" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", role: "credits.tech.tailwind" },
  { name: "daisyUI", url: "https://daisyui.com", role: "credits.tech.daisyui" },
  { name: "Zustand", url: "https://github.com/pmndrs/zustand", role: "credits.tech.zustand" },
  { name: "pitchy", url: "https://github.com/ianprime0509/pitchy", role: "credits.tech.pitchy" },
  { name: "fft.js", url: "https://github.com/indutny/fft.js", role: "credits.tech.fft" },
  { name: "NoSleep.js", url: "https://github.com/richtr/NoSleep.js", role: "credits.tech.nosleep" },
  { name: "Serwist", url: "https://serwist.pages.dev", role: "credits.tech.serwist" },
  {
    name: "Fraunces",
    url: "https://fonts.google.com/specimen/Fraunces",
    role: "credits.tech.fonts",
  },
  { name: "Vercel", url: "https://vercel.com", role: "credits.tech.vercel" },
];

export function CreditsScreen() {
  const t = useT();
  const locale = useLocale();
  // UTC so the server-rendered and hydrated text always match.
  const builtOn = BUILT_AT
    ? new Date(BUILT_AT).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "–";

  return (
    <div className="space-y-5 px-4 pt-4 pb-6">
      <header className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label={t("credits.back")}
          className="btn btn-circle size-11 btn-ghost"
        >
          <ChevronLeftIcon width={24} height={24} />
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("credits.title")}</h1>
      </header>

      <section className="flex flex-col items-center gap-2 rounded-box bg-base-200 p-5 text-center">
        <Image
          src="/logo.webp"
          alt=""
          width={96}
          height={96}
          unoptimized
          className="size-24 -rotate-6 rounded-[22%] drop-shadow-lg"
        />
        <h2 className="font-display text-4xl font-semibold text-primary">Cherry</h2>
        <dl className="grid w-full grid-cols-3 gap-2 text-sm">
          <Info label={t("credits.version")} value={`v${VERSION}`} />
          <Info label={t("credits.build")} value={COMMIT} mono />
          <Info label={t("credits.builtOn")} value={builtOn} />
        </dl>
      </section>

      <section className="space-y-3 rounded-box bg-base-200 p-4">
        <h2 className="font-display text-xl font-semibold">{t("credits.createdBy")}</h2>
        <a
          href={CREATOR.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-3"
        >
          <span className="grid size-11 place-items-center rounded-full bg-primary font-display text-xl text-primary-content">
            {CREATOR.name.charAt(0)}
          </span>
          <span className="font-semibold">{CREATOR.name}</span>
          <ExternalLinkIcon width={18} height={18} className="ml-auto text-base-content/60" />
        </a>
        <a
          href={REPOSITORY}
          target="_blank"
          rel="noopener noreferrer"
          className="btn min-h-11 w-full gap-2 rounded-full bg-neutral text-neutral-content"
        >
          <GitHubIcon size={18} /> {t("credits.sourceCode")}
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">{t("credits.builtWith")}</h2>
        <ul className="grid grid-cols-2 gap-2">
          {TECH.map((tech) => (
            <li key={tech.name}>
              <a
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-field bg-base-200 px-3 py-2 transition-transform active:translate-y-0.5"
              >
                <span className="font-semibold">{tech.name}</span>
                <span className="text-xs text-base-content/75">{t(tech.role)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-base-content/75">
        <HeartIcon filled width={16} height={16} className="text-secondary" />
        {t("credits.madeFor")}
      </p>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-field bg-base-100 px-2 py-1.5">
      <dt className="text-xs text-base-content/75">{label}</dt>
      <dd className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
