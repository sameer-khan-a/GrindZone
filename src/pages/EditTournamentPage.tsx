// src/pages/EditTournamentPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

type TournamentForm = {
  name: string;
  game: string;
  date?: string;
  tier?: string;
  participants?: string;
  prizePool?: string;
  entryFee?: string;
  description?: string;
  rules?: string | string[]; // accept both shapes
  image?: string;
};

const buildHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const EditTournamentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TournamentForm>({
    name: "",
    game: "",
    date: "",
    tier: "",
    participants: "",
    prizePool: "",
    entryFee: "",
    description: "",
    rules: "",
    image: "",
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tournaments/${id}`, { headers: buildHeaders() });
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          toast({ title: "Error", description: `Failed to load: ${res.status} ${text}`, variant: "destructive" });
          navigate("/admin");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          // Normalize rules into a string for the textarea, but keep original if array
          let rulesField: string | string[] = "";
          if (Array.isArray(data.rules)) {
            rulesField = (data.rules as string[]).join(". ");
          } else if (typeof data.rules === "string") {
            rulesField = data.rules;
          } else {
            rulesField = "";
          }

          setForm({
            name: data.name || "",
            game: data.game || "",
            date: data.date ? new Date(data.date).toISOString().slice(0, 16) : "",
            tier: data.tier || "",
            participants:
              typeof data.participants === "string"
                ? data.participants
                : data.participants
                ? `${data.participants.current ?? 0}/${data.participants.max ?? 0}`
                : "",
            prizePool: data.prizePool || "",
            entryFee: data.entryFee || "",
            description: data.description || "",
            rules: rulesField,
            image: data.image || "",
          });
        }
      } catch (err: any) {
        console.error("Load tournament error", err);
        toast({ title: "Error", description: "Could not load tournament", variant: "destructive" });
        navigate("/admin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, toast]);

  const onChange = (k: keyof TournamentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!id) return;
    if (!form.name || !form.game) {
      toast({ title: "Validation", description: "Name and game are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // prepare payload: be defensive about rules type
      const payload: any = {
        name: form.name,
        game: form.game,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        tier: form.tier,
        participants: form.participants,
        prizePool: form.prizePool,
        entryFee: form.entryFee,
        description: form.description,
        image: form.image,
      };

      if (form.rules) {
        if (Array.isArray(form.rules)) {
          payload.rules = form.rules.map(s => (typeof s === "string" ? s.trim() : String(s))).filter(Boolean);
        } else if (typeof form.rules === "string") {
          // safe split only when it's a string
          payload.rules = form.rules.split(".").map(s => s.trim()).filter(Boolean);
        }
        // otherwise skip rules
      }

      const res = await fetch(`${API_BASE}/tournaments/${id}`, {
        method: "PUT",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status} ${text}`);
      }

      toast({ title: "Saved", description: "Tournament updated" });
      navigate("/admin");
    } catch (err: any) {
      console.error("Save error", err);
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-grindzone-dark">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <p>Loading tournament…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <PageTitle title="Edit Tournament" subtitle={form.name || "Edit details"} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Name</label>
            <input value={form.name} onChange={onChange("name")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Game</label>
            <input value={form.game} onChange={onChange("game")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Date</label>
            <input type="datetime-local" value={form.date} onChange={onChange("date")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Tier</label>
            <input value={form.tier} onChange={onChange("tier")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm">Participants (e.g. 20/32)</label>
            <input value={form.participants} onChange={onChange("participants")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Prize Pool</label>
            <input value={form.prizePool} onChange={onChange("prizePool")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Entry Fee</label>
            <input value={form.entryFee} onChange={onChange("entryFee")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm">Description</label>
            <textarea value={form.description} onChange={onChange("description")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm">Rules (dot separated)</label>
            <textarea value={typeof form.rules === "string" ? form.rules : (Array.isArray(form.rules) ? form.rules.join(". ") : "")} onChange={onChange("rules")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
          <div>
            <label className="block text-sm">Image URL</label>
            <input value={form.image} onChange={onChange("image")} className="w-full p-2 rounded bg-grindzone-card border border-border" />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={() => navigate("/admin")} variant="outline">Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </main>
    </div>
  );
};

export default EditTournamentPage;
