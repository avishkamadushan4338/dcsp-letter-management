import { Config, Context, Layer } from "effect";

// Every key here mirrors an existing .env variable 1:1 (see .env /
// README.md) - no new configuration surface is introduced.
export interface AppConfigShape {
  readonly port: number;
  readonly appBaseUrl: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecure: boolean;
  readonly smtpUser: string;
  readonly smtpPass: string;
  readonly smtpFrom: string;
  readonly linkSecret: string;
  readonly linkExpiryHours: number;
  readonly dcsUsername: string;
  readonly dcsPassword: string;
  readonly subjectOfficerUsername: string;
  readonly subjectOfficerPassword: string;
  readonly sessionSecret: string;
}

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("AppConfig") {}

const configEffect = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  appBaseUrl: Config.string("APP_BASE_URL"),

  smtpHost: Config.string("SMTP_HOST").pipe(Config.withDefault("")),
  smtpPort: Config.number("SMTP_PORT").pipe(Config.withDefault(587)),
  smtpSecure: Config.boolean("SMTP_SECURE").pipe(Config.withDefault(false)),
  smtpUser: Config.string("SMTP_USER").pipe(Config.withDefault("")),
  smtpPass: Config.string("SMTP_PASS").pipe(Config.withDefault("")),
  smtpFrom: Config.string("SMTP_FROM").pipe(
    Config.orElse(() => Config.string("SMTP_USER")),
    Config.withDefault("")
  ),

  linkSecret: Config.string("LINK_SECRET").pipe(Config.withDefault("dev-only-insecure-secret")),
  linkExpiryHours: Config.number("LINK_EXPIRY_HOURS").pipe(Config.withDefault(72)),

  dcsUsername: Config.string("DCS_USERNAME").pipe(Config.withDefault("dcs.admin")),
  dcsPassword: Config.string("DCS_PASSWORD").pipe(Config.withDefault("changeme")),
  subjectOfficerUsername: Config.string("SUBJECT_OFFICER_USERNAME").pipe(Config.withDefault("subject.officer")),
  subjectOfficerPassword: Config.string("SUBJECT_OFFICER_PASSWORD").pipe(Config.withDefault("changeme")),

  sessionSecret: Config.string("SESSION_SECRET").pipe(Config.withDefault("dev-only-insecure-secret")),
});

export const AppConfigLive = Layer.effect(AppConfig, configEffect);
