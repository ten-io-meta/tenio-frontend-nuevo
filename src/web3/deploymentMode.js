// Vercel Preview, local development and any build with unknown deployment
// provenance are READ ONLY. Only an explicitly identified Vercel production
// deployment can expose the historic Umbral V2 financial controls.
// A client guard protects this UI, not onchain contracts from direct calls.
export const PREVIEW_READ_ONLY =
  typeof __TENIO_READ_ONLY_PREVIEW__ === "boolean"
    ? __TENIO_READ_ONLY_PREVIEW__
    : true;

export function assertFinancialWritesEnabled() {
  if (PREVIEW_READ_ONLY) {
    throw new Error(
      "Esta versión Preview es solo lectura. No se permiten mints, quemas ni retiradas."
    );
  }
}
