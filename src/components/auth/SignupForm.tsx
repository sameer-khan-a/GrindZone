import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const SignupForm: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill out all fields before continuing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Signup failed");
      }

      toast({
        title: "Account created successfully",
        description: "Welcome to GrindZone! Let’s start your esports journey.",
        duration: 3000,
      });

      // Optionally, redirect after a short delay
      setTimeout(() => navigate("/tournaments"), 1200);
    } catch (err: any) {
      toast({
        title: "Signup failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-grindzone-card p-8 rounded-xl border border-border shadow-glow-sm w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">Join GrindZone</h2>
      <p className="text-muted-foreground mb-6">
        Create an account to start your esports journey
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="GamingLegend"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-grindzone-blue hover:bg-grindzone-blue-light"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </Button>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/" className="text-grindzone-blue hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default SignupForm;
