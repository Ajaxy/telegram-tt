type TiptapAttributes = Record<string, string | undefined>;

export default function buildDefinedAttributes(attributes: TiptapAttributes) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}
