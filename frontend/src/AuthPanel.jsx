import { useState } from "react";
import { loginUser, registerUser } from "./api";

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser({ email, password, full_name: fullName });
      } else {
        await loginUser({ email, password });
      }
      await onAuthenticated();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">CarbonLedger</div>
        <p className="auth-eyebrow">INDUSTRIAL CARBON ACCOUNTING</p>
        <h1>{mode === "login" ? "Welcome back." : "Create your account."}</h1>
        <p className="auth-description">
          Sign in to manage your factory's emissions reporting.
        </p>

        {mode === "register" && (
          <label className="auth-field">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </label>
        )}

        <label className="auth-field">
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            required
          />
        </label>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "New to CarbonLedger?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  );
}
