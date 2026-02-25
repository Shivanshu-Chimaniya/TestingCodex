import { motion } from 'framer-motion';
import { LeaderboardEntry } from '../../store/game.store';

export const LeaderboardPanel = ({ entries }: { entries: LeaderboardEntry[] }) => {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <motion.div
          key={entry.userId}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/80 px-4 py-2"
        >
          <p className="font-medium">#{entry.rank} {entry.name}</p>
          <motion.p
            key={`${entry.userId}-${entry.score}`}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 0.35 }}
            className="font-bold text-amber-300"
          >
            {entry.score}
          </motion.p>
        </motion.div>
      ))}
    </div>
  );
};
