import { describe, it, expect, vi } from "vitest";
import { createUploadUrl, isSafePath } from "./documentUpload";

describe("isSafePath", () => {
  it("accepts lowercase alnum/slash/dash/underscore paths", () => {
    expect(isSafePath("consent/123/abc.jpg")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isSafePath("../etc/passwd")).toBe(false);
    expect(isSafePath("consent/../../etc/passwd")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(isSafePath("/etc/passwd")).toBe(false);
  });

  it("rejects uppercase or unexpected characters", () => {
    expect(isSafePath("Consent/123/abc.jpg")).toBe(false);
    expect(isSafePath("consent/123/abc.jpg;drop")).toBe(false);
  });
});

describe("createUploadUrl", () => {
  it("returns signed URL with bucket + path", async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://x.supabase.co/upload?token=abc", path: "consent/123/abc.jpg" },
            error: null,
          }),
        }),
      },
    };
    const result = await createUploadUrl(mockClient as never, "clinic-private", "consent/123/abc.jpg");
    expect(result.url).toBe("https://x.supabase.co/upload?token=abc");
    expect(result.path).toBe("consent/123/abc.jpg");
    expect(mockClient.storage.from).toHaveBeenCalledWith("clinic-private");
  });

  it("rejects path traversal attempts before calling Supabase", async () => {
    const mockClient = { storage: { from: vi.fn() } };
    await expect(createUploadUrl(mockClient as never, "clinic-private", "../etc/passwd")).rejects.toThrow(/path/i);
    expect(mockClient.storage.from).not.toHaveBeenCalled();
  });

  it("throws when Supabase returns an error", async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({ data: null, error: { message: "bucket not found" } }),
        }),
      },
    };
    await expect(createUploadUrl(mockClient as never, "clinic-private", "consent/1/a.jpg")).rejects.toThrow(
      /STORAGE_SIGN_FAILED/,
    );
  });
});
