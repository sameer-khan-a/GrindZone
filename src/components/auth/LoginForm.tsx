import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const LoginForm: React.FC = () => {
  const [identifier, setIdentifier] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both username/email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // important: allow httpOnly cookie from backend
        body: JSON.stringify({ email: identifier, password }), // backend expects `email`
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Show friendly message from server if available
        const message = data?.message || "Login failed";
        toast({
          title: "Login failed",
          description: message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Server returns minimal user info and sets httpOnly cookie.
      // Don't store JWT in localStorage. Use server cookie + backend session / refresh token.
      const user = data?.user || null;

      // Persist basic non-sensitive UI state if you need to (not tokens)
      if (user) {
        localStorage.setItem("userName", user.username || user.email || "");
        // If backend provides role, persist it for UI-only checks
        if (user.role) localStorage.setItem("userRole", user.role);
        else localStorage.setItem("userRole", "user");
      }

      toast({
        title: "Login successful",
        description: "Welcome back to GrindZone!",
        duration: 2500,
      });

      // Redirect: admin -> /admin, else -> /tournaments
      const role = user?.role || localStorage.getItem("userRole") || "user";
      setTimeout(() => {
        if (role === "admin") navigate("/admin");
        else navigate("/tournaments");
      }, 700);
    } catch (err: any) {
      console.error("Login error:", err);
      toast({
        title: "Network error",
        description: "Could not reach server. Try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-glow-sm w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
      <p className="text-zinc-400 mb-6">Log in to continue your gaming journey</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Username / Email</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="Enter username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-purple-500 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
            disabled={isLoading}
          />
          <Label htmlFor="remember" className="text-sm">
            Remember me
          </Label>
        </div>

        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-500" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>

        <div className="text-center mt-6">
          <p className="text-sm text-zinc-400">
            Don't have an account?{" "}
            <Link to="/signup" className="text-purple-500 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
