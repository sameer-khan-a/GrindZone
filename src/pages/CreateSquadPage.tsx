import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
const MAX_LOGO_SIZE = 3 * 1024 * 1024; // 3MB
const TAG_MAX = 6;
const NAME_MAX = 60;

const CreateSquadPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // form
  const [squadName, setSquadName] = useState("");
  const [squadTag, setSquadTag] = useState("");
  const [tier, setTier] = useState("Amateur");
  const [description, setDescription] = useState("");

  // file
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nameRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropzoneRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // util: headers (no content-type for FormData)
  const buildHeaders = (isJson = true) => {
    const headers: Record<string, string> = {};
    if (isJson) headers["Content-Type"] = "application/json";
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  // file handlers
  const handleFileSelected = (file?: File | null) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrors(prev => ({ ...prev, logo: "Only image files allowed (png/jpg/svg)." }));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setErrors(prev => ({ ...prev, logo: "File too large — max 3MB." }));
      return;
    }
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.logo;
      return copy;
    });
    setLogoFile(file);
    const r = new FileReader();
    r.onload = () => setLogoPreview(String(r.result));
    r.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer?.files?.length) return;
    handleFileSelected(e.dataTransfer.files[0]);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const resetFile = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // validation
  const validate = () => {
    const errs: Record<string, string> = {};
    const nameTrim = squadName.trim();
    const tagTrim = squadTag.trim().toUpperCase();

    if (nameTrim.length < 2) errs.name = "Name must be at least 2 characters.";
    if (nameTrim.length > NAME_MAX) errs.name = `Name must be ≤ ${NAME_MAX} characters.`;

    if (!/^[A-Z0-9]{2,6}$/.test(tagTrim)) errs.tag = "Tag must be 2–6 characters [A-Z0-9].";

    if (logoFile) {
      if (!logoFile.type.startsWith("image/")) errs.logo = "Logo must be an image.";
      if (logoFile.size > MAX_LOGO_SIZE) errs.logo = "Logo too large (max 3MB).";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // submit
  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast({ title: "Fix errors", description: "Please correct the errors and try again.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: squadName.trim(),
        tag: squadTag.trim().toUpperCase(),
        tier,
        description: description.trim() || undefined,
      };

      let res: Response;
      if (logoFile) {
        const fd = new FormData();
        fd.append("name", payload.name!);
        fd.append("tag", payload.tag!);
        fd.append("tier", payload.tier!);
        if (payload.description) fd.append("description", payload.description);
        fd.append("logo", logoFile, logoFile.name);

        res = await fetch(`${API_BASE}/squads`, {
          method: "POST",
          headers: buildHeaders(false), // don't set content-type (browser handles boundary)
          body: fd,
        });
      } else {
        res = await fetch(`${API_BASE}/squads`, {
          method: "POST",
          headers: buildHeaders(true),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        let msg = `Create failed (${res.status})`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const created = await res.json();
      toast({ title: "Squad created", description: `${created.name ?? payload.name} created successfully.` });

      // prefer id/_id when returned; otherwise go to squads list
      const id = created._id ?? created.id ?? null;
      navigate("/squad");

    } catch (err: any) {
      console.error("create squad error:", err);
      toast({ title: "Error creating squad", description: err.message || "Try again later", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* keep heading centered like you asked */}
        <div className="flex items-center justify-center w-100 text-center mb-8">
          <PageTitle title="Create a New Squad" subtitle="Form your dream team and dominate the competition" />
        </div>

        <div className="flex justify-center mb-6">
          <Button variant="outline" onClick={() => navigate("/squad")}>← Back to Squads</Button>
        </div>

        <Card className="max-w-2xl mx-auto bg-grindzone-card border-border">
          <CardHeader>
            <CardTitle>Squad Details</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" aria-label="Create squad form">
              {/* Name */}
              <div>
                <label htmlFor="squadName" className="text-sm font-medium block">Squad Name*</label>
                <input
                  id="squadName"
                  ref={nameRef}
                  value={squadName}
                  onChange={(e) => setSquadName(e.target.value)}
                  className={`w-full p-2 mt-1 rounded border ${errors.name ? "border-red-500" : "border-border"} bg-grindzone-darker focus:outline-none`}
                  placeholder="Enter squad name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "err-name" : undefined}
                  maxLength={NAME_MAX}
                />
                <div className="flex justify-between text-xs mt-1">
                  <div className="text-red-400">{errors.name ? errors.name : ""}</div>
                  <div className="text-zinc-400">{squadName.length}/{NAME_MAX}</div>
                </div>
              </div>

              {/* Tag */}
              <div>
                <label htmlFor="squadTag" className="text-sm font-medium block">Squad Tag* (2–6 chars)</label>
                <input
                  id="squadTag"
                  value={squadTag}
                  onChange={(e) => setSquadTag(e.target.value.toUpperCase().slice(0, TAG_MAX))}
                  className={`w-40 p-2 mt-1 rounded border ${errors.tag ? "border-red-500" : "border-border"} bg-grindzone-darker focus:outline-none`}
                  placeholder="ALPHA"
                  aria-invalid={!!errors.tag}
                  aria-describedby={errors.tag ? "err-tag" : undefined}
                  maxLength={TAG_MAX}
                />
                <div className="flex justify-between text-xs mt-1">
                  <div className="text-red-400">{errors.tag ? errors.tag : ""}</div>
                  <div className="text-zinc-400">{squadTag.length}/{TAG_MAX}</div>
                </div>
              </div>

              {/* Tier */}
              <div>
                <label htmlFor="tier" className="text-sm font-medium block">Tier</label>
                <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)} className="w-full p-2 mt-1 rounded border border-border bg-grindzone-darker">
                  <option value="Amateur">Amateur</option>
                  <option value="Semi-Pro">Semi-Pro</option>
                  <option value="Professional">Professional</option>
                </select>
              </div>

              {/* Logo upload */}
              <div>
                <label className="text-sm font-medium block">Squad Logo (optional)</label>

                <label
                  ref={dropzoneRef}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  htmlFor="dropzone-file"
                  className={`mt-2 w-full h-40 rounded border-2 border-dashed flex items-center justify-center p-4 cursor-pointer ${errors.logo ? "border-red-500" : "border-border"} bg-grindzone-darker`}
                >
                  <div className="text-center">
                    {logoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={logoPreview} alt="logo preview" className="w-28 h-28 object-cover rounded-md shadow-sm" />
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}>Change</Button>
                          <Button variant="destructive" onClick={(e) => { e.preventDefault(); resetFile(); }}>Remove</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-400">Click to upload or drag & drop an image (PNG/JPG). Max 3MB.</p>
                        <div className="mt-2">
                          <input
                            ref={fileRef}
                            id="dropzone-file"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(ev) => handleFileSelected(ev.target.files?.[0] ?? null)}
                          />
                          <Button onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}>Upload Image</Button>
                        </div>
                      </>
                    )}
                    {errors.logo && <div className="text-xs text-red-400 mt-2">{errors.logo}</div>}
                  </div>
                </label>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="text-sm font-medium block">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-2 mt-1 rounded border border-border bg-grindzone-darker"
                  placeholder="Tell people about your squad (optional)"
                />
                <div className="text-xs text-zinc-400 mt-1">{description.length} chars</div>
              </div>

              {/* actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => navigate("/squad")} disabled={submitting}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-grindzone-blue hover:bg-grindzone-blue-light"
                  disabled={submitting}
                  aria-disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create Squad"}
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter />
        </Card>
      </div>
    </div>
  );
};

export default CreateSquadPage;
