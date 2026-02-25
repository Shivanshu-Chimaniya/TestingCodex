import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/Button';

export const Login = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      return;
    }

    setAuth('demo-token', { id: crypto.randomUUID(), username: trimmed });
    navigate('/lobby/demo-room');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-2xl font-bold">Login</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2"
        />
        <Button type="submit" className="w-full">Continue</Button>
      </form>
    </main>
  );
};
