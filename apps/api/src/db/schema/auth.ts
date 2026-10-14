import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { classLevel, studyRhythm, track } from "./classes";
import { createdAt, id } from "./columns";

// Tables managed by Better Auth: property names must match its field names.
// Do not edit rows by hand (docs/data-model.md).

const authUpdatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const user = pgTable(
  "user",
  {
    id: id(),
    /** Always `composeName(firstName, lastName)`: kept because Better Auth requires it. */
    name: text().notNull(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    /** Profile photo: file name in the uploads directory (served under /avatars/). */
    image: text(),
    /**
     * Display label of the class ("4AL1 · 4A · Architecture logicielle"), kept in sync with the
     * columns below by refreshPromo.
     */
    promo: text(),
    levelId: uuid().references(() => classLevel.id, { onDelete: "set null" }),
    trackId: uuid().references(() => track.id, { onDelete: "set null" }),
    /** Initial or work-study; always work-study in an alternance-only year. */
    rhythm: studyRhythm(),
    /** Number of the class in its year, 1 to 9 (4AL1). */
    classNumber: smallint(),
    /** Started in January (rentrée décalée). */
    januaryIntake: boolean().notNull().default(false),
    isAdmin: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: authUpdatedAt(),
  },
  (t) => [
    check("user_email_domain_check", sql`${t.email} like '%@myskolae.fr'`),
    check("user_class_number_check", sql`${t.classNumber} between 1 and 9`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: createdAt(),
    updatedAt: authUpdatedAt(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: authUpdatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: authUpdatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** WebAuthn credentials (Face ID, fingerprint, phone screen lock), from @better-auth/passkey. */
export const passkey = pgTable(
  "passkey",
  {
    id: id(),
    /** Device label shown in the profile ("iPhone de Camille"). */
    name: text(),
    publicKey: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text().notNull().unique("passkey_credential_id_unique"),
    counter: integer().notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    aaguid: text(),
    createdAt: createdAt(),
  },
  (t) => [index("passkey_user_id_idx").on(t.userId)],
);
