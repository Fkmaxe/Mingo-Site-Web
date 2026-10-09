import type { Metadata } from "next";
import { ORGANIZATION } from "@/features/site/content/organization";
import { SITE } from "@/features/site/content/site";
import { buildPageMetadata } from "@/features/site/metadata";
import { getShowcaseEvents, getVisitor } from "@/features/site/queries";
import {
  ContactCta,
  EventsPreview,
  Hero,
  LegalSnapshot,
  MissionPreview,
  StudentSpace,
} from "@/features/site/sections/home";

export const metadata: Metadata = {
  ...buildPageMetadata({
    route: "home",
    title: SITE.title,
    description: `Site officiel du ${ORGANIZATION.displayName}, bureau des étudiants de l'ESGI à Paris. ${ORGANIZATION.mission}`,
  }),
  // The home page carries the association's name itself, without the title template.
  title: { absolute: SITE.title },
};

export default async function HomePage() {
  const [me, events] = await Promise.all([getVisitor(), getShowcaseEvents(6)]);
  const signedIn = me !== null;
  return (
    <>
      <Hero signedIn={signedIn} />
      <EventsPreview current={events.current} past={events.past} now={new Date()} />
      <StudentSpace signedIn={signedIn} />
      <MissionPreview />
      <LegalSnapshot />
      <ContactCta />
    </>
  );
}
