"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/useT";
import { ChordsIcon, FinderIcon, SettingsIcon, TunerIcon } from "./icons";

const TABS: { href: string; label: MessageKey; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/", label: "tab.tuner", Icon: TunerIcon },
  { href: "/chords", label: "tab.chords", Icon: ChordsIcon },
  { href: "/finder", label: "tab.finder", Icon: FinderIcon },
  { href: "/settings", label: "tab.settings", Icon: SettingsIcon },
];

export function TabBar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-[84px] max-w-md grid-cols-4 px-2 pb-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary ${
                  active ? "text-primary" : "text-base-content/75 hover:text-base-content"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-primary/12" : ""
                  }`}
                >
                  <Icon width={24} height={24} />
                </span>
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
