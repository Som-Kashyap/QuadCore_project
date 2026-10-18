import { useState, useEffect } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";

function getHashRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/dashboard") || hash.startsWith("#/results")) return "#/dashboard";
  if (hash.startsWith("#/setup")) return "#/setup";
  return "#/";
}

function App() {
  const [route, setRoute] = useState(getHashRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isWorkspace = route === "#/dashboard" || route === "#/setup";

  return (
    <div className="app-container">
      <Navbar currentRoute={route} />
      <main id="main-content" className="app-main">
        {route === "#/dashboard" && <Dashboard />}
        {route === "#/setup" && <Setup />}
        {route === "#/" && <Landing />}
      </main>
      {!isWorkspace && <Footer />}
    </div>
  );
}

export default App;