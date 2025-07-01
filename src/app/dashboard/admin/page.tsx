
'use client';

import * as React from 'react';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, Region, ReportVisibility, UserPermissions } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const regions: Region[] = ['North', 'South', 'East', 'West', 'HQ'];
const reportVisibilities: ReportVisibility[] = ['Own', 'Region', 'All'];

const permissionLabels: Record<keyof UserPermissions, string> = {
  viewReports: 'View Reports',
  viewAttendance: 'View Attendance',
  submitPjp: 'Submit PJP',
  submitReport: 'Submit Report',
  viewPjp: 'View PJP Plans',
  viewAnalysis: 'View Analysis',
  doRaEntry: 'RA Entry',
  manageUsers: 'Manage Users',
};

function RegionsDialog({
  user,
  isOpen,
  onClose,
  onSave,
}: {
  user: UserProfile | null,
  isOpen: boolean,
  onClose: () => void,
  onSave: (uid: string, regions: Region[]) => void,
}) {
  const [selectedRegions, setSelectedRegions] = React.useState<Region[]>([]);

  React.useEffect(() => {
    if (user?.regions) {
      setSelectedRegions(user.regions);
    } else {
      setSelectedRegions([]);
    }
  }, [user]);

  const handleRegionChange = (region: Region, checked: boolean) => {
    setSelectedRegions(prev => 
      checked ? [...prev, region] : prev.filter(r => r !== region)
    );
  }

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Regions for {user.name}</DialogTitle>
          <DialogDescription>
            Assign one or more regions to this user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {regions.map((region) => (
            <div className="flex items-center space-x-2" key={region}>
              <Checkbox
                id={`region-${region}`}
                checked={selectedRegions.includes(region)}
                onCheckedChange={(checked) => handleRegionChange(region, !!checked)}
              />
              <Label htmlFor={`region-${region}`} className="text-sm font-medium">
                {region}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(user.uid, selectedRegions)}>Save Regions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({
  user,
  isOpen,
  onClose,
  onSave,
}: {
  user: UserProfile | null,
  isOpen: boolean,
  onClose: () => void,
  onSave: (uid: string, permissions: Partial<UserPermissions>) => void,
}) {
  const [permissions, setPermissions] = React.useState<Partial<UserPermissions>>({});

  React.useEffect(() => {
    if (user?.permissions) {
      setPermissions(user.permissions);
    } else {
      setPermissions({});
    }
  }, [user]);

  const handlePermissionChange = (key: keyof UserPermissions, checked: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: checked }));
  }

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Permissions for {user.name}</DialogTitle>
          <DialogDescription>
            Control which features this user can access. Unset permissions will use role defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {Object.keys(permissionLabels).map((key) => (
            <div className="flex items-center space-x-2" key={key}>
              <Checkbox
                id={key}
                checked={permissions[key as keyof UserPermissions] || false}
                onCheckedChange={(checked) => handlePermissionChange(key as keyof UserPermissions, !!checked)}
              />
              <Label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {permissionLabels[key as keyof UserPermissions]}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(user.uid, permissions)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [editingPermissionsForUser, setEditingPermissionsForUser] = React.useState<UserProfile | null>(null);
  const [editingRegionsForUser, setEditingRegionsForUser] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    if (!loading && user?.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  React.useEffect(() => {
    if (user?.role === 'Admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const usersData: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
        });
        setUsers(usersData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleUserUpdate = async (uid: string, data: Partial<UserProfile>) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, data);
      toast({
        title: 'Success',
        description: "User profile has been updated.",
      });
    } catch (error) {
      console.error("Error updating user: ", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update user profile.',
      });
    }
  };

  const handleSavePermissions = async (uid: string, permissions: Partial<UserPermissions>) => {
    const allPermissionKeys = Object.keys(permissionLabels) as (keyof UserPermissions)[];
    const fullPermissions: Partial<UserPermissions> = {};
    for (const key of allPermissionKeys) {
        fullPermissions[key] = permissions[key] || false;
    }
    await handleUserUpdate(uid, { permissions: fullPermissions });
    setEditingPermissionsForUser(null);
  };
  
  const handleSaveRegions = async (uid: string, regions: Region[]) => {
    await handleUserUpdate(uid, { regions });
    setEditingRegionsForUser(null);
  };

  const handleNameChange = (uid: string, name: string) => {
    const newName = name.trim();
    if (!newName) {
      toast({
        variant: 'destructive',
        title: 'Invalid Name',
        description: 'User name cannot be empty.',
      });
      return;
    }
    handleUserUpdate(uid, { name: newName });
  };
  
  const handleRoleChange = (uid: string, role: string) => {
    handleUserUpdate(uid, { role: role as UserProfile['role'] });
  };
  
  const handleVisibilityChange = (uid: string, visibility: string) => {
    handleUserUpdate(uid, { reportVisibility: visibility as ReportVisibility });
  };

  if (loading || user?.role !== 'Admin') {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Assign roles, regions, permissions, and edit names for users in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Region(s)</TableHead>
                <TableHead>Report Visibility</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell>
                    {user?.uid === u.uid ? (
                      <span className="font-medium">{u.name || 'N/A'}</span>
                    ) : (
                      <Input
                        defaultValue={u.name || ''}
                        onBlur={(e) => {
                          if (e.target.value !== u.name) {
                            handleNameChange(u.uid, e.target.value);
                          }
                        }}
                        className="font-medium"
                      />
                    )}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {user?.uid === u.uid ? (
                       <Badge variant="secondary">{u.role}</Badge>
                    ) : (
                      <Select defaultValue={u.role} onValueChange={(value) => handleRoleChange(u.uid, value)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="RSM">RSM</SelectItem>
                          <SelectItem value="ASM">ASM</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                   <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="max-w-[150px] truncate">
                          {u.regions?.join(', ') || 'N/A'}
                        </span>
                         <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingRegionsForUser(u)}
                            disabled={user?.uid === u.uid}
                            className="h-7"
                          >
                            Manage
                          </Button>
                      </div>
                  </TableCell>
                   <TableCell>
                    {user?.uid === u.uid ? (
                       <Badge variant="secondary">{u.reportVisibility || 'Own'}</Badge>
                    ) : (
                      <Select defaultValue={u.reportVisibility || 'Own'} onValueChange={(value) => handleVisibilityChange(u.uid, value)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                        <SelectContent>
                          {reportVisibilities.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingPermissionsForUser(u)}
                        disabled={user?.uid === u.uid}
                      >
                        Permissions
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PermissionsDialog 
        user={editingPermissionsForUser}
        isOpen={!!editingPermissionsForUser}
        onClose={() => setEditingPermissionsForUser(null)}
        onSave={handleSavePermissions}
      />
      <RegionsDialog
        user={editingRegionsForUser}
        isOpen={!!editingRegionsForUser}
        onClose={() => setEditingRegionsForUser(null)}
        onSave={handleSaveRegions}
      />
    </>
  );
}