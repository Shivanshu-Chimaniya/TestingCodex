import { useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import { getLeaderboardSnapshot } from '../services/api';
import { useGameStore } from '../store/game.store';
import { useRoomStore } from '../store/room.store';

export const useSocketEvents = (roomId: string) => {
  const rafRef = useRef<number | null>(null);
  const pendingLeaderboard = useRef<{ seq: number; leaderboard: Array<{ userId: string; name: string; score: number; rank: number }> } | null>(null);

  useEffect(() => {
    useRoomStore.getState().setLobbyState({ roomId });

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('room:join', { roomId });

    const onCountdown = ({ seconds }: { seconds: number }) => {
      useRoomStore.getState().setLobbyState({ countdown: seconds });
      useGameStore.getState().setLockInput(seconds > 0);
    };

    const onLobbyState = (payload: { isPrivate: boolean; players: Array<{ id: string; name: string; isHost: boolean; ready: boolean }> }) => {
      useRoomStore.getState().setLobbyState({
        isPrivate: payload.isPrivate,
        players: payload.players,
      });
    };

    const onLeaderboard = (payload: { seq: number; leaderboard: Array<{ userId: string; name: string; score: number; rank: number }> }) => {
      pendingLeaderboard.current = payload;

      if (rafRef.current !== null) {
        return;
      }

      rafRef.current = requestAnimationFrame(async () => {
        rafRef.current = null;
        const next = pendingLeaderboard.current;
        pendingLeaderboard.current = null;

        if (!next) {
          return;
        }

        const result = useGameStore.getState().applyLeaderboardUpdate(next.seq, next.leaderboard);
        if (result.gapDetected) {
          const snapshot = await getLeaderboardSnapshot(roomId);
          useGameStore.getState().forceSyncLeaderboard(snapshot.seq, snapshot.leaderboard);
        }
      });
    };

    socket.on('room:countdown', onCountdown);
    socket.on('room:state', onLobbyState);
    socket.on('leaderboard:update', onLeaderboard);

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('room:countdown', onCountdown);
      socket.off('room:state', onLobbyState);
      socket.off('leaderboard:update', onLeaderboard);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [roomId]);
};
