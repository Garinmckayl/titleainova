import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefce8]">
      <SignUp afterSignUpUrl="/titleai" />
    </div>
  );
}
