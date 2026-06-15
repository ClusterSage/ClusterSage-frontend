import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
export default function RegisterPage() { return <main className="p-8"><AuthForm mode="register" /><p className="mt-4 text-center text-sm text-slate-600">Already registered? <Link className="text-blue-700" href="/login">Log in</Link></p></main>; }
