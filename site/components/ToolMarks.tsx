/* Simplified single-colour marks for the "works with" row. They are drawn at
   20px in a muted ink, so each one only has to carry its silhouette - the name
   sits next to it and does the identifying. All inherit currentColor. */

export function ClaudeMark({ className = "" }: { className?: string }) {
  // The Claude burst: tapered spokes radiating from the centre.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x="11.05"
          y="1.6"
          width="1.9"
          height={i % 3 === 0 ? 9.2 : 8.1}
          rx="0.95"
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function VsCodeMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M75.6 3.2 96.4 13.2c2.2 1.1 3.6 3.3 3.6 5.8v62c0 2.5-1.4 4.7-3.6 5.8l-20.8 10c-2.6 1.2-5.6.7-7.6-1.3L30.8 61.1 11.7 75.6c-1.3 1-3.1.9-4.3-.2l-6.3-5.8c-1.5-1.4-1.5-3.7 0-5.1L17.7 50 1.1 35.5c-1.5-1.4-1.5-3.7 0-5.1l6.3-5.8c1.2-1.1 3-1.2 4.3-.2l19.1 14.5L68 4.5c2-2 5-2.5 7.6-1.3ZM75 27.5 47.5 50 75 72.5V27.5Z"
      />
    </svg>
  );
}

export function CursorMark({ className = "" }: { className?: string }) {
  // The isometric cube silhouette, with its two visible interior seams.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1.8 21.4 7v10L12 22.2 2.6 17V7L12 1.8Z" />
      <path d="M12 22.2V12M12 12 2.6 7M12 12l9.4-5" />
    </svg>
  );
}

export function JetBrainsMark({ className = "" }: { className?: string }) {
  /* The JetBrains family mark is a rounded square holding a JB monogram. That
     silhouette is all a 20px glyph can carry, so the square and the monogram
     are what this draws - no attempt at the angular gradient, which would only
     turn to mud at this size. */
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="1.6"
        y="1.6"
        width="20.8"
        height="20.8"
        rx="4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize="9.5"
        fontWeight="700"
        fontFamily="var(--font-sans)"
        letterSpacing="-0.4"
      >
        JB
      </text>
    </svg>
  );
}
