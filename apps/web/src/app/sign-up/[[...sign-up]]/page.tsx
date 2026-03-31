import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-night">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#F7941D',
            colorBackground: '#0f0a1e',
            colorText: '#fff8f2',
            colorInputBackground: '#1a1230',
            colorInputText: '#fff8f2',
          },
        }}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
      />
    </main>
  )
}
