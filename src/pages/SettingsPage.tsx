// src/pages/SettingsPage.tsx
import React, { useEffect, useState } from "react";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { redirect } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";

/**
 * safeJsonFetch
 * - returns: { ok, status, json, text, headers }
 * - won't throw on HTML responses: text will contain HTML and json will be null
 */
async function safeJsonFetch(url: string, opts: RequestInit = {}) {
  try {
    const merged: RequestInit = { credentials: "include", ...opts };
    const res = await fetch(url, merged);
    const text = await res.text().catch(() => "");
    let json = null;
    try { if (text) json = JSON.parse(text); } catch { json = null; }
    return { ok: res.ok, status: res.status, json, text, headers: res.headers };
  } catch (err: any) {
    console.error("network fetch error", url, err);
    return { ok: false, status: 0, json: null, text: String(err) };
  }
}

const SettingsPage: React.FC = () => {
  const { toast } = useToast();

  // profile fields
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialogs
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [openRequest, setOpenRequest] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [openDelete, setOpenDelete] = useState(false);

  // Load /users/me on mount to prefill forms and get userId
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProfile(true);
      const r = await safeJsonFetch(`${API_BASE}/users/me`, { method: "GET" });
      if (!mounted) return;
      if (!r.ok) {
        if (r.status === 401) {
          toast({ title: "Not authenticated", description: "Please log in", variant: "destructive" });
        } else {
          toast({ title: "Failed to load profile", description: r.text || `Status ${r.status}`, variant: "destructive" });
        }
        setLoadingProfile(false);
        return;
      }
      const profile = (r.json && (r.json.user ?? r.json)) ?? null;
      if (profile) {
        setUserId(String(profile._id ?? profile.id ?? ""));
        setUsername(profile.username ?? "");
        setEmail(profile.email ?? "");
        setBio(profile.bio ?? "");
        setAvatarUrl(profile.avatarUrl ?? profile.avatar ?? "");
      } else {
        toast({ title: "Profile empty", description: "No profile data returned", variant: "destructive" });
      }
      setLoadingProfile(false);
    })();

    return () => { mounted = false; };
  }, [toast]);

  // Save personal info -> PUT /api/users/me
  const savePersonal = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        username: username?.trim(),
        email: email?.trim().toLowerCase(),
        bio,
        avatarUrl,
      };

      const r = await safeJsonFetch(`${API_BASE}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const errMsg = r.json?.message || r.json?.error || r.text || `Failed (${r.status})`;
        throw new Error(errMsg);
      }

      toast({ title: "Saved", description: "Profile updated." });
    } catch (err: any) {
      console.error("savePersonal error", err);
      toast({ title: "Save failed", description: err.message || "Could not save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Change password -> PUT /api/users/me/password
  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Missing fields", description: "Fill all password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "Password must have 8+ characters", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      const r = await safeJsonFetch(`${API_BASE}/users/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!r.ok) {
        const errMsg = r.json?.message || r.json?.error || r.text || `Failed (${r.status})`;
        throw new Error(errMsg);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password was changed." });
    } catch (err: any) {
      console.error("changePassword error", err);
      toast({ title: "Change password failed", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  // Delete account -> DELETE /api/users/:id (we fetched userId from /users/me)
  const doDeleteAccount = async () => {
    if (!userId) {
      toast({ title: "Cannot delete", description: "Missing user id (reload and try again)", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      const r = await safeJsonFetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!r.ok) {
        const errMsg = r.json?.message || r.json?.error || r.text || `Failed (${r.status})`;
        throw new Error(errMsg);
      }

      toast({ title: "Account deleted", description: "Account removed. (You may need to clear cookies or be redirected.)", variant: "destructive" });
      // Optionally: redirect to homepage/logout route
      window.location.href="/";
      // window.location.href = "/"; // or call your logout route
    } catch (err: any) {
      console.error("delete account error", err);
      toast({ title: "Delete failed", description: err.message || "Failed to delete account", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteAccountDialog(false);
      setConfirmUsername("");
    }
  };

  // UI: Delete account dialog confirm handler
  const handleConfirmDeleteAccount = () => {
    if (!username) return toast({ title: "Missing", description: "Username not loaded", variant: "destructive" });
    if (confirmUsername.trim().toLowerCase() !== username.toLowerCase()) {
      return toast({ title: "Mismatch", description: "Type your username exactly to confirm", variant: "destructive" });
    }
    doDeleteAccount();
  };

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Settings" subtitle="Manage your account preferences" />

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <div className="space-y-6">
              <Card className="bg-grindzone-card">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); savePersonal(); }} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="form-input min-h-[100px] resize-none" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatarUrl">Avatar URL</Label>
                      <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="bg-grindzone-blue hover:bg-grindzone-blue-light" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={async () => {
                        setLoadingProfile(true);
                        const r = await safeJsonFetch(`${API_BASE}/users/me`);
                        if (r.ok) {
                          const p = (r.json && (r.json.user ?? r.json)) ?? null;
                          if (p) {
                            setUsername(p.username ?? "");
                            setEmail(p.email ?? "");
                            setBio(p.bio ?? "");
                            setAvatarUrl(p.avatarUrl ?? p.avatar ?? "");
                            toast({ title: "Restored", description: "Form reset to saved profile" });
                          }
                        } else {
                          toast({ title: "Restore failed", description: r.text || `Status ${r.status}`, variant: "destructive" });
                        }
                        setLoadingProfile(false);
                      }}>
                        Reset
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-grindzone-card">
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>Update your password</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); changePassword(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>

                    <Button type="submit" className="bg-grindzone-blue hover:bg-grindzone-blue-light" disabled={changingPassword}>
                      {changingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-grindzone-card border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions for your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" onClick={() => setShowDeleteAccountDialog(true)} disabled={!userId || deleting}>
                    {deleting ? "Deleting..." : "Delete Account"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="bg-grindzone-card">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Tournament Announcements</h4>
                      <p className="text-sm text-muted-foreground">Get notified about new tournaments</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Match Reminders</h4>
                      <p className="text-sm text-muted-foreground">Receive reminders before your matches</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Squad Invites</h4>
                      <p className="text-sm text-muted-foreground">Get notified when you're invited to a squad</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Marketing Emails</h4>
                      <p className="text-sm text-muted-foreground">Receive updates about GrindZone features and events</p>
                    </div>
                    <Switch />
                  </div>

                  <Button className="mt-4 bg-grindzone-blue hover:bg-grindzone-blue-light" onClick={() => toast({ title: "Saved", description: "Notification preferences saved." })}>Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="bg-grindzone-card">
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control how your information is shared</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Public Profile</h4>
                      <p className="text-sm text-muted-foreground">Allow others to view your profile</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Show Stats</h4>
                      <p className="text-sm text-muted-foreground">Display your game statistics on your profile</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Show Online Status</h4>
                      <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Allow Friend Requests</h4>
                      <p className="text-sm text-muted-foreground">Let others send you friend requests</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <Button className="mt-4 bg-grindzone-blue hover:bg-grindzone-blue-light" onClick={() => toast({ title: "Saved", description: "Privacy settings saved." })}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-grindzone-card mt-6 border border-grindzone-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500"><AlertCircle size={18} /> Data Privacy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  We value your privacy. You can request a copy of your data or permanently delete your stored information.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Dialog open={openRequest} onOpenChange={setOpenRequest}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Request My Data</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Your Data</DialogTitle>
                        <DialogDescription>Are you sure? A download link will be sent to your email.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenRequest(false)}>Cancel</Button>
                        <Button onClick={() => { setOpenRequest(false); toast({ title: "Requested", description: "We emailed a link (simulated)." }); }}>Confirm Request</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={openDelete} onOpenChange={setOpenDelete}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">Delete All My Data</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-destructive">Confirm Deletion</DialogTitle>
                        <DialogDescription className="mb-4">This is irreversible. Type <code className="bg-muted px-1 rounded text-sm">DELETE</code> to confirm.</DialogDescription>
                        <Input placeholder="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                      </DialogHeader>
                      <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
                        <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={confirmText !== "DELETE"} onClick={() => { setOpenDelete(false); setConfirmText(""); toast({ title: "Data Deletion Requested", description: "We are processing your request (simulated).", variant: "destructive" }); }}>Yes, Delete All</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <DialogContent className="sm:max-w-[425px] bg-grindzone-card text-white">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><AlertCircle size={24} /> Confirm Account Deletion</DialogTitle>
            <DialogDescription className="text-muted-foreground">This action is irreversible. Type your username below to confirm.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmUsername" className="text-right">Your Username</Label>
              <Input id="confirmUsername" value={confirmUsername} onChange={(e) => setConfirmUsername(e.target.value)} className="col-span-3 form-input bg-grindzone-darker border-grindzone-border text-white" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteAccountDialog(false); setConfirmUsername(""); }} className="bg-transparent border-grindzone-border hover:bg-grindzone-darker">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteAccount} disabled={!username || confirmUsername.trim().toLowerCase() !== username.toLowerCase()}>
              {deleting ? "Deleting..." : "Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
