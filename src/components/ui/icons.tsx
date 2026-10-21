import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const TunerIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 16a8 8 0 0 1 16 0" />
    <path d="M12 16 15.5 9.5" />
    <circle cx="12" cy="16" r="1.4" fill="currentColor" />
    <path d="M6.5 11.5 5 10.5M12 8V6.5M17.5 11.5 19 10.5" />
  </Icon>
);

export const ChordsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M9.7 3.5v17M14.3 3.5v17M5 9h14M5 14h14" />
    <circle cx="9.7" cy="11.5" r="1.3" fill="currentColor" />
    <circle cx="14.3" cy="16.5" r="1.3" fill="currentColor" />
  </Icon>
);

export const FinderIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
    <path d="M8.5 8.2v4.6M10.5 8.2v4.6M12.5 8.2v4.6" strokeWidth={1.4} />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const PaletteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.6-1.9-.4-1.2.4-2.4 1.7-2.4H18a2.5 2.5 0 0 0 2.5-2.6A8.6 8.6 0 0 0 12 3.5Z" />
    <circle cx="7.8" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10.5" cy="7.4" r="1.2" fill="currentColor" />
    <circle cx="15" cy="7.8" r="1.2" fill="currentColor" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
  </Icon>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"
      fill={filled ? "currentColor" : "none"}
    />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 19.5 5.3 15.8 15.8 5.3a2 2 0 0 1 2.9 2.9L8.2 18.7l-3.7.8Z" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Icon>
);

export const ResetIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
    <path d="M4.5 4.5V9H9" />
  </Icon>
);

/** Music flat sign (♭) drawn as a path, so it renders identically in every font. */
export const FlatIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M8.5 3v17.5" />
    <path d="M8.5 20.5c3.2-1.6 7-4 7-7.2 0-2.3-2.4-3.2-4.4-2.1-1 .5-1.9 1.4-2.6 2.3" />
  </Icon>
);

/** Music sharp sign (♯). */
export const SharpIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M9.5 3.5v17M14.5 2.5v17" />
    <path d="M6 10.2 18 7.8M6 16.2l12-2.4" strokeWidth={2.6} />
  </Icon>
);

export const MicOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 9.5V6.5a3 3 0 0 0-5.6-1.5M9 9v2.5a3 3 0 0 0 4.6 2.5" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 10.4 5.2M18.5 11.5c0 .9-.2 1.8-.5 2.6M12 18v2.5" />
    <path d="m4 4 16 16" />
  </Icon>
);

export const MetronomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 3.5h5l4 17h-13l4-17Z" />
    <path d="M7.2 14.5h9.6M12 14.5 16.5 6" />
  </Icon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10" />
  </Icon>
);

/** GitHub mark (used only to link to the source code). */
export const GitHubIcon = ({ size = 24, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.39.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);
