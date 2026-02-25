import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Login } from '../pages/Login';
import { RoomLobby } from '../pages/RoomLobby';
import { GameRoom } from '../pages/GameRoom';
import { Profile } from '../pages/Profile';

export const AppRouter = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/lobby/:roomId" element={<RoomLobby />} />
      <Route path="/game/:roomId" element={<GameRoom />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
);
