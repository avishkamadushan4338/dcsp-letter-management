import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LangToggle } from "../components/LangToggle.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { login } from "../lib/auth.js";

// Port of public/index.html - shared DCS/Subject-Officer login form.
export function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { role } = await login(username, password);
      navigate(role === "subject_officer" ? "/subject-officer-dashboard" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="auth-page">
      <a className="skip-link" href="#main">
        {t("skipToContent")}
      </a>
      <main id="main" className="auth-card">
        <h1>{t("appTitle")}</h1>
        <p className="subtitle">{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">{t("username")}</label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label htmlFor="password">{t("password")}</label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">{t("login")}</button>
          <p className="error" role="alert" aria-live="polite">
            {error}
          </p>
        </form>

        <LangToggle />
      </main>
    </div>
  );
}
