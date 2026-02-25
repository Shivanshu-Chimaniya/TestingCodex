import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useAuthStore } from '../store/auth.store';
import { useRoomStore } from '../store/room.store';
import { Button } from '../components/ui/Button';

export const RoomLobby = () => {
  const { roomId = 'unknown' } = useParams();
  useSocketEvents(roomId);

  const user = useAuthStore((s) => s.user);
  const { players, isPrivate, countdown, minPlayers } = useRoomStore();
  const canStart = useRoomStore((s) => s.canStart(user?.id));
  const countdownLabel = useMemo(() => (countdown > 0 ? `Game starts in ${countdown}...` : 'Waiting for host'), [countdown]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Room Lobby</h1>
          <p className="text-slate-400">Room: {roomId} · Privacy: {isPrivate ? 'Private' : 'Public'}</p>
        </div>
        <Link to={`/game/${roomId}`} className="rounded-md border border-white/20 px-3 py-2">Open Game Room</Link>
      </header>

      <section className="grid gap-6 md:grid-cols-[1fr,300px]">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="mb-3 text-xl font-semibold">Players ({players.length})</h2>
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.id} className="flex items-center justify-between rounded-md bg-slate-800/80 px-3 py-2">
                <span>{player.name} {player.isHost ? '👑' : ''}</span>
                <span className="text-xs text-slate-400">{player.ready ? 'Ready' : 'Not ready'}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold">Host controls</h3>
          <p className="mt-2 text-sm text-slate-400">Start requires host + at least {minPlayers} players.</p>
          <p className="mt-4 rounded-md bg-slate-800 px-3 py-2 text-center text-sm">{countdownLabel}</p>
          <Button className="mt-4 w-full" disabled={!canStart || countdown > 0}>
            {countdown > 0 ? 'Lobby Locked' : 'Start Game'}
          </Button>
        </aside>
      </section>
    </main>
  );
};
