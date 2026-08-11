import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/navbar/NavBar";
import { PokedexPage } from "./pages/PokedexPage";

const App = () => (
  <>
    <NavBar />
    <Routes>
      <Route path="/" element={<PokedexPage />} />
    </Routes>
  </>
);

export default App;
