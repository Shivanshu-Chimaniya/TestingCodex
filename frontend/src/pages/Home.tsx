import { Link } from 'react-router-dom';

export const Home = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-10">
      <h1 className="text-5xl font-extrabold">PopSauce</h1>
      <p className="mt-4 max-w-xl text-slate-300">
        Competitive real-time category game with host-controlled lobbies, synced leaderboard updates, and animated score feedback.
      </p>
      <div className="mt-8 flex gap-4">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold">Login</Link>
        <Link to="/lobby/demo-room" className="rounded-lg border border-white/25 px-5 py-2 font-semibold">Join Demo Lobby</Link>
      </div>
    </main>
  );
};
