import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Country, State, City } from "country-state-city";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { toast } from "sonner";
import type { Lead } from "@/lib/mockData";
import { listenSources, listenPurposes } from "@/lib/firestore/lookups";
import { listenLeadStatuses } from "@/lib/firestore/leadStatus";
import { useAuth } from "@/contexts/AuthContext";

interface LeadEditModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (lead: Lead) => void;
}

export function LeadEditModal({ lead, open, onOpenChange, onSave }: LeadEditModalProps) {
  // Initialize with default empty values that will be overridden by lead data
  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    phone: '',
    email: '',
    source: '',
    status: '',
    country: '',
    state: '',
    city: '',
    address: '',
    purpose: '',
    remarks: '',
    assignedTo: [],
    ...(lead || {})  // Spread lead data to override defaults if it exists
  });
  const [agents, setAgents] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    Array.isArray(lead?.assignedTo) ? lead.assignedTo : []
  );
  const [sources, setSources] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const countries = Country.getAllCountries();

  const { user } = useAuth();

  useEffect(() => {
    if (lead) {
      // Only update form data if the lead ID has changed to prevent unnecessary re-renders
      setFormData(prev => ({
        // Keep existing values as fallbacks
        ...prev,
        // Spread all lead data to ensure all fields are included
        ...lead,
        // Ensure these fields are properly initialized
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        source: lead.source || '',
        status: lead.status || '',
        country: lead.country || '',
        state: lead.state || '',
        city: lead.city || '',
        address: lead.address || '',
        purpose: lead.purpose || '',
        remarks: lead.remarks || '',
        assignedTo: Array.isArray(lead.assignedTo) ? lead.assignedTo : []
      }));
      setSelectedAgents(Array.isArray(lead.assignedTo) ? lead.assignedTo : []);
    }
  }, [lead?.id]); // Only re-run if lead ID changes

  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(users);
    });
    const unsubSources = listenSources(setSources);
    const unsubPurposes = listenPurposes(setPurposes);
    const unsubStatuses = listenLeadStatuses(setStatuses);
    return () => {
      if (typeof unsubSources === "function") unsubSources();
      if (typeof unsubPurposes === "function") unsubPurposes();
      if (typeof unsubStatuses === "function") unsubStatuses();
    };
  }, []);

  useEffect(() => {
    if (formData?.country) {
      const c = countries.find((co) => co.name === formData.country);
      if (c) setStates(State.getStatesOfCountry(c.isoCode));
    } else {
      setStates([]);
    }
  }, [formData?.country]);

  useEffect(() => {
    if (formData?.state) {
      const c = countries.find((co) => co.name === formData.country);
      const s = states.find((st) => st.name === formData.state);
      if (c && s) setCities(City.getCitiesOfState(c.isoCode, s.isoCode));
    } else {
      setCities([]);
    }
  }, [formData?.state]);

  if (!formData) return null;

  const handleSubmit = async () => {
    onSave({ ...formData, updatedAt: new Date().toISOString() });

    const historyRef = collection(db, "leads", lead.id, "history");

    if (lead.status !== formData.status) {
      await addDoc(historyRef, {
        type: "STATUS_CHANGE",
        message: `Status changed from ${lead.status} to ${formData.status}`,
        oldValue: lead.status,
        newValue: formData.status,
        by: user?.id,
        byName: user?.name,
        createdAt: serverTimestamp(),
      });
    }

    if (JSON.stringify(lead.assignedTo || []) !== JSON.stringify(formData.assignedTo || [])) {
      await addDoc(historyRef, {
        type: "ASSIGNMENT_CHANGE",
        message: "Lead assignment updated",
        oldValue: lead.assignedTo || [],
        newValue: formData.assignedTo || [],
        by: user?.id,
        byName: user?.name,
        createdAt: serverTimestamp(),
      });
    }

    if ((lead.remarks || "") !== (formData.remarks || "")) {
      await addDoc(historyRef, {
        type: "REMARKS_UPDATE",
        message: "Remarks updated",
        oldValue: lead.remarks || "",
        newValue: formData.remarks || "",
        by: user?.id,
        byName: user?.name,
        createdAt: serverTimestamp(),
      });
    }

    toast.success("Lead updated successfully");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* NAME + PHONE */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>

          {/* EMAIL + SOURCE */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>

            <div>
              <Label>Source</Label>
              <Select value={formData.source || ""} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* STATUS + ASSIGNED TO */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select 
                value={formData.status || ''} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No statuses configured
                    </div>
                  )}
                  {statuses.map((s) => {
                    if (!s || !s.name) return null;
                    const name = String(s.name).trim();
                    if (!name) return null;
                    return (
                      <SelectItem key={s.id} value={name}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assigned To</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAssignModalOpen(true)}
              >
                {selectedAgents.length === 0
                  ? "Assign users"
                  : selectedAgents
                      .map(
                        (uid) =>
                          agents.find((a) => a.id === uid)?.name ||
                          agents.find((a) => a.id === uid)?.email ||
                          uid
                      )
                      .join(", ")}
              </Button>
            </div>
          </div>

          {/* COUNTRY / STATE / CITY */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Select 
                value={formData.country || ''} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  country: v,
                  state: '', // Reset state when country changes
                  city: ''   // Reset city when country changes
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.isoCode} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>State</Label>
              <Select 
                value={formData.state || ''} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  state: v,
                  city: '' // Reset city when state changes
                }))}
                disabled={!formData.country}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.isoCode} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>City</Label>
              <Select 
                value={formData.city || ''} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, city: v }))}
                disabled={!formData.state}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ADDRESS */}
          <div>
            <Label>Address</Label>
            <Textarea value={formData.address || ""} onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            } />
          </div>

          {/* PURPOSE DROPDOWN */}
          <div>
            <Label>Purpose</Label>
            <Select value={formData.purpose || ""} onValueChange={(v) => setFormData({ ...formData, purpose: v })}>
              <SelectTrigger><SelectValue placeholder="Select Purpose" /></SelectTrigger>
              <SelectContent>
                {purposes.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* REMARKS */}
          <div>
            <Label>Remarks</Label>
            <Textarea value={formData.remarks || ""} onChange={(e) =>
              setFormData({ ...formData, remarks: e.target.value })
            } />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Users</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {agents.map((agent) => {
              const checked = selectedAgents.includes(agent.id);
              return (
                <label
                  key={agent.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgents((prev) => [...prev, agent.id]);
                      } else {
                        setSelectedAgents((prev) =>
                          prev.filter((id) => id !== agent.id)
                        );
                      }
                    }}
                  />
                  <span>{agent.name || agent.email}</span>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setFormData({
                  ...formData,
                  assignedTo: selectedAgents,
                });
                setAssignModalOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}