// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Trophy, Medal } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type MatchItem = {
  opponent?: string;
  result?: string;
  score?: string;
  date?: string;
  matchId?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  damageDealt?: number;
  map?: string;
  duration?: string;
};

type UserProfile = {
  _id?: string;
  username?: string;
  avatarUrl?: string;
  tier?: string;
  bio?: string;
  createdAt?: string;
  stats?: {
    matchesPlayed?: number;
    wins?: number;
    winRate?: string;
    tournamentWins?: number;
    highestFinish?: string;
  };
  badges?: { name: string; description?: string }[];
  recentMatches?: MatchItem[];
  friendRequests?: { _id?: string; fromUser?: { _id?: string; username?: string } }[]; // optional shape
  squadInvites?: { _id?: string; squad?: { _id?: string; name?: string } }[]; // optional shape
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Record<string, boolean>>({});

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        credentials: "include",
      });
      if (res.status === 401) {
        setError("Not authenticated");
        setUser(null);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Server error: ${res.status} ${text}`);
        setUser(null);
        return;
      }
      const json = await res.json();
      // backend might return { user: {...} } or the user object directly
      const profile = json?.user ?? json;
      // normalize fields to our shape
      const normalized: UserProfile = {
        _id: profile?._id ?? profile?.id,
        username: profile?.username ?? profile?.name ?? "Unknown",
        avatarUrl: profile?.avatarUrl ?? profile?.avatar ?? profile?.photoUrl ?? "/placeholder.svg",
        tier: profile?.tier ?? "Unranked",
        bio: profile?.bio ?? profile?.about ?? "",
        createdAt: profile?.createdAt ?? profile?.created_at,
        stats: profile?.stats ?? {
          matchesPlayed: profile?.matchesPlayed ?? 0,
          wins: profile?.wins ?? 0,
          winRate: profile?.winRate ?? "0.0%",
          tournamentWins: profile?.tournamentWins ?? 0,
          highestFinish: profile?.highestFinish ?? "—",
        },
        badges: profile?.badges ?? profile?.achievements ?? [],
        recentMatches: profile?.recentMatches ?? profile?.matches ?? [],
        friendRequests: profile?.friendRequests ?? profile?.incomingFriendRequests ?? [],
        squadInvites: profile?.squadInvites ?? profile?.invites ?? [],
      };
      setUser(normalized);
    } catch (err: any) {
      console.error("fetch profile error", err);
      setError("Network error");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleViewDetails = (match: MatchItem) => {
    navigate(`/match-details`, { state: { match } });
  };

  // Accept/Reject friend request (optimistic)
  const respondFriendRequest = async (requestId: string, accept: boolean) => {
    if (!requestId) return;
    setProcessingRequests(s => ({ ...s, [requestId]: true }));
    try {
      const res = await fetch(`${API_BASE}/friends/${requestId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: accept ? "accepted" : "rejected" }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed (${res.status})`);
      }
      // Optimistically remove request from UI
      setUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          friendRequests: (prev.friendRequests || []).filter(r => String(r._id) !== String(requestId)),
        };
      });
      toast({ title: accept ? "Friend added" : "Request rejected", description: accept ? "You are now friends." : "Request rejected." });
    } catch (err: any) {
      console.error("respond friend error", err);
      toast({ title: "Error", description: err.message || "Failed to respond", variant: "destructive" });
    } finally {
      setProcessingRequests(s => { const c = { ...s }; delete c[requestId]; return c; });
    }
  };

  // Accept/Reject squad invite (optimistic)
  const respondSquadInvite = async (inviteId: string, accept: boolean) => {
    if (!inviteId) return;
    setProcessingRequests(s => ({ ...s, [inviteId]: true }));
    try {
      const res = await fetch(`${API_BASE}/squad-requests/${inviteId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: accept ? "accepted" : "rejected" }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed (${res.status})`);
      }

      // Optimistic UI: remove invite from list
      setUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          squadInvites: (prev.squadInvites || []).filter(i => String(i._id) !== String(inviteId)),
        };
      });

      toast({ title: accept ? "Joined squad" : "Invite declined", description: accept ? "Good luck!" : "Invite declined." });
    } catch (err: any) {
      console.error("respond squad invite error", err);
      toast({ title: "Error", description: err.message || "Failed to respond", variant: "destructive" });
    } finally {
      setProcessingRequests(s => { const c = { ...s }; delete c[inviteId]; return c; });
    }
  };

  const recentMatches = useMemo(() => {
    return user?.recentMatches ?? [];
  }, [user]);

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Loading profile…</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : !user ? (
          <div className="text-center py-12 text-muted-foreground">No profile data.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="bg-grindzone-card overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-grindzone-blue-dark to-grindzone-blue" />
                <CardContent className="-mt-16 relative">
                  <div className="h-32 w-32 rounded-full border-4 border-grindzone-card bg-grindzone-darker flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                    {user.avatarUrl ? (
                      // fallback to placeholder on error
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                      />
                    ) : (
                      <span className="text-4xl font-bold">{(user.username ?? "U").charAt(0)}</span>
                    )}
                    <div className="absolute bottom-0 right-0 bg-grindzone-blue rounded-full h-8 w-8 flex items-center justify-center border-2 border-grindzone-card">
                      <Shield size={16} />
                    </div>
                  </div>

                  <div className="text-center mt-4">
                    <h2 className="text-2xl font-bold">{user.username}</h2>
                    <div className="flex items-center justify-center mt-1">
                      <span className="bg-grindzone-blue text-white text-xs px-2 py-1 rounded-full">
                        {user.tier ?? "Unranked"}
                      </span>
                    </div>
                    <p className="mt-4 text-muted-foreground">{user.bio}</p>
                    <p className="text-xs text-muted-foreground mt-4">
                      Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-grindzone-card mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy size={18} />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(user.badges && user.badges.length > 0) ? user.badges.map((badge, index) => (
                      <div key={index} className="flex items-start">
                        <div className="h-8 w-8 rounded-full bg-grindzone-darker flex items-center justify-center mr-3 mt-1">
                          <Medal size={16} className="text-grindzone-blue" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{badge.name}</h4>
                          {badge.description && <p className="text-xs text-muted-foreground">{badge.description}</p>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-muted-foreground">No achievements yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="statistics" className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="statistics">Statistics</TabsTrigger>
                  <TabsTrigger value="matches">Recent Matches</TabsTrigger>
                  <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                </TabsList>

                {/* Statistics */}
                <TabsContent value="statistics">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-grindzone-card">
                      <CardContent className="p-4">
                        <div className="text-muted-foreground text-sm mb-1">Matches Played</div>
                        <div className="text-2xl font-bold">{user.stats?.matchesPlayed ?? 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-grindzone-card">
                      <CardContent className="p-4">
                        <div className="text-muted-foreground text-sm mb-1">Wins</div>
                        <div className="text-2xl font-bold text-grindzone-blue">{user.stats?.wins ?? 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-grindzone-card">
                      <CardContent className="p-4">
                        <div className="text-muted-foreground text-sm mb-1">Win Rate</div>
                        <div className="text-2xl font-bold">{user.stats?.winRate ?? "0.0%"}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-grindzone-card">
                      <CardContent className="p-4">
                        <div className="text-muted-foreground text-sm mb-1">Tournament Wins</div>
                        <div className="text-2xl font-bold text-grindzone-blue">
                          {user.stats?.tournamentWins ?? 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-grindzone-card md:col-span-2">
                      <CardContent className="p-4">
                        <div className="text-muted-foreground text-sm mb-1">
                          Highest Tournament Finish
                        </div>
                        <div className="text-xl font-bold">{user.stats?.highestFinish ?? "—"}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-grindzone-card">
                    <CardHeader>
                      <CardTitle>Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center">
                      <p className="text-muted-foreground">Performance chart will be displayed here</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Recent Matches */}
                <TabsContent value="matches">
                  <Card className="bg-grindzone-card">
                    <CardHeader>
                      <CardTitle>Recent Matches</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {recentMatches.length === 0 ? (
                          <div className="text-muted-foreground text-center p-6">No recent matches.</div>
                        ) : recentMatches.map((match, index) => (
                          <div
                            key={index}
                            className="border-b border-border pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-semibold">vs {match.opponent ?? "Unknown"}</div>
                                <div className="text-xs text-muted-foreground">{match.date}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`mr-3 font-semibold ${
                                    match.result === "Win" ? "text-green-500" : "text-red-500"
                                  }`}
                                >
                                  {match.result ?? "—"}
                                </div>
                                <div className="bg-grindzone-darker px-3 py-1 rounded text-sm">
                                  {match.score ?? "—"}
                                </div>
                                <button
                                  className="bg-grindzone-blue text-white text-sm px-3 py-1 rounded hover:bg-grindzone-blue-dark"
                                  onClick={() => handleViewDetails(match)}
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tournaments */}
                <TabsContent value="tournaments">
                  <Card className="bg-grindzone-card">
                    <CardHeader>
                      <CardTitle>Tournament History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-center py-8">
                        Tournament history will be displayed here
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Requests */}
                <TabsContent value="requests">
                  <Card className="bg-grindzone-card">
                    <CardHeader>
                      <CardTitle>Friend Requests & Squad Invites</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Friend Requests</h4>
                        <div className="space-y-4">
                          {(user.friendRequests && user.friendRequests.length > 0) ? (
                            user.friendRequests.map((req: any) => {
                              const id = req._id ?? req.id ?? (req.fromUser && req.fromUser._id) ?? Math.random().toString(36).slice(2,9);
                              const fromName = req.fromUser?.username ?? req.fromUsername ?? "Unknown";
                              return (
                                <div key={id} className="flex items-center justify-between bg-grindzone-darker px-4 py-3 rounded-md">
                                  <div>
                                    <p className="font-semibold">{fromName}</p>
                                    <p className="text-xs text-muted-foreground">Wants to be friends</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"
                                      disabled={!!processingRequests[id]}
                                      onClick={() => respondFriendRequest(id, true)}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      className="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700"
                                      disabled={!!processingRequests[id]}
                                      onClick={() => respondFriendRequest(id, false)}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-muted-foreground">No friend requests.</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Squad Invitations</h4>
                        <div className="space-y-4">
                          {(user.squadInvites && user.squadInvites.length > 0) ? (
                            user.squadInvites.map((invite: any) => {
                              const id = invite._id ?? invite.id ?? Math.random().toString(36).slice(2,9);
                              const squadName = invite.squad?.name ?? invite.squadName ?? "Unknown Squad";
                              return (
                                <div key={id} className="flex items-center justify-between bg-grindzone-darker px-4 py-3 rounded-md">
                                  <div>
                                    <p className="font-semibold">{squadName}</p>
                                    <p className="text-xs text-muted-foreground">Invited you to join</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"
                                      disabled={!!processingRequests[id]}
                                      onClick={() => respondSquadInvite(id, true)}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      className="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700"
                                      disabled={!!processingRequests[id]}
                                      onClick={() => respondSquadInvite(id, false)}
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-muted-foreground">No squad invitations.</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
