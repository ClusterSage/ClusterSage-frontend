import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
export default function LoginPage() { return <main className="p-8"><AuthForm mode="login" /><p className="mt-4 text-center text-sm text-slate-600">Need an account? <Link className="text-blue-700" href="/register">Register</Link></p></main>; }
