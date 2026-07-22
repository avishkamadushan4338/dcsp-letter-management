import { Link, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const navigate = useNavigate();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <AuthProvider
        authClient={authClient}
        emailAndPassword={{ requireEmailVerification: false }}
        navigate={navigate}
        Link={({ href, ...props }) => <Link to={href} {...props} />}
      >
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
