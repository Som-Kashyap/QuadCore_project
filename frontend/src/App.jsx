import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Setup from "./pages/Setup";
import Results from "./pages/Results";
import "./App.css";

function getHashRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/setup")) return "#/setup";
  if (hash.startsWith("#/results")) return "#/results";
  return "#/";
}

function App() {
  const [route, setRoute] = useState(getHashRoute);

  useEffect(() => {
    function handleHashChange() {
      const newRoute = getHashRoute();
      setRoute(newRoute);

      // Handle in-page anchors for Landing like #features or #how-it-works
      const rawHash = window.location.hash;
      if (rawHash === "#features" || rawHash === "#how-it-works") {
        setRoute("#/");
        setTimeout(() => {
          const el = document.querySelector(rawHash);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
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
