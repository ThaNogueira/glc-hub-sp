import { enabledProviders } from "@/lib/oauth";

/** Botões "entrar com Google/Discord" — só aparecem se o provedor tem env. */
export function OAuthButtons() {
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="oauth-divider">
        <span>ou</span>
      </div>
      <div className="form-grid" style={{ gap: "0.5rem" }}>
        {providers.includes("google") && (
          <a href="/api/oauth/google" className="btn secondary oauth-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.1A12 12 0 0 0 1.2 6.6l4.1 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
              />
            </svg>
            Entrar com Google
          </a>
        )}
        {providers.includes("discord") && (
          <a href="/api/oauth/discord" className="btn secondary oauth-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
              <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18 18 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-5 1.5A20.3 20.3 0 0 0 .1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.2 2a19.8 19.8 0 0 0 6.1-3 20.2 20.2 0 0 0-3.6-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
            </svg>
            Entrar com Discord
          </a>
        )}
      </div>
    </div>
  );
}
