// src/pages/SquadPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon, EditIcon, Trash2Icon, DownloadCloud } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/* ---------------- types ---------------- */
interface Member {
  _id?: string;
  name?: string;
  role?: string;
  joinedAt?: string;
  status?: string;
  [k: string]: any;
}

interface Squad {
  id?: string;
  _id?: string;
  name?: string;
  tag?: string;
  tier?: string;
  logo?: string;
  members?: Member[] | Record<string, Member> | null;
  wins?: number;
  losses?: number;
  createdAt?: string;
  [k: string]: any;
}

/* ---------------- config ---------------- */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

/* ---------------- helpers ---------------- */
const buildHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const normalizeSquad = (raw: any, idx = 0): Squad => {
  const id = raw.id || raw._id || `tmp-${idx}`;
  let members: Member[] = [];
  if (Array.isArray(raw.members)) members = raw.members;
  else if (raw.members && typeof raw.members === "object") {
    if (Object.keys(raw.members).every(k => typeof (raw.members as any)[k] === "object")) {
      members = Object.values(raw.members as any);
    } else {
      members = [raw.members];
    }
  } else members = [];

  members = members.map(m => (m && typeof m === "object" ? m : { name: String(m) }));

  return {
    ...raw,
    id,
    members,
    wins: typeof raw.wins === "number" ? raw.wins : Number(raw.wins) || 0,
    losses: typeof raw.losses === "number" ? raw.losses : Number(raw.losses) || 0,
  };
};

