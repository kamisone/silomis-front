import type { HomeSectionType } from "@/components/home/sectionTypes";
import styles from "./HomeSections.module.css";

/**
 * A tiny wireframe of each section's storefront layout.
 *
 * An admin arranging a page recognises a shape far faster than a label — the
 * thumbnail is what makes "which block is this?" answerable at a glance, which
 * is the whole job of this screen. Drawn inline in currentColor so it inherits
 * the card's text colour and works in both themes without a second asset.
 */

const W = 104;
const H = 64;

/** Shared ink levels, so every wireframe reads as one drawing system. */
const SURFACE = 0.09;
const BLOCK = 0.2;
const TEXT = 0.34;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.preview} role="presentation" focusable="false">
      <rect x="0" y="0" width={W} height={H} rx="6" fill="currentColor" opacity={SURFACE} />
      {children}
    </svg>
  );
}

/** A filled block (image / card body). */
function B(props: { x: number; y: number; w: number; h: number; o?: number; r?: number }) {
  return <rect x={props.x} y={props.y} width={props.w} height={props.h} rx={props.r ?? 2} fill="currentColor" opacity={props.o ?? BLOCK} />;
}

/** A text line. */
function L(props: { x: number; y: number; w: number; o?: number }) {
  return <rect x={props.x} y={props.y} width={props.w} height="3" rx="1.5" fill="currentColor" opacity={props.o ?? TEXT} />;
}

const PREVIEWS: Record<HomeSectionType, React.ReactNode> = {
  // Full-bleed banner: centred headline, sub, two buttons, arrows at the edges.
  hero: (
    <>
      <B x={0} y={0} w={W} h={H} o={0.14} r={6} />
      <L x={30} y={20} w={44} o={0.45} />
      <L x={36} y={28} w={32} />
      <B x={32} y={38} w={19} h={8} o={0.42} r={3} />
      <B x={54} y={38} w={19} h={8} o={0.22} r={3} />
      <circle cx="8" cy="32" r="4" fill="currentColor" opacity={0.28} />
      <circle cx={W - 8} cy="32" r="4" fill="currentColor" opacity={0.28} />
    </>
  ),
  // Four icon + label pairs across one strip.
  trust_bar: (
    <>
      {[6, 31, 56, 81].map((x) => (
        <g key={x}>
          <circle cx={x + 6} cy={26} r="6" fill="currentColor" opacity={0.28} />
          <L x={x} y={39} w={17} />
          <L x={x} y={46} w={11} o={0.2} />
        </g>
      ))}
    </>
  ),
  // Portrait picture tiles with a label baked into the bottom of each.
  categories: (
    <>
      <L x={6} y={8} w={30} o={0.42} />
      {[6, 31, 56, 81].map((x) => (
        <g key={x}>
          <B x={x} y={18} w={17} h={38} />
          <L x={x + 3} y={48} w={11} o={0.5} />
        </g>
      ))}
    </>
  ),
  // Three wide cards: image on top, name + line underneath.
  featured_collections: (
    <>
      <L x={6} y={8} w={34} o={0.42} />
      {[6, 39, 72].map((x) => (
        <g key={x}>
          <B x={x} y={18} w={26} h={27} />
          <L x={x} y={50} w={20} />
        </g>
      ))}
    </>
  ),
  // A row of product cards, each ending in an add-to-cart button.
  product_rail: (
    <>
      <L x={6} y={8} w={26} o={0.42} />
      <L x={78} y={8} w={20} o={0.24} />
      {[6, 31, 56, 81].map((x) => (
        <g key={x}>
          <B x={x} y={18} w={17} h={19} />
          <L x={x} y={41} w={13} />
          <B x={x} y={48} w={17} h={7} o={0.42} r={2} />
        </g>
      ))}
    </>
  ),
  // One full-width coloured bar: badge, headline, button on the right.
  promo_banner: (
    <>
      <B x={0} y={12} w={W} h={40} o={0.34} r={4} />
      <B x={8} y={19} w={14} h={6} o={0.5} r={3} />
      <L x={8} y={30} w={40} o={0.6} />
      <L x={8} y={38} w={28} o={0.4} />
      <B x={72} y={27} w={24} h={11} o={0.62} r={3} />
    </>
  ),
  // Three article cards: wide image, category line, headline.
  blog_posts: (
    <>
      <L x={6} y={8} w={30} o={0.42} />
      {[6, 39, 72].map((x) => (
        <g key={x}>
          <B x={x} y={18} w={26} h={13} />
          <B x={x} y={35} w={9} h={4} o={0.3} r={2} />
          <L x={x} y={43} w={26} />
          <L x={x} y={50} w={18} o={0.22} />
        </g>
      ))}
    </>
  ),
};

export default function SectionPreview({ type }: { type: HomeSectionType }) {
  return <Frame>{PREVIEWS[type]}</Frame>;
}
