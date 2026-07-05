import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] p-4">
      <SignIn />
    </div>
  );
}