const downloadCSV = (filename: string, rows: string[]) => {
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ---------------- small UI components ---------------- */
function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center justify-between bg-grindzone-card/30 rounded p-4">
          <div className="h-4 w-64 bg-grindzone-darker rounded" />
          <div className="h-4 w-24 bg-grindzone-darker rounded" />
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, title, description, onConfirm, onCancel }: { open: boolean; title?: string; description?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md p-6 bg-grindzone-card rounded border border-border">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-500" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

function SquadModal({ open, initial, onClose, onSave }: { open: boolean; initial?: Partial<Squad>; onClose: () => void; onSave: (payload: Partial<Squad>) => Promise<void> }) {
  const [form, setForm] = useState<Partial<Squad>>(initial ?? {});
  useEffect(() => setForm(initial ?? {}), [initial, open]);

  const savingRef = useRef(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      // onSave shows toast and throws if needed
    } finally {
      savingRef.current = false;
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <form className="relative z-10 w-full max-w-lg p-6 bg-grindzone-card rounded border border-border" onSubmit={submit}>
        <h3 className="text-lg font-semibold mb-2">{initial?.id ? "Edit Squad" : "Create Squad"}</h3>
        <div className="grid gap-2">
          <label className="text-sm">Name
            <input required value={form.name ?? ""} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} className="w-full mt-1 p-2 bg-grindzone-darker rounded border border-border" />
          </label>
          <label className="text-sm">Tag
            <input value={form.tag ?? ""} onChange={e => setForm(s => ({ ...s, tag: e.target.value }))} className="w-full mt-1 p-2 bg-grindzone-darker rounded border border-border" />
          </label>
          <label className="text-sm">Tier
            <select value={form.tier ?? ""} onChange={e => setForm(s => ({ ...s, tier: e.target.value }))} className="w-full mt-1 p-2 bg-grindzone-darker rounded border border-border">
              <option value="">Select tier</option>
              <option value="Professional">Professional</option>
              <option value="Semi-Pro">Semi-Pro</option>
              <option value="Amateur">Amateur</option>
            </select>
          </label>
          <label className="text-sm">Logo URL
            <input value={form.logo ?? ""} onChange={e => setForm(s => ({ ...s, logo: e.target.value }))} className="w-full mt-1 p-2 bg-grindzone-darker rounded border border-border" />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-500">{initial?.id ? "Save" : "Create"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- main component ---------------- */
const SquadPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [squads, setSquads] = useState<Squad[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // controls
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"relevant" | "wins" | "losses">("relevant");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // modals / confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteTargetRef = useRef<Squad | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<Squad> | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);

  const fetchSquads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/squads`, { headers: buildHeaders(), signal });
      if (!res.ok) throw new Error(`Failed to fetch squads (${res.status})`);
      const raw = await res.json();
      const arr = (Array.isArray(raw) ? raw : []).map((r: any, i: number) => normalizeSquad(r, i));
      setSquads(arr);
      if (arr.length && !activeId) setActiveId(arr[0].id ?? arr[0]._id ?? null);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error(err);
      toast({ title: "Error", description: "Could not load squads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeId, toast]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSquads(controller.signal);

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        abortRef.current?.abort();
        const c = new AbortController();
        abortRef.current = c;
        fetchSquads(c.signal);
      }
      if (e.key.toLowerCase() === "n") navigate("/create-squad");
    };
    window.addEventListener("keydown", onKey);

    const id = setInterval(() => fetchSquads(), 60_000);
    return () => {
      controller.abort();
      window.removeEventListener("keydown", onKey);
      clearInterval(id);
    };
  }, [fetchSquads, navigate]);

  // derived
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = squads.slice();
    if (q) arr = arr.filter(s => (s.name || "").toLowerCase().includes(q) || (s.tag || "").toLowerCase().includes(q));
    if (tierFilter) arr = arr.filter(s => ((s.tier || "") === tierFilter));
    if (sortBy === "wins") arr.sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0));
    else if (sortBy === "losses") arr.sort((a, b) => (b.losses ?? 0) - (a.losses ?? 0));
    return arr;
  }, [squads, search, tierFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);
  const pageData = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  /* ---------------- actions ---------------- */
  const openCreate = () => navigate("/create-squad");
  const openEdit = (s: Squad) => { setModalInitial(s); setModalOpen(true); };

  const handleSaveSquad = async (payload: Partial<Squad>) => {
    try {
      if (payload.id || payload._id) {
        const id = payload.id || payload._id!;
        const res = await fetch(`${API_BASE}/squads/${id}`, { method: "PUT", headers: buildHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Update failed (${res.status})`);
        const updated = normalizeSquad(await res.json());
        setSquads(prev => prev.map(s => (s.id === updated.id || s._id === updated.id ? updated : s)));
        toast({ title: "Saved", description: "Squad updated." });
      } else {
        const res = await fetch(`${API_BASE}/squads`, { method: "POST", headers: buildHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Create failed (${res.status})`);
        const created = normalizeSquad(await res.json());
        setSquads(prev => [created, ...prev]);
        setActiveId(created.id ?? created._id ?? null);
        toast({ title: "Created", description: "Squad created." });
      }
    } catch (err: any) {
      console.error("saveSquad error:", err);
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
      throw err;
    }
  };

  const confirmDelete = (squad: Squad) => {
    deleteTargetRef.current = squad;
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    const target = deleteTargetRef.current;
    if (!target) return setConfirmOpen(false);
    setConfirmOpen(false);
    try {
      const id = target.id || target._id;
      if (!id) throw new Error("Missing id");
      const res = await fetch(`${API_BASE}/squads/${id}`, { method: "DELETE", headers: buildHeaders() });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSquads(prev => prev.filter(s => (s.id || s._id) !== id));
      if (activeId === id) {
        setActiveId(prev => {
          const remaining = squads.filter(s => (s.id || s._id) !== id);
          return remaining.length ? (remaining[0].id ?? remaining[0]._id ?? null) : null;
        });
      }
      toast({ title: "Deleted", description: `${target.name ?? "Squad"} removed.` });
    } catch (err: any) {
      console.error("delete error:", err);
      toast({ title: "Error deleting", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const exportSquadsCSV = () => {
    const header = "id,name,tag,tier,wins,losses,members_count,createdAt";
    const rows = [header, ...squads.map(s => {
      const membersCount = Array.isArray(s.members) ? s.members.length : (s.members ? Object.keys(s.members).length : 0);
      const id = (s.id || s._id || "").toString().replace(/,/g, "");
      const name = `"${(s.name || "").replace(/"/g, '""')}"`;
      const tag = `"${(s.tag || "").replace(/"/g, '""')}"`;
      return `${id},${name},${tag},${s.tier || ""},${s.wins || 0},${s.losses || 0},${membersCount},${s.createdAt || ""}`;
    })];
    downloadCSV(`squads-${new Date().toISOString()}.csv`, rows);
  };

  const exportMembersCSV = () => {
    const header = "squadId,squadName,memberId,memberName,role,joinedAt,status";
    const rows = [header];
    squads.forEach(s => {
      const squadId = s.id || s._id || "";
      const squadName = (s.name || "").replace(/"/g, '""');
      const members = Array.isArray(s.members) ? s.members : (s.members ? Object.values(s.members as any) : []);
      members.forEach((m: any) => {
        const mid = m._id || "";
        const name = `"${(m.name || "").replace(/"/g, '""')}"`;
        rows.push(`${squadId},"${squadName}",${mid},${name},${m.role || ""},${m.joinedAt || ""},${m.status || ""}`);
      });
    });
    downloadCSV(`squad-members-${new Date().toISOString()}.csv`, rows);
  };

  /* ---------------- rendering ---------------- */
  const activeSquad = useMemo(() => squads.find(s => (s.id || s._id) === activeId) ?? squads[0] ?? null, [squads, activeId]);

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <PageTitle title="My Squads" subtitle="Manage your teams, members and stats" />
          <div className="flex items-center gap-2">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or tag..." className="bg-grindzone-card p-2 rounded border border-border" />
            <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }} className="bg-grindzone-card p-2 rounded border border-border">
              <option value="">All tiers</option>
              <option value="Professional">Professional</option>
              <option value="Semi-Pro">Semi-Pro</option>
              <option value="Amateur">Amateur</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-grindzone-card p-2 rounded border border-border">
              <option value="relevant">Sort: Relevant</option>
              <option value="wins">Sort: Wins</option>
              <option value="losses">Sort: Losses</option>
            </select>

            <Button onClick={() => {
              abortRef.current?.abort();
              const c = new AbortController();
              abortRef.current = c;
              fetchSquads(c.signal);
            }} className="bg-grindzone-blue/80 hover:bg-grindzone-blue" aria-label="Refresh squads">Refresh</Button>

            <Button onClick={openCreate} className="bg-grindzone-blue hover:bg-grindzone-blue-light"><PlusIcon size={14} /> New</Button>

            <Button onClick={exportSquadsCSV} variant="outline" title="Export squads CSV"><DownloadCloud size={16} /></Button>
            <Button onClick={exportMembersCSV} variant="outline" title="Export members CSV">Members</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* list */} 
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold mb-2">Your Squads</h2>
              <div className="text-sm text-zinc-400">{filtered.length} total</div>
            </div>

            {loading ? <LoadingSkeleton rows={6} /> : (
              <>
                {pageData.map(s => {
                  const membersCount = Array.isArray(s.members) ? s.members.length : (s.members ? Object.keys(s.members as any).length : 0);
                  const key = s.id || s._id || JSON.stringify(s.name) || Math.random().toString(36).slice(2, 9);
                  return (
                    <Card key={key} className={`cursor-pointer transition-colors ${activeSquad && (activeSquad.id || activeSquad._id) === (s.id || s._id) ? "bg-grindzone-blue/20 border-grindzone-blue" : "bg-grindzone-card hover:bg-grindzone-blue/10"}`} onClick={() => setActiveId(s.id || s._id || null)}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-grindzone-darker overflow-hidden flex items-center justify-center">
                          {s.logo ? <img src={s.logo} alt={s.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }} className="w-full h-full object-cover" /> : <span className="font-bold">{s.tag}</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{s.name}</h3>
                            <div className="text-xs text-zinc-400">{s.tier}</div>
                          </div>
                          <div className="text-xs text-zinc-400">{membersCount} members • {s.wins ?? 0}W</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {filtered.length === 0 && <div className="text-sm text-zinc-400 p-4">No squads found.</div>}

                {/* pagination */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                    <div className="px-2">{page} / {totalPages}</div>
                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* details */}
          <div className="lg:col-span-3">
            <Card className="bg-grindzone-card border-border">
              <CardHeader className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-grindzone-darker overflow-hidden flex items-center justify-center">
                    {activeSquad?.logo ? <img src={activeSquad.logo} alt={activeSquad.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }} className="w-full h-full object-cover" /> : <span className="font-bold">{activeSquad?.tag ?? "—"}</span>}
                  </div>
                  <div>
                    <CardTitle>{activeSquad?.name ?? "Select a squad"}</CardTitle>
                    <div className="text-sm text-zinc-400">{activeSquad?.tier ?? "—"} • {(Array.isArray(activeSquad?.members) ? activeSquad!.members!.length : (activeSquad?.members ? Object.keys(activeSquad.members as any).length : 0))} members</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => {
                    if (!activeSquad) return;
                    const sid = String(activeSquad._id ?? activeSquad.id ?? "");
                    console.debug("[InviteNav] squad id:", sid, "isValid?", /^[0-9a-fA-F]{24}$/.test(sid));
                    navigate(`/invite-players?squadId=${encodeURIComponent(sid)}`, {
                      state: { squadId: sid, squadName: activeSquad?.name }
                    });
                  }}>Invite Players</Button>

                  <Button className="bg-grindzone-blue hover:bg-grindzone-blue-light" onClick={() => navigate("/view-matches")}>View Matches</Button>
                </div>
              </CardHeader>

              <CardContent>
                {!activeSquad ? (
                  <div className="p-8 text-center text-zinc-400">Pick a squad from the left to see details.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div className="bg-grindzone-darker rounded p-4 text-center">
                        <div className="text-sm text-zinc-400">Wins</div>
                        <div className="text-2xl font-semibold text-green-500">{activeSquad.wins ?? 0}</div>
                      </div>
                      <div className="bg-grindzone-darker rounded p-4 text-center">
                        <div className="text-sm text-zinc-400">Losses</div>
                        <div className="text-2xl font-semibold text-red-500">{activeSquad.losses ?? 0}</div>
                      </div>
                      <div className="bg-grindzone-darker rounded p-4 text-center">
                        <div className="text-sm text-zinc-400">Win Rate</div>
                        <div className="text-2xl font-semibold text-purple-500">
                          {(((activeSquad.wins ?? 0) / Math.max(1, (activeSquad.wins ?? 0) + (activeSquad.losses ?? 0))) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-2">Members</h3>
                    <div className="bg-grindzone-darker rounded overflow-hidden mb-6">
                      <table className="w-full text-left">
                        <thead className="bg-grindzone-card/50">
                          <tr>
                            <th className="px-4 py-3 text-sm font-medium">Player</th>
                            <th className="px-4 py-3 text-sm font-medium">Role</th>
                            <th className="px-4 py-3 text-sm font-medium">Joined</th>
                            <th className="px-4 py-3 text-sm font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(activeSquad.members) && activeSquad.members.length > 0 ? (
                            activeSquad.members.map((m, i) => {
                              const member = (m && typeof m === "object") ? m as Member : { name: String(m) };
                              return (
                                <tr key={member._id ?? i}>
                                  <td className="px-4 py-3 border-t border-grindzone-darker">
                                    <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-grindzone-blue/20 mr-3" />
                                      <span>{member.name ?? "—"}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 border-t border-grindzone-darker">{member.role ?? "Member"}</td>
                                  <td className="px-4 py-3 border-t border-grindzone-darker">{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "—"}</td>
                                  <td className="px-4 py-3 border-t border-grindzone-darker">
                                    <span className={`px-2 py-1 text-xs rounded-full ${member.status === "Online" ? "bg-green-500/20 text-green-500" : member.status === "In Game" ? "bg-yellow-500/20 text-yellow-500" : "bg-gray-500/20 text-gray-400"}`}>
                                      {member.status ?? "Offline"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan={4} className="px-4 py-3 border-t border-grindzone-darker">No members yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-center gap-4">
                      <Button variant="outline" onClick={() => {
                        if (!activeSquad) return;
                        const sid = String(activeSquad._id ?? activeSquad.id ?? "");
                        console.debug("[InviteNav] squad id:", sid, "isValid?", /^[0-9a-fA-F]{24}$/.test(sid));
                        navigate(`/invite-players?squadId=${encodeURIComponent(sid)}`, {
                          state: { squadId: sid, squadName: activeSquad?.name }
                        });
                      }}>
                        Invite Players
                      </Button>

                      <Button className="bg-grindzone-blue hover:bg-grindzone-blue-light" onClick={() => navigate("/view-matches")}>View Matches</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmModal open={confirmOpen} title={`Delete ${deleteTargetRef.current?.name ?? "squad"}?`} description={`This will permanently delete ${deleteTargetRef.current?.name ?? "this squad"}.`} onConfirm={doDelete} onCancel={() => setConfirmOpen(false)} />

        <SquadModal open={modalOpen} initial={modalInitial} onClose={() => setModalOpen(false)} onSave={handleSaveSquad} />
      </main>
    </div>
  );
};

export default SquadPage;
