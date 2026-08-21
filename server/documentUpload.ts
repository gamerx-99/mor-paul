export function isSafePath(path: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return /^[a-z0-9/._-]+$/.test(path);
}

export async function createUploadUrl(
  client: { storage: { from: (bucket: string) => { createSignedUploadUrl: (path: string) => Promise<{ data: { signedUrl: string; path: string } | null; error: { message: string } | null }> } } },
  bucket: string,
  path: string,
): Promise<{ url: string; path: string }> {
  if (!isSafePath(path)) throw new Error("INVALID_STORAGE_PATH");
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`STORAGE_SIGN_FAILED: ${error?.message ?? "unknown"}`);
  return { url: data.signedUrl, path: data.path };
}
