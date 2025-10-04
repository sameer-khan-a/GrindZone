// src/pages/ManageSquadPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Crown, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Member {
  _id?: string;
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  joinedAt?: string;
  status?: string;
  [k: string]: any;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const buildHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const ManageSquadPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Expect navigation state: { squadId, squadName }
  const navState = (location.state ?? {}) as { squadId?: string; squadName?: string };
  const [squadId, setSquadId] = useState<string | null>(navState.squadId ?? null);
  const [squadName, setSquadName] = useState<string | undefined>(navState.squadName ?? undefined);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [processingMap, setProcessingMap] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const canOperate = Boolean(squadId);

  const normalizeMember = (m: any): Member => ({
    _id: m._id || m.id,
    id: m.id || m._id,
    name: m.name || m.username || m.displayName || "Unknown",
    role: m.role || "Member",
    joinedAt: m.joinedAt,
    status: m.status || "Offline",
    ...m,
  });

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    if (!squadId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/squads/${squadId}`, { headers: buildHeaders(), signal });
      if (!res.ok) {
        // If single squad endpoint doesn't return members, try members sub-endpoint
        const alt = await fetch(`${API_BASE}/squads/${squadId}/members`, { headers: buildHeaders(), signal });
        if (!alt.ok) throw new Error("Members not found");
        const arr = await alt.json();
        setMembers(Array.isArray(arr) ? arr.map(normalizeMember) : []);
        setLoading(false);
        return;
      }
      const json = await res.json();
      // If server returns `members` inside squad object
      if (Array.isArray(json.members)) {
        setMembers(json.members.map(normalizeMember));
      } else if (Array.isArray(json)) {
        // odd API shape: returns array
        setMembers(json.map(normalizeMember));
      } else {
        setMembers([]);
      }

      // set squadName if returned
      if (!squadName && (json.name || json.tag)) {
        setSquadName(json.name ?? json.tag);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("fetchMembers error", err);
        toast({ title: "Error", description: "Failed to fetch members", variant: "destructive" });
      }
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [squadId, squadName, toast]);

  useEffect(() => {
    const ac = new AbortController();
    fetchMembers(ac.signal);
    return () => ac.abort();
  }, [fetchMembers, refreshKey]);

  // Invite handler
  const handleInvite = async () => {
    if (!canOperate) {
      toast({ title: "No squad selected", description: "Open a squad first", variant: "destructive" });
      return;
    }
    const identifier = inviteIdentifier.trim();
    if (!identifier) {
      toast({ title: "Missing", description: "Enter username or email", variant: "destructive" });
      return;
    }

    setProcessingMap(p => ({ ...p, invite: true }));
    try {
      // Try squad invite endpoint — adapt if your backend uses different route
      const res = await fetch(`${API_BASE}/squads/${squadId}/invite`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) {
        let msg = `Invite failed (${res.status})`;
        try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
        throw new Error(msg);
      }
      toast({ title: "Invite sent", description: `Invitation sent to ${identifier}` });
      setInviteIdentifier("");
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error("invite error", err);
      toast({ title: "Invite failed", description: err.message || "Try again", variant: "destructive" });
    } finally {
      setProcessingMap(p => { const c = { ...p }; delete c.invite; return c; });
    }
  };

  // Promote handler
  const handlePromote = async (memberId?: string) => {
    if (!canOperate || !memberId) return;
    setProcessingMap(p => ({ ...p, [memberId]: true }));
    const prev = members.slice();
    try {
      const url = `${API_BASE}/squads/${squadId}/members/${memberId}`;
      // try PATCH
      let r = await fetch(url, { method: "PATCH", headers: buildHeaders(), body: JSON.stringify({ role: "Captain" }) });
      if (!r.ok) {
        // fallback to PUT
        r = await fetch(url, { method: "PUT", headers: buildHeaders(), body: JSON.stringify({ role: "Captain" }) });
      }
      if (!r.ok) throw new Error(`Promote failed (${r.status})`);
      // optimistic update
      setMembers(ms => ms.map(m => ({ ...m, role: (m._id === memberId || m.id === memberId) ? "Captain" : (m.role === "Captain" ? "Member" : m.role) })));
      toast({ title: "Promoted", description: "Member promoted to Captain." });
    } catch (err: any) {
      console.error("promote error", err);
      setMembers(prev);
      toast({ title: "Error", description: err.message || "Promotion failed", variant: "destructive" });
    } finally {
      setProcessingMap(p => { const c = { ...p }; delete c[memberId]; return c; });
    }
  };

  // Remove handler
  const handleRemove = async (memberId?: string, memberName?: string) => {
    if (!canOperate || !memberId) return;
    if (!confirm(`Remove ${memberName ?? "this member"}? This cannot be undone.`)) return;
    setProcessingMap(p => ({ ...p, [memberId]: true }));
    const prev = members.slice();
    setMembers(ms => ms.filter(m => (m._id || m.id) !== memberId));
    try {
      const res = await fetch(`${API_BASE}/squads/${squadId}/members/${memberId}`, { method: "DELETE", headers: buildHeaders() });
      if (!res.ok) {
        let msg = `Delete failed (${res.status})`;
        try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
        throw new Error(msg);
      }
      toast({ title: "Removed", description: `${memberName ?? "Member"} removed.` });
    } catch (err: any) {
      console.error("remove error", err);
      setMembers(prev);
      toast({ title: "Error", description: err.message || "Remove failed", variant: "destructive" });
    } finally {
      setProcessingMap(p => { const c = { ...p }; delete c[memberId]; return c; });
    }
  };

  const membersCount = members.length;
  const captain = members.find(m => m.role === "Captain") ?? null;

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Manage Squad" subtitle={squadName ?? (squadId ? `Managing ${squadId}` : "Update squad members and roles")} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/squad")}>Back</Button>
          </div>
        </div>

        {!canOperate && (
          <div className="mb-6 p-4 rounded bg-yellow-900/20 text-yellow-200">
            No squad selected. Open a squad from the squads list first.
          </div>
        )}

        <div className="mb-6 max-w-md">
          <Input
            placeholder="Invite player by username or email"
            className="bg-grindzone-card text-white placeholder-gray-400"
            value={inviteIdentifier}
            onChange={(e) => setInviteIdentifier(e.target.value)}
            disabled={!canOperate || Boolean(processingMap.invite)}
          />
          <div className="flex gap-2 mt-2">
            <Button
              className="bg-grindzone-blue hover:bg-grindzone-blue-light flex items-center gap-2"
              onClick={handleInvite}
              disabled={!canOperate || Boolean(processingMap.invite)}
            >
              <UserPlus size={16} /> Send Invite
            </Button>
            <Button variant="ghost" onClick={() => setRefreshKey(k => k + 1)} disabled={!canOperate || loading}>Refresh</Button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Current Members</h3>
          <div className="text-sm text-zinc-400">{membersCount} members {captain ? `• Captain: ${captain.name}` : ""}</div>
        </div>

        {loading ? (
          <div className="text-zinc-400">Loading members...</div>
        ) : (
          <div className="space-y-4">
            {members.length === 0 && <div className="text-muted-foreground text-center p-4">No members in this squad yet.</div>}

            {members.map(member => {
              const id = member._id || member.id || Math.random().toString(36).slice(2, 9);
              return (
                <Card key={id} className="bg-grindzone-card border border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>

                    <div className="flex gap-2">
                      {member.role !== "Captain" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handlePromote(member._id || member.id)}
                          title="Promote to Captain"
                          disabled={Boolean(processingMap[id])}
                        >
                          <Crown className="text-yellow-500" size={18} />
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemove(member._id || member.id, member.name)}
                        title="Remove Member"
                        disabled={Boolean(processingMap[id])}
                      >
                        <Trash2 className="text-red-500" size={18} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageSquadPage;
