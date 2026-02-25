import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth.store';

type ProfileResponse = { username: string; gamesPlayed: number; topRank: number };

const fetchProfile = async () => {
  const { data } = await api.get<ProfileResponse>('/auth/me');
  return data;
};

export const Profile = () => {
  const user = useAuthStore((s) => s.user);
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: fetchProfile, enabled: Boolean(user) });

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-10">
      <h1 className="text-3xl font-extrabold">Profile</h1>
      {!user && <p className="mt-4 text-slate-400">Login to load your profile.</p>}
      {profileQuery.isLoading && <p className="mt-4">Loading…</p>}
      {profileQuery.data && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <p><strong>Name:</strong> {profileQuery.data.username}</p>
          <p><strong>Games played:</strong> {profileQuery.data.gamesPlayed}</p>
          <p><strong>Top rank:</strong> {profileQuery.data.topRank}</p>
        </div>
      )}
    </main>
  );
};
