import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Settings, 
  Users, 
  Store as StoreIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [storesData, usersData] = await Promise.all([
        base44.entities.Store.list(),
        base44.entities.User.list(),
      ]);
      setStores(storesData);
      setUsers(usersData);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveStore(storeData) {
    setIsSaving(true);
    try {
      if (editingStore?.id) {
        await base44.entities.Store.update(editingStore.id, storeData);
        toast.success('Store updated');
      } else {
        await base44.entities.Store.create(storeData);
        toast.success('Store created');
      }
      setIsDialogOpen(false);
      setEditingStore(null);
      loadData();
    } catch (error) {
      toast.error('Failed to save store');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStore(id) {
    try {
      await base44.entities.Store.delete(id);
      toast.success('Store deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete store');
    }
  }

  const runnerLoginUrl = `${window.location.origin}${window.location.pathname}#/RunnerLogin`;

  const copyRunnerLink = () => {
    navigator.clipboard.writeText(runnerLoginUrl);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage stores and users</p>
      </div>

      {/* Runner Access Link */}
      <Card className="border-teal-200 bg-teal-50">
        <CardHeader>
          <CardTitle className="text-lg">Runner Access Link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Share this link with runners to access their mobile interface:
          </p>
          <div className="flex gap-2">
            <Input
              value={runnerLoginUrl}
              readOnly
              className="bg-white"
            />
            <Button
              onClick={copyRunnerLink}
              className="shrink-0"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Stores</CardTitle>
          <Button 
            onClick={() => { setEditingStore({}); setIsDialogOpen(true); }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Store
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8">
              <StoreIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No stores yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map(store => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>{store.location || '—'}</TableCell>
                    <TableCell>{store.contact_info || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => { setEditingStore(store); setIsDialogOpen(true); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeleteConfirm(store)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <InviteUserButton onSuccess={loadData} />
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No users yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || '—'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Store Dialog */}
      <StoreDialog
        store={editingStore}
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingStore(null); }}
        onSave={saveStore}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Store</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteStore(deleteConfirm.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoreDialog({ store, isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name || '',
        location: store.location || '',
        contact_info: store.contact_info || '',
      });
    }
  }, [store]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store?.id ? 'Edit Store' : 'Add Store'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Store Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contact_info">Contact Info</Label>
            <Input
              id="contact_info"
              value={formData.contact_info}
              onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {store?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserButton({ onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email');
      return;
    }

    setIsInviting(true);
    try {
      await base44.users.inviteUser(email, role);
      toast.success('User invited successfully');
      setIsOpen(false);
      setEmail('');
      setRole('user');
      onSuccess();
    } catch (error) {
      toast.error('Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-teal-600 hover:bg-teal-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        Invite User
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Runner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting} className="bg-teal-600 hover:bg-teal-700">
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}