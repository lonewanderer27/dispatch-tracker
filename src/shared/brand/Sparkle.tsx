import type { SVGProps } from 'react'

// The Tidy Team four-point sparkle (Design System, `tt-sparkle`). Decorative, so hidden from
// assistive technology. It takes its colour from `currentColor` and its size from the font size.
export function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="tt-sparkle"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z" />
    </svg>
  )
}
