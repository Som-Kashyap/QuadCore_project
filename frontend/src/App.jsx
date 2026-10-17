import { useState, useEffect } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Setup from "./pages/Setup";
import Results from "./pages/Results";

function getHashRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/setup")) return "#/setup";
  if (hash.startsWith("#/results")) return "#/results";
  return "#/";
}

function App() {
  const [route, setRoute] = useState(getHashRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="app-container">
      <Navbar currentRoute={route} />
      <main id="main-content" className="app-main">
        {route === "#/setup" && <Setup />}
        {route === "#/results" && <Results />}
        {route === "#/" && <Landing />}
      </main>
      <Footer />
    </div>
  );
}

export default App;