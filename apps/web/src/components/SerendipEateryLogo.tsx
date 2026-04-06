/**
 * SerendipEatery logo mark.
 * "Eatery" sits directly below "Serendip", rotated 180deg with a
 * gradient fade (E bold, Y fading). Right-aligned so edges match.
 *
 * Sizes: lg (landing hero), md (page headers), sm (nav/inline).
 */

const SIZES = {
  lg: { serendip: '2.5rem', eatery: '2.3rem' },
  md: { serendip: '1.5rem', eatery: '1.4rem' },
  sm: { serendip: '1.2rem', eatery: '1.1rem' },
} as const

export function SerendipEateryLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { serendip, eatery } = SIZES[size]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
      <div style={{ fontSize: serendip, fontWeight: 900 }}>
        <span style={{ color: '#F7941D' }}>S</span>
        <span style={{ color: '#fff8f2' }}>erendip</span>
      </div>
      <div style={{
        fontSize: eatery,
        fontWeight: 900,
        transform: 'rotate(180deg)',
        background: 'linear-gradient(to right, transparent 0%, #F7941D 40%, #F7941D 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginTop: '-2px',
      }}>
        Eatery
      </div>
    </div>
  )
}
