import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Android App Links config - allows serendip.app links to open the app directly
export async function GET() {
  const config = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.serendipeatery.app',
        sha256_cert_fingerprints: [
          // Replace with your actual SHA-256 fingerprint from Google Play Console
          'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
        ],
      },
    },
  ]

  return NextResponse.json(config, {
    headers: { 'content-type': 'application/json' },
  })
}
