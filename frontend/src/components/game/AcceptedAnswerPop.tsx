import { motion } from 'framer-motion';

export const AcceptedAnswerPop = ({ text }: { text: string }) => {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300"
    >
      {text}
    </motion.div>
  );
};
