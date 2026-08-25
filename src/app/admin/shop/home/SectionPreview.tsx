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
  // Full-bleed banner with the copy card pinned right, arrows at the edges.
  hero: (
    <>
      <B x={0} y={0} w={W} h={H} o={0.14} r={6} />
      <B x={48} y={11} w={42} h={42} o={0.3} r={4} />
      <L x={52} y={17} w={13} o={0.5} />
      <L x={52} y={24} w={33} o={0.55} />
      <L x={52} y={30} w={24} o={0.3} />
      <B x={52} y={38} w={17} h={9} o={0.5} r={2} />
      <B x={72} y={38} w={14} h={9} o={0.3} r={2} />
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
  // A chapter title alone in its band: eyebrow, big heading with its icon, lead.
  section_heading: (
    <>
      <L x={6} y={17} w={16} o={0.5} />
      <B x={6} y={25} w={9} h={9} o={0.34} r={2} />
      <L x={19} y={28} w={46} o={0.55} />
      <L x={6} y={41} w={62} o={0.24} />
      <L x={6} y={47} w={38} o={0.24} />
    </>
  ),
  // Two bands with air between them — what the block actually contributes.
  separator: (
    <>
      <B x={0} y={0} w={W} h={22} o={0.22} r={0} />
      <B x={0} y={42} w={W} h={22} o={0.22} r={0} />
      <rect x={22} y={32} width={60} height="1.5" rx="0.75" fill="currentColor" opacity={0.3} />
    </>
  ),
  // A short heading over a dense block of small copy.
  seo_text: (
    <>
      <L x={6} y={12} w={28} o={0.42} />
      {[22, 29, 36, 43, 50].map((y, i) => (
        <L key={y} x={6} y={y} w={i === 4 ? 44 : 92} o={0.18} />
      ))}
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
