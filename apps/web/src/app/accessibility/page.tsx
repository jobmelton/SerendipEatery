import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accessibility — SerendipEatery',
  description: 'Our commitment to digital accessibility.',
}

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-16">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm mb-8 inline-block" style={{ color: '#b8a898' }}>← Home</Link>

        <h1 className="text-3xl font-black text-surface mb-6">Accessibility</h1>

        <div className="space-y-4 text-surface/80 text-sm leading-relaxed">
          <p>
            SerendipEatery is committed to making our platform accessible to everyone,
            including people with disabilities.
          </p>

          <p>
            We target <strong className="text-surface">WCAG 2.1 Level AA</strong> compliance
            across our web application. This includes:
          </p>

          <ul className="list-disc list-inside space-y-1 text-surface/70">
            <li>Sufficient color contrast ratios for all text</li>
            <li>Keyboard navigable interfaces</li>
            <li>Screen reader compatible content with ARIA labels</li>
            <li>Touch targets meeting minimum size requirements (44x44px)</li>
            <li>Reduced motion support for users who prefer less animation</li>
            <li>Semantic HTML structure</li>
          </ul>

          <p>
            We are continuously improving. If you encounter an accessibility barrier
            or have suggestions, please contact us:
          </p>

          <p>
            <a href="mailto:accessibility@serendipeatery.com" className="text-btc font-bold hover:underline">
              accessibility@serendipeatery.com
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
