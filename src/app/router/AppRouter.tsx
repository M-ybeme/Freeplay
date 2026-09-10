import { Route, Routes } from "react-router-dom";
import { Home } from "../../pages/Home/Home";
import { Game } from "../../pages/Game/Game";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game/:gameId" element={<Game />} />
    </Routes>
  );
}
