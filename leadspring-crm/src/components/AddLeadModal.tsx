import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { Country, State, City } from "country-state-city";
import { listenSources, listenPurposes } from "@/lib/firestore/lookups";

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLead: (lead: any) => void;
}

export function AddLeadModal({ open, onOpenChange, onAddLead }: AddLeadModalProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    assignedTo: "",
    email: "",
    purpose: "",
    source: "",
    status: "",
    dealPrice: "",
    address: "",
    country: "",
    countryCode: "",
    state: "",
    stateCode: "",
    city: "",
    remarks: "",
  });

  const statuses = ["new", "contacted", "follow-up", "hot", "closed", "lost"];
  const countries = Country.getAllCountries();

  // 🔹 Fetch agents dynamically from Firestore
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(users);
    });
  }, []);

  // 🔹 When country changes, fetch states
  useEffect(() => {
    if (formData.countryCode) {
      const statesList = State.getStatesOfCountry(formData.countryCode);
      setStates(statesList);
      setCities([]);
      setFormData((prev) => ({ ...prev, state: "", stateCode: "", city: "" }));
    }
  }, [formData.countryCode]);

  const [sources, setSources] = useState([]);
  const [purposes, setPurposes] = useState([]);

  useEffect(() => {
    const unsub1 = listenSources(setSources);
    const unsub2 = listenPurposes(setPurposes);
    return () => {
      if (typeof unsub1 === "function") unsub1();
      if (typeof unsub2 === "function") unsub2();
    };
  }, []);

  // 🔹 When state changes, fetch cities
  useEffect(() => {
    if (formData.countryCode && formData.stateCode) {
      const citiesList = City.getCitiesOfState(formData.countryCode, formData.stateCode);
      setCities(citiesList);
      setFormData((prev) => ({ ...prev, city: "" }));
    }
  }, [formData.stateCode]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.contact || !formData.assignedTo || !formData.purpose || !formData.status || !formData.source) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      await addDoc(collection(db, "leads"), {
        ...formData,
        assignedTo: formData.assignedTo,
        phone: formData.contact,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Lead added successfully");
      onOpenChange(false);
      setFormData({
        name: "",
        contact: "",
        assignedTo: "",
        email: "",
        purpose: "",
        source: "",
        status: "",
        dealPrice: "",
        address: "",
        country: "",
        countryCode: "",
        state: "",
        stateCode: "",
        city: "",
        remarks: "",
      });
    } catch (error) {
      toast.error("Failed to add lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>Fields marked with * are required.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 🔹 Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label>Contact *</Label>
              <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assign To *</Label>
              <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purpose *</Label>
              <Select value={formData.purpose} onValueChange={(v) => setFormData({ ...formData, purpose: v })}>
                <SelectTrigger><SelectValue placeholder="Select Purpose" /></SelectTrigger>
                <SelectContent>
                  {purposes.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 🔹 Location Selectors */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Select
                value={formData.country}
                onValueChange={(v) => {
                  const countryObj = countries.find((c) => c.name === v);
                  setFormData({
                    ...formData,
                    country: v,
                    countryCode: countryObj?.isoCode || "",
                    state: "",
                    stateCode: "",
                    city: "",
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
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
                value={formData.state}
                onValueChange={(v) => {
                  const stateObj = states.find((s) => s.name === v);
                  setFormData({
                    ...formData,
                    state: v,
                    stateCode: stateObj?.isoCode || "",
                    city: "",
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.isoCode} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>City</Label>
              <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 🔹 Status + Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status *</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source *</Label>
              <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                <SelectContent>
                  {sources.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
