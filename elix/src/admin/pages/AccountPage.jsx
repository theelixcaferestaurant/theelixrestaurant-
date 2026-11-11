import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Field, TextInput, errorText, useToast } from '../ui';
import { MfaCard } from '../Mfa';

// The signed-in administrator: who they are, change password, sign out (this device or every device).
export default function AccountPage({ user }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (password.length < 10) return toast.error('Use at least 10 characters.');
    if (password !== again) return toast.error('The two passwords are not the same.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    setPassword('');
    setAgain('');
    toast.success('Password updated.');
  };

  return (
    <>
      <div className="a-pagehead"><div><h1>Admin account</h1><p>Your sign-in details and security.</p></div></div>
      <Card title="Signed in as">
        <p style={{ margin: 0, overflowWrap: 'anywhere' }}><strong>{user.email}</strong></p>
        <p className="a-hint">Administrator access is granted only in the Supabase database. It cannot be given from the website.</p>
      </Card>
      <MfaCard />
      <Card title="Change password">
        <div className="a-grid">
          <Field label="New password" hint="At least 10 characters."><TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Repeat new password"><TextInput type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
        </div>
        <div className="a-actions"><Button busy={busy} onClick={change}>Update password</Button></div>
      </Card>
      <Card title="Sign out">
        <div className="a-actions">
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out of this device</Button>
          <Button variant="ghost" onClick={() => supabase.auth.signOut({ scope: 'global' })}>Sign out of all devices</Button>
        </div>
      </Card>
    </>
  );
}
