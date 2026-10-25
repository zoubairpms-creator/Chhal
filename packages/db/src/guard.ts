export function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL_TEST manquant");
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refus : la base de test doit finir par _test (reçu « ${name} »)`);
  }
  return url;
}
