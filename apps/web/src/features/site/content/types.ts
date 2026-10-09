import type { Fact } from "./pending";

export type PostalAddress = {
  readonly organizationName: string;
  readonly streetAddress: string;
  readonly postalCode: string;
  readonly addressLocality: string;
  readonly addressCountry: string;
};

export type Milestone = {
  readonly id: string;
  readonly date: string;
  readonly dateISO: string | null;
  readonly title: string;
  readonly description: string;
};

export type Organization = {
  readonly legalName: string;
  readonly displayName: string;
  readonly legalStatus: string;
  readonly rna: string;
  readonly siret: string;
  readonly siren: string;
  readonly address: PostalAddress;
  readonly mission: string;
  readonly missionSource: string;
  readonly activeSince: string;
  readonly activeSinceISO: string;
  readonly email: Fact<string>;
  readonly publicationDirector: Fact<string>;
  readonly timeline: readonly Milestone[];
};

/** A person named in the legal notice (publisher, host). */
export type LegalPerson = {
  readonly id: string;
  readonly name: string;
  /** What the person is to the association, e.g. « Secrétaire du BDE Mingo ». */
  readonly role?: string;
  readonly status?: string;
  readonly siret?: string;
  readonly siren?: string;
  /** NAF code and its label. */
  readonly activity?: string;
  readonly address?: string;
  /** Basis of the service, e.g. « À titre gratuit ». */
  readonly terms?: string;
};

export type SocialLink = {
  readonly id: string;
  readonly label: string;
  readonly url: Fact<string>;
};

export type TeamMember = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
};
