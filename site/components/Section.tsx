import type { ReactNode } from "react";

type Props = {
  id?: string;
  kicker?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function Section({ id, kicker, title, intro, children, className = "" }: Props) {
  return (
    <section id={id} className={`shell scroll-mt-24 py-20 md:py-28 ${className}`}>
      {(kicker || title || intro) && (
        <div className="max-w-2xl">
          {kicker && <p className="kicker">{kicker}</p>}
          {title && (
            <h2 className="font-display mt-5 t-section text-ink">{title}</h2>
          )}
          {intro && <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
