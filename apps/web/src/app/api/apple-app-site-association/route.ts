import { NextResponse } from 'next/server'

export const runtime = 'edge'

// iOS Universal Links config - allows serendip.app links to open the app directly
export async function GET() {
  const config = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'TEAMID.com.serendipeatery.app',
          paths: [
            '/r/*',     // referral links
            '/join/*',  // join with code
            '/deal/*',  // specific deal deep links
            '/sale/*',  // sale direct links
          ],
        },
      ],
    },
  }

  return NextResponse.json(config, {
    headers: { 'content-type': 'application/json' },
  })
}
