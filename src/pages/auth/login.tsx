import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building, Mail, Lock, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Building className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold">AecrenEstates</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            The modern platform for real estate professionals.
          </h2>
          <p className="mt-4 text-lg text-sidebar-foreground/70">
            Manage listings, track leads, schedule viewings, and close deals — all in one place.
          </p>
          <div className="mt-8 flex gap-8">
            <div>
              <p className="font-display text-3xl font-bold text-accent">2.4K+</p>
              <p className="text-sm text-sidebar-foreground/60">Properties managed</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-accent">$180M+</p>
              <p className="text-sm text-sidebar-foreground/60">In closed deals</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-accent">98%</p>
              <p className="text-sm text-sidebar-foreground/60">Client satisfaction</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-sidebar-foreground/40">© 2026 AecrenEstates. All rights reserved.</p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building className="h-6 w-6" />
            </div>
            <span className="font-display text-xl font-bold">AecrenEstates</span>
          </div>

          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue.</p>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo accounts (any password works):</p>
            <p>admin@aecrenestates.com — Administrator</p>
            <p>agent@aecrenestates.com — Agent</p>
            <p>client@aecrenestates.com — Client</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" className="pl-10" {...register("email")} />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" className="pl-10" {...register("password")} />
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-foreground hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
