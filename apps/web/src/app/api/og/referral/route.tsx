import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')    || 'MAYA-U42'
  const prize   = searchParams.get('prize')   || 'Free Chips & Guac'
  const biz     = searchParams.get('biz')     || 'El Fuego Taco Truck'
  const dist    = searchParams.get('dist')    || '0.2 mi'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0f0a1e',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'Arial Black, Arial',
          padding: '60px',
        }}
      >
        {/* Logo */}
        <div style={{ fontSize: 48, fontWeight: 900, color: '#F7941D', marginBottom: 8 }}>
          SerendipEatery
        </div>
        <div style={{ fontSize: 14, color: 'rgba(247,148,29,0.5)', letterSpacing: 4, marginBottom: 48 }}>
          SPIN YOUR NEXT MEAL
        </div>

        {/* Win card */}
        <div style={{
          background: '#1a0e00',
          border: '1px solid rgba(247,148,29,0.3)',
          borderRadius: 24,
          padding: '40px 60px',
          textAlign: 'center',
          marginBottom: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, color: 'rgba(247,148,29,0.5)', letterSpacing: 3, marginBottom: 16 }}>
            FLASH DEAL WON AT
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#F7941D', marginBottom: 8 }}>
            {biz}
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: 'white', marginBottom: 16 }}>
            {prize}
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
            {dist} away · right now
          </div>
        </div>

        {/* Referral code */}
        <div style={{
          background: 'rgba(247,148,29,0.1)',
          border: '1px dashed rgba(247,148,29,0.5)',
          borderRadius: 16,
          padding: '20px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: 14, color: 'rgba(247,148,29,0.5)', letterSpacing: 2, marginBottom: 8 }}>
            JOIN WITH CODE · GET 50 BONUS POINTS
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 6, color: '#F7941D' }}>
            {code}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
