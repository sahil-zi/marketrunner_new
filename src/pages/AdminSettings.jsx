import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Users,
  Store as StoreIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  CheckCircle2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import { useStores, useCreateStore, useUpdateStore, useDeleteStore } from '@/hooks/use-stores';
import { useUsers } from '@/hooks/use-users';

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const staggerRow = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export default function AdminSettings() {
  const { data: stores = [], isLoading } = useStores();
  const { data: users = [] } = useUsers();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const deleteStoreMutation = useDeleteStore();

  const [editingStore, setEditingStore] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isSaving = createStore.isPending || updateStore.isPending;

  async function saveStore(storeData) {
    try {
      if (editingStore?.id) {
        await updateStore.mutateAsync({ id: editingStore.id, data: storeData });
        toast.success('Store updated');
      } else {
        await createStore.mutateAsync(storeData);
        toast.success('Store created');
      }
      setIsDialogOpen(false);
      setEditingStore(null);
    } catch {
      toast.error('Failed to save store');
    }
  }

  async function handleDeleteStore(id) {
    try {
      await deleteStoreMutation.mutateAsync(id);
      toast.success('Store deleted');
      setDeleteConfirm(null);
    } catch {
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
      <PageHeader
        title="Settings"
        subtitle="Manage stores and users"
      />

      {/* Runner Access Link */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Runner Access Link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Share this link with runners to access their mobile interface:
          </p>
          <div className="flex gap-2">
            <Input
              value={runnerLoginUrl}
              readOnly
              className="bg-card"
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
      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Stores</CardTitle>
          <Button
            onClick={() => { setEditingStore({}); setIsDialogOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Store
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : stores.length === 0 ? (
            <EmptyState
              icon={StoreIcon}
              title="No stores yet"
              description="Add your first store to get started."
            />
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
              <TableBody
                as={motion.tbody}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {stores.map((store, i) => (
                  <motion.tr
                    key={store.id}
                    variants={staggerRow}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <TableCell className="font-medium text-foreground">{store.name}</TableCell>
                    <TableCell className="text-muted-foreground">{store.location || '\u2014'}</TableCell>
                    <TableCell className="text-muted-foreground">{store.contact_info || '\u2014'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit store ${store.name}`}
                          onClick={() => { setEditingStore(store); setIsDialogOpen(true); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete store ${store.name}`}
                          onClick={() => setDeleteConfirm(store)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Users</CardTitle>
          <AddUserButton />
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Invite users to collaborate on your workspace."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody
                as={motion.tbody}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {users.map((user) => (
                  <motion.tr
                    key={user.id}
                    variants={staggerRow}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <TableCell className="font-medium text-foreground">{user.full_name || '\u2014'}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                  </motion.tr>
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
            <DialogTitle className="text-foreground">Delete Store</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{deleteConfirm?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteStore(deleteConfirm.id)}
              disabled={deleteStoreMutation.isPending}
            >
              {deleteStoreMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
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
          <DialogTitle className="text-foreground">
            {store?.id ? 'Edit Store' : 'Add Store'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-foreground">Store Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-muted"
              required
            />
          </div>
          <div>
            <Label htmlFor="location" className="text-foreground">Location (Dubai Address)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Dubai Mall, Downtown Dubai"
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="contact_info" className="text-foreground">Contact Info (UAE Phone Number)</Label>
            <Input
              id="contact_info"
              value={formData.contact_info}
              onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
              placeholder="+971 50 123 4567"
              className="bg-muted"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {store?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddUserButton() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [isAddingUser, setIsAddingUser] = useState(false);

  async function handleAddUser(e) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email');
      return;
    }

    setIsAddingUser(true);
    try {
      await base44.users.inviteUser(email, role);
      toast.success('User added successfully. They will receive an email to set up their password.');
      setIsOpen(false);
      setEmail('');
      setFullName('');
      setRole('user');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      toast.error(error.message || 'Failed to add user');
    } finally {
      setIsAddingUser(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Add User
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-foreground">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-muted"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                An email with a password setup link will be sent to this address.
              </p>
            </div>
            <div>
              <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="role" className="text-foreground">Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-muted">
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
              <Button type="submit" disabled={isAddingUser}>
                {isAddingUser && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
