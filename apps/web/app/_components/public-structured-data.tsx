import {
  createPublicStructuredData,
  serializePublicStructuredData,
  type PublicStructuredDataInput,
} from "../_i18n/public-structured-data";

export function PublicStructuredData(input: PublicStructuredDataInput) {
  const value = createPublicStructuredData(input);
  if (value === null) return null;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializePublicStructuredData(value) }}
      type="application/ld+json"
    />
  );
}
