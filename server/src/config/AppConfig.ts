import { Config, Context, Layer } from "effect";

// Every key here mirrors an existing .env variable 1:1 (see .env /
// README.md) - no new configuration surface is introduced.
export interface AppConfigShape {
  readonly port: number;
  readonly appBaseUrl: string;
  readonly dbHost: string;
  readonly dbPort: number;
  readonly dbUser: string;
  readonly dbPassword: string;
  readonly dbName: string;
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

export class AppConfig extends Context.Tag("AppConfig")<AppConfig, AppConfigShape>() {}

const configEffect = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  appBaseUrl: Config.string("APP_BASE_URL").pipe(Config.withDefault("http://localhost:3000")),

  dbHost: Config.string("DB_HOST").pipe(Config.withDefault("127.0.0.1")),
  dbPort: Config.number("DB_PORT").pipe(Config.withDefault(3306)),
  dbUser: Config.string("DB_USER").pipe(Config.withDefault("root")),
  dbPassword: Config.string("DB_PASSWORD").pipe(Config.withDefault("")),
  dbName: Config.string("DB_NAME").pipe(Config.withDefault("letter_management")),

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

  dcsUsername: Config.string("DCS_USERNAME").pipe(Config.withDefault("")),
  dcsPassword: Config.string("DCS_PASSWORD").pipe(Config.withDefault("")),
  subjectOfficerUsername: Config.string("SUBJECT_OFFICER_USERNAME").pipe(Config.withDefault("")),
  subjectOfficerPassword: Config.string("SUBJECT_OFFICER_PASSWORD").pipe(Config.withDefault("")),

  sessionSecret: Config.string("SESSION_SECRET").pipe(Config.withDefault("dev-only-insecure-secret")),
});

export const AppConfigLive = Layer.effect(AppConfig, configEffect);
