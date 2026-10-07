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

const Password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH, `Le mot de passe doit faire au plus ${PASSWORD_MAX_LENGTH} caractères`);

export const SignUpInput = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire").max(100),
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
