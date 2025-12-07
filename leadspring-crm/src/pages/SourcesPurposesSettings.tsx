import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listenSources, addSource, updateSource, deleteSource,
  listenPurposes, addPurpose, updatePurpose, deletePurpose
} from "@/lib/firestore/lookups";

export function SourcesPurposesSettings() {
  const [sources, setSources] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [newSource, setNewSource] = useState("");
  const [newPurpose, setNewPurpose] = useState("");

  useEffect(() => {
    const unsub1 = listenSources(setSources);
    const unsub2 = listenPurposes(setPurposes);
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleAddSource = async () => {
    if (!newSource.trim()) return;
    await addSource(newSource);
    toast.success("Source added");
    setNewSource("");
  };

  const handleAddPurpose = async () => {
    if (!newPurpose.trim()) return;
    await addPurpose(newPurpose);
    toast.success("Purpose added");
    setNewPurpose("");
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      
      {/* SOURCES */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="flex gap-2">
            <Input
              placeholder="Add source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
            />
            <Button onClick={handleAddSource}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((src) => (
                <TableRow key={src.id}>
                  <TableCell>{src.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => {
                        const newName = prompt("Edit source", src.name);
                        if (newName) updateSource(src.id, newName);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => deleteSource(src.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </CardContent>
      </Card>

      {/* PURPOSES */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Purposes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="flex gap-2">
            <Input
              placeholder="Add purpose"
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
            />
            <Button onClick={handleAddPurpose}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purposes.map((pc) => (
                <TableRow key={pc.id}>
                  <TableCell>{pc.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => {
                        const newName = prompt("Edit purpose", pc.name);
                        if (newName) updatePurpose(pc.id, newName);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => deletePurpose(pc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </CardContent>
      </Card>
    </div>
  );
}