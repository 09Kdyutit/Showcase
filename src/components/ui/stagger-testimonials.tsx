"use client"

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// 21st.dev "Stagger Testimonials" (@vaib215), adapted for Showcase:
// - semantic tokens resolved to this project's Tailwind v4 theme (the original's
//   hsl(var(--border)) shadows became var(--color-border) — our tokens are OKLCH
//   values, not HSL triplets)
// - pravatar photos replaced with initials tiles (no stock faces on quotes)
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  EVERY QUOTE BELOW IS FICTIONAL PLACEHOLDER COPY — DO NOT SHIP AS-IS.
// Claim Safety (.agents/product-marketing.md): Showcase must not present
// testimonials or social proof without current authoritative evidence. Replace
// with real quotes the named people approved before removing the rendered
// "illustrative" caption in the Voices section. Wording avoids
// BANNED_CLAIM_PATTERNS (no "trusted by", ratings, or digit-based statistics).
// ─────────────────────────────────────────────────────────────────────────────

const SQRT_5000 = Math.sqrt(5000);

const testimonials = [
  {
    tempId: 0,
    testimonial: "I screen a few hundred junior applications a week. A portfolio with evidence attached is the fastest yes I can give.",
    by: "Maya R., Technical Recruiter at a SaaS scale-up",
    tone: '#60a5fa',
  },
  {
    tempId: 1,
    testimonial: "Most new-grad résumés read exactly the same. Case studies with real proof jump straight to the phone-screen pile.",
    by: "Daniel O., Talent Acquisition Lead",
    tone: '#a78bfa',
  },
  {
    tempId: 2,
    testimonial: "We point our students at Showcase before every career fair. They walk in with work they can actually show.",
    by: "Elena V., University Career Services",
    tone: '#34d399',
  },
  {
    tempId: 3,
    testimonial: "The Evidence Audit catches the vague claims recruiters roll their eyes at — before we ever see them.",
    by: "Sofia M., HR Manager at a fintech",
    tone: '#fbbf24',
  },
  {
    tempId: 4,
    testimonial: "You can tell who practiced in the Interview Lab. Their answers have structure, and the receipts are right there.",
    by: "Marcus T., Engineering Hiring Manager",
    tone: '#f472b6',
  },
  {
    tempId: 5,
    testimonial: "I added my Showcase link to three applications and got two replies in a week — after months of silence.",
    by: "Aisha K., new-grad frontend developer",
    tone: '#818cf8',
  },
  {
    tempId: 6,
    testimonial: "The draft it built from my résumé was most of the way there in minutes. I spent my energy on polish instead of a blank page.",
    by: "Leo P., career switcher into data analytics",
    tone: '#34d399',
  },
  {
    tempId: 7,
    testimonial: "Practicing interviews with my own projects as the context is what finally made my answers land.",
    by: "Nadia S., product design graduate",
    tone: '#f472b6',
  },
  {
    tempId: 8,
    testimonial: "The audit told me exactly which claims were missing proof. I fixed my weakest case study the same day.",
    by: "Tomás G., CS senior",
    tone: '#fbbf24',
  },
  {
    tempId: 9,
    testimonial: "Publishing with the preview card made my applications look like they came from someone senior.",
    by: "Jin W., junior ML engineer",
    tone: '#60a5fa',
  },
];

function initials(by: string) {
  return by
    .split(',')[0]
    .split(' ')
    .map((w) => w[0])
    .join('')
    .replace('.', '');
}

interface TestimonialCardProps {
  position: number;
  testimonial: typeof testimonials[0];
  handleMove: (steps: number) => void;
  cardSize: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
  position,
  testimonial,
  handleMove,
  cardSize
}) => {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        "absolute left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
        isCenter
          ? "z-10 bg-primary text-primary-foreground border-primary"
          : "z-0 bg-card text-card-foreground border-border hover:border-primary/50"
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)`,
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter ? "0px 8px 0px 4px var(--color-border)" : "0px 0px 0px 0px transparent"
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-border"
        style={{
          right: -2,
          top: 48,
          width: SQRT_5000,
          height: 2
        }}
      />
      <div
        className="mb-4 flex h-14 w-12 items-center justify-center text-base font-bold text-white"
        style={{
          background: `linear-gradient(135deg, ${testimonial.tone}, oklch(46% 0.21 255))`,
          boxShadow: "3px 3px 0px var(--color-background)"
        }}
        aria-hidden
      >
        {initials(testimonial.by)}
      </div>
      <h3 className={cn(
        "text-base sm:text-xl font-medium",
        isCenter ? "text-primary-foreground" : "text-foreground"
      )}>
        &ldquo;{testimonial.testimonial}&rdquo;
      </h3>
      <p className={cn(
        "absolute bottom-8 left-8 right-8 mt-2 text-sm italic",
        isCenter ? "text-primary-foreground/80" : "text-muted-foreground"
      )}>
        - {testimonial.by}
      </p>
    </div>
  );
};

export const StaggerTestimonials: React.FC = () => {
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(testimonials);

  const handleMove = (steps: number) => {
    const newList = [...testimonialsList];
    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }
    setTestimonialsList(newList);
  };

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia("(min-width: 640px)");
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-muted/30"
      style={{ height: 600 }}
    >
      {testimonialsList.map((testimonial, index) => {
        const position = testimonialsList.length % 2
          ? index - (testimonialsList.length + 1) / 2
          : index - testimonialsList.length / 2;
        return (
          <TestimonialCard
            key={testimonial.tempId}
            testimonial={testimonial}
            handleMove={handleMove}
            position={position}
            cardSize={cardSize}
          />
        );
      })}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button
          onClick={() => handleMove(-1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Previous testimonial"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => handleMove(1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Next testimonial"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
};
