import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

interface SettingsData {
  restrictToIP: boolean;
  allowedIPs: string;
  allowedWiFi: string;
  startTime: string;
  endTime: string;
  weekendWorking: boolean;
  notifications: {
    leadAssignment: boolean;
    whatsapp: boolean;
    email: boolean;
    dailyReports: boolean;
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>({
    restrictToIP: false,
    allowedIPs: "192.168.1.100",
    allowedWiFi: "RealEstate Office",
    startTime: "09:00",
    endTime: "18:00",
    weekendWorking: false,
    notifications: {
      leadAssignment: true,
      whatsapp: false,
      email: true,
      dailyReports: true,
    },
  });
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 🔹 Fetch admin settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const ref = doc(db, "admin", "settings");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSettings((prev) => ({ ...prev, ...snap.data() } as SettingsData));
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        toast.error("Failed to load settings");
      }
    };
    fetchSettings();
  }, []);

  // 🔹 Save settings to Firestore
  const handleSave = async () => {
    try {
      setLoading(true);
      await setDoc(doc(db, "admin", "settings"), settings, { merge: true });
      toast.success("Settings updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Change Password Logic
  const handleChangePassword = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      toast.error("No authenticated user found");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);
      if (err.code === "auth/wrong-password") {
        toast.error("Incorrect current password");
      } else if (err.code === "auth/weak-password") {
        toast.error("Password too weak (min 6 chars)");
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Manage IP restrictions and access control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Restrict Subuser Login to Office IP</Label>
                <p className="text-sm text-muted-foreground">
                  Only allow agents to login from approved IP addresses
                </p>
              </div>
              <Switch
                checked={settings.restrictToIP}
                onCheckedChange={(v) => setSettings({ ...settings, restrictToIP: v })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Allowed IP Addresses</Label>
              <Input
                value={settings.allowedIPs}
                onChange={(e) => setSettings({ ...settings, allowedIPs: e.target.value })}
                placeholder="192.168.1.1, 192.168.1.2"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of IPs</p>
            </div>

            <div className="space-y-2">
              <Label>Allowed WiFi Names</Label>
              <Input
                value={settings.allowedWiFi}
                onChange={(e) => setSettings({ ...settings, allowedWiFi: e.target.value })}
                placeholder="Office WiFi, Guest WiFi"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of WiFi networks</p>
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Security Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Working Hours</CardTitle>
            <CardDescription>Set standard working hours for attendance tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Weekend Working</Label>
                <p className="text-sm text-muted-foreground">Track attendance on weekends</p>
              </div>
              <Switch
                checked={settings.weekendWorking}
                onCheckedChange={(v) => setSettings({ ...settings, weekendWorking: v })}
              />
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Working Hours"}
            </Button>
          </CardContent>
        </Card>

        {/* 🔐 Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your admin account password securely</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(settings.notifications).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <Label className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                  <Switch
                    checked={value}
                    onCheckedChange={(v) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, [key]: v },
                      })
                    }
                  />
                </div>
                <Separator className="my-3" />
              </div>
            ))}
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Notification Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}