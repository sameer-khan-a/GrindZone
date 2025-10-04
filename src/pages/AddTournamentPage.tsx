// src/pages/AddTournamentPage.tsx
import React, { useState } from "react";
import Navbar from "@/components/navigation/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const buildHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const AddTournamentPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    game: "",
    date: "",
    tier: "",
    maxTeams: "32",
    prizePool: "",
    entryFee: "",
    description: "",
    rules: ""
  });

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // basic validation helper
  const validate = () => {
    if (!formData.name.trim()) return "Tournament name is required";
    if (!formData.game.trim()) return "Game is required";
    if (!formData.date) return "Tournament date is required";
    const max = Number(formData.maxTeams);
    if (Number.isNaN(max) || max <= 0) return "Maximum teams must be a positive number";
    return null;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const err = validate();
    if (err) {
      toast({ title: "Missing/invalid info", description: err, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      // prepare payload matching your DB shape — NO hard-coded status
      const maxTeams = Number(formData.maxTeams) || 32;
      const payload: any = {
        name: formData.name.trim(),
        game: formData.game.trim(),
        // send ISO date (backend decides status from date)
        date: new Date(formData.date).toISOString(),
        tier: formData.tier?.trim() || "Standard",
        // keep participants as string like "0/32" to match existing docs
        participants: `0/${maxTeams}`,
        prizePool: formData.prizePool ? String(formData.prizePool).includes("$") ? formData.prizePool : `$${formData.prizePool}` : "",
        entryFee: formData.entryFee ? (String(formData.entryFee).includes("$") ? formData.entryFee : `$${formData.entryFee}`) : "Free",
        // IMPORTANT: no status field here — backend should compute it from date
        description: formData.description?.trim() || "",
        rules: formData.rules ? formData.rules.split(".").map(s => s.trim()).filter(Boolean) : [],
        image: "", // optional, leave empty by default
      };

      const res = await fetch(`${API_BASE}/tournaments`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Server responded ${res.status}: ${text}`);
      }

      const created = await res.json();

      toast({
        title: "Tournament created",
        description: `${created.name || "Tournament"} created successfully`,
      });

      // go back to admin and let it refetch fresh data
      navigate("/admin");
    } catch (error: any) {
      console.error("Error creating tournament:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create tournament",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Add New Tournament</h1>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            Back to Admin
          </Button>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Tournament Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Tournament Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Free Fire Champions Cup"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game">Game *</Label>
                  <Input
                    id="game"
                    name="game"
                    placeholder="e.g. Free Fire, PUBG Mobile"
                    value={formData.game}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Tournament Date *</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      name="date"
                      type="datetime-local"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="bg-zinc-950 border-zinc-800"
                    />
                    <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier">Tournament Tier</Label>
                  <Input
                    id="tier"
                    name="tier"
                    placeholder="e.g. Professional, Amateur"
                    value={formData.tier}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTeams">Maximum Teams</Label>
                  <Input
                    id="maxTeams"
                    name="maxTeams"
                    type="number"
                    placeholder="e.g. 32"
                    value={formData.maxTeams}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prizePool">Prize Pool</Label>
                  <Input
                    id="prizePool"
                    name="prizePool"
                    placeholder="e.g. 5000 or $5000"
                    value={formData.prizePool}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryFee">Entry Fee</Label>
                  <Input
                    id="entryFee"
                    name="entryFee"
                    placeholder="e.g. 250 or Free"
                    value={formData.entryFee}
                    onChange={handleInputChange}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Tournament Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter a detailed description of the tournament..."
                  value={formData.description}
                  onChange={handleInputChange}
                  className="min-h-[120px] bg-zinc-950 border-zinc-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rules">Tournament Rules</Label>
                <Textarea
                  id="rules"
                  name="rules"
                  placeholder="Enter the rules and guidelines for the tournament..."
                  value={formData.rules}
                  onChange={handleInputChange}
                  className="min-h-[150px] bg-zinc-950 border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate('/admin')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Tournament"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AddTournamentPage;
