import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Country, State, City } from "country-state-city";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import type { Lead } from "@/lib/mockData";

interface LeadEditModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (lead: Lead) => void;
}

export function LeadEditModal({ lead, open, onOpenChange, onSave }: LeadEditModalProps) {
  const [formData, setFormData] = useState<any>(lead);
  const [agents, setAgents] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const countries = Country.getAllCountries();

  useEffect(() => {
    if (lead) setFormData({ ...lead });
  }, [lead]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(users);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (formData?.country) {
      const countryObj = countries.find((c) => c.name === formData.country);
      if (countryObj) setStates(State.getStatesOfCountry(countryObj.isoCode));
    }
  }, [formData?.country]);

  useEffect(() => {
    if (formData?.state) {
      const countryObj = countries.find((c) => c.name === formData.country);
      const stateObj = states.find((s) => s.name === formData.state);
      if (countryObj && stateObj)
        setCities(City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode));
    }
  }, [formData?.state]);

  if (!formData) return null;

  const handleSubmit = () => {
    onSave({ ...formData, updatedAt: new Date().toISOString() });
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <Label>Source</Label>
              <Input value={formData.source || ""} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={formData.status || ""} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">new</SelectItem>
                  <SelectItem value="contacted">contacted</SelectItem>
                  <SelectItem value="follow-up">follow-up</SelectItem>
                  <SelectItem value="hot">hot</SelectItem>
                  <SelectItem value="closed">closed</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={formData.assignedTo || ""} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name || agent.email || agent.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => <SelectItem key={c.isoCode} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>State</Label>
              <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => <SelectItem key={s.isoCode} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div>
            <Label>Purpose</Label>
            <Textarea value={formData.purpose || ""} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}