import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-night">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#F7941D',
            colorBackground: '#0f0a1e',
            colorText: '#fff8f2',
            colorInputBackground: '#1a1230',
            colorInputText: '#fff8f2',
          },
        }}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/consumer"
      />
    </main>
  )
}
