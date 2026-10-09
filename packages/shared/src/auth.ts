import { z } from "zod";

/** Only school accounts may sign up (docs/context.md). Also enforced by a SQL check. */
export const ALLOWED_EMAIL_DOMAIN = "myskolae.fr";
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

const SchoolEmail = z
  .email("Adresse email invalide")
  .refine(isAllowedEmail, `Utilise ton adresse @${ALLOWED_EMAIL_DOMAIN}`);

export const PERSON_NAME_MAX_LENGTH = 50;

/** Display name stored in `user.name` (Better Auth requires it): always "First Last". */
export function composeName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
}

/**
 * Best-effort split of a full name: first word = first name, the rest = last name.
 * Same rule as the backfill of migration 0025.
 */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Le ${label} est obligatoire`)
    .max(
      PERSON_NAME_MAX_LENGTH,
      `Le ${label} doit faire au plus ${PERSON_NAME_MAX_LENGTH} caractères`,
    );

export const PersonNameFields = {
  firstName: personName("prénom"),
  lastName: personName("nom"),
};

const Password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH, `Le mot de passe doit faire au plus ${PASSWORD_MAX_LENGTH} caractères`);

export const SignUpInput = z
  .object({
    ...PersonNameFields,
    email: SchoolEmail,
    password: Password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
});
export type SignInInput = z.infer<typeof SignInInput>;

export const ForgotPasswordInput = z.object({ email: SchoolEmail });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordInput = z
  .object({ password: Password, passwordConfirmation: z.string() })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;
