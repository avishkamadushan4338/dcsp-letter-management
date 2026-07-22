import type { AuthPlugin } from "@better-auth-ui/react";

// No plugins (magic link, passkey, organization, etc.) are installed in this
// app, so `AuthPluginRegister` is never widened by a plugin module. The
// generated components under `@/components/auth` still reference the full
// react `AuthPlugin` shape (views, fallbackViews, captchaComponent, ...), so
// this augmentation supplies it directly.
declare module "@better-auth-ui/core" {
  interface AuthPluginRegister {
    react: AuthPlugin;
  }
}
