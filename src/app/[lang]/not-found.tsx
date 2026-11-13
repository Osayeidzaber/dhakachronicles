import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">404 · পাতাটি পাওয়া যায়নি · Page not found</h1>
      <p className="mt-4 space-x-4">
        <Link href="/bn" className="underline">
          প্রচ্ছদ
        </Link>
        <Link href="/en" className="underline">
          Home
        </Link>
      </p>
    </div>
  );
}
