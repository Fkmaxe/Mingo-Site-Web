/** Structured data: a native <script>, as data. Escaping "<" keeps it from closing the tag. */
export function JsonLd({ data }: { readonly data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON with "<" escaped.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
