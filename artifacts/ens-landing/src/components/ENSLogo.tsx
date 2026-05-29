import { Link } from 'wouter';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ENSLogoProps {
  size?: 'sm' | 'md';
  showTagline?: boolean;
  iconOnly?: boolean;
  className?: string;
  href?: string;
}

type SquareDef = { delay: number; isLast: boolean };

const squareVariants: Variants = {
  rest: (sq: SquareDef) => ({
    scale: 1,
    opacity: sq.isLast ? 0.15 : 1,
    backgroundColor: 'currentColor',
  }),
  hover: (sq: SquareDef) => ({
    scale: 1.2,
    opacity: 1,
    backgroundColor: sq.isLast ? 'rgb(109,40,217)' : 'currentColor',
    transition: { delay: sq.delay, duration: 0.18, ease: 'easeOut' },
  }),
};

const SQUARES: SquareDef[] = [
  { delay: 0, isLast: false },
  { delay: 0.04, isLast: false },
  { delay: 0.08, isLast: false },
  { delay: 0.13, isLast: true },
];

export function ENSLogo({
  size = 'sm',
  showTagline = false,
  iconOnly = false,
  className,
  href = '/',
}: ENSLogoProps) {
  const sq = size === 'md' ? 11 : 8;
  const gap = size === 'md' ? 3 : 2;
  const rx = size === 'md' ? 3 : 2;

  return (
    <Link href={href} aria-label="ENS">
      <motion.div
        initial="rest"
        animate="rest"
        whileHover="hover"
        className={cn(
          'inline-flex items-center cursor-pointer select-none',
          iconOnly ? 'justify-center' : 'gap-2.5',
          className
        )}
      >
        {/* 2×2 grid of squares — purely decorative */}
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(2, ${sq}px)`,
            gap: `${gap}px`,
          }}
        >
          {SQUARES.map((sqDef, i) => (
            <motion.div
              key={i}
              custom={sqDef}
              variants={squareVariants}
              style={{ width: sq, height: sq, borderRadius: rx }}
              className="text-foreground"
            />
          ))}
        </div>

        {/* Text block */}
        {!iconOnly && (
          <div aria-hidden="true" className="flex flex-col justify-center">
            <span
              className={cn(
                'font-black tracking-tighter leading-none',
                size === 'md' ? 'text-[22px]' : 'text-[17px]'
              )}
            >
              ENS
            </span>
            {showTagline && (
              <>
                <div className="h-px bg-foreground/15 mt-1 mb-1 w-full" />
                <span className="text-[8px] font-semibold tracking-[0.28em] text-muted-foreground uppercase leading-none whitespace-nowrap">
                  Booth Designer Pro
                </span>
              </>
            )}
          </div>
        )}
      </motion.div>
    </Link>
  );
}
