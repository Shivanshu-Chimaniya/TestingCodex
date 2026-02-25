import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AcceptedAnswerPop } from '../components/game/AcceptedAnswerPop';
import { LeaderboardPanel } from '../components/leaderboard/LeaderboardPanel';
import { useRoundTimer } from '../hooks/useRoundTimer';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useGameStore } from '../store/game.store';

export const GameRoom = () => {
  const { roomId = 'unknown' } = useParams();
  useSocketEvents(roomId);

  const { leaderboard, acceptedAnswerIds, lockInput } = useGameStore();
  const endsAt = useMemo(() => new Date(Date.now() + 40_000).toISOString(), []);
  const secondsLeft = useRoundTimer(endsAt);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Game Room · {roomId}</h1>
        <p className="rounded-full bg-slate-800 px-4 py-1 text-sm font-semibold">{secondsLeft}s left</p>
      </header>

      <section className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Round Input</h2>
          <input
            disabled={lockInput}
            placeholder={lockInput ? 'Input locked during countdown' : 'Type your answer'}
            className="mt-4 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            {acceptedAnswerIds.length === 0 ? (
              <p className="text-sm text-slate-400">Accepted answers will pop here.</p>
            ) : (
              acceptedAnswerIds.slice(-5).map((id) => <AcceptedAnswerPop key={id} text={`Accepted #${id.slice(0, 4)}`} />)
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="mb-3 text-xl font-semibold">Leaderboard</h2>
          <LeaderboardPanel entries={leaderboard} />
        </aside>
      </section>
    </main>
  );
};
