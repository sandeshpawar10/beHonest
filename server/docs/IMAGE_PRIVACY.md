# Found-item image privacy: stage one

## Contract

- `images`: one to five **JPEG, PNG or WebP base64 data URIs**, at most 5 MiB decoded each. URLs, SVG, animated images, corrupt images and images exceeding 20 megapixels are rejected.
- `allBlurZones`: object keyed by zero-based image index, e.g. `{ "0": [{ "x": 10, "y": 20, "w": 30, "h": 15 }], "1": [] }`. Up to 50 rectangles per image; coordinates are finite percentages of the EXIF-oriented image, widths/heights must be positive, and rectangles must fit entirely inside it. Missing indices mean no selected masks; they are saved as empty arrays. Nonexistent/noncanonical indices are rejected.
- Legacy `blurZones` is accepted only with exactly one image and without `allBlurZones`. Ambiguous requests are rejected, including empty legacy arrays sent alongside the new mapping.
- Returned `images` already contain permanent opaque masks; clients must use them directly. `allBlurZones` is retained as metadata, not a required rendering overlay.

## Storage and delivery

Sharp decodes, auto-orients and converts images to raw RGBA pixels, overwrites every selected rectangle with opaque black, and creates a metadata-free PNG. Outward rounding covers rectangle edges. Even images with no masks are independently re-encoded. Only marked regions are redacted; this is not automatic sensitive-content detection.

Originals are uploaded using Cloudinary `type: authenticated`, with independently random identifiers. A folder name alone is not an access control. Public re-encodes are separate `type: upload` assets; removing delivery transformations cannot recover masked pixels or find the original. New originals' asset references are stored in `originalImageAssets` with `select: false`. Original URLs are never stored. Existing `originalImages` is also excluded by default.

`imagePrivacyVersion: 1` is set by the creation controller only after every upload succeeds. Both model JSON and object serialization strip original fields (including create responses), hide images without this exact marker, and return `imagesUnavailable: true` for untrusted legacy records. Populated claim/escrow/admin image projections explicitly include the marker. Future `lean()`, aggregation, raw DB responses or transforms disabled by callers need equivalent filtering; do not bypass model serialization.

Stage one retains originals privately and **does not serve them through an API**, including to admins/reporters. Admin review currently receives only the safe public images. Any later original-review route must authorize admin access on every request and avoid publishing original URLs/IDs or caching image bytes publicly.

Existing remote assets are neither migrated nor deleted. Legacy image URLs previously disclosed may still work at Cloudinary; hiding them in application responses does not revoke earlier exposure. Do not simply stamp legacy documents with version 1.

New assets attempted during a failed image upload and completed assets from a failed item creation are deleted best-effort. Cleanup uses only newly generated request-local IDs; errors log generic messages without private refs. A process crash, ambiguous database write result, cloud upload/cleanup timeout or cleanup failure may require a separately authorized reconciliation job. No live migration or reconciliation runs here.

Claim-proof uploads still use the existing `uploadImage` API and are **outside this found-item privacy change**; their existing public-upload/URL behavior is not a privacy guarantee.

## Offline verification

Run `npm test` from `server/` for automated offline validation, pixel-redaction, upload-cleanup, serialization and frontend-contract regression tests. Cloudinary calls are mocked; these tests do not validate deployed cloud permissions or make live uploads.

Install from `server/package-lock.json` (`npm ci`; Sharp must support the deployment Node/platform). Mock Cloudinary uploader methods and Mongoose persistence; do not load `server.js`, connect to a real DB or use production credentials.

1. Submit two synthetic images with distinct per-image masks; inspect the uploaded public PNG bytes for solid black/opaque mask pixels, correct index mapping and stripped metadata. Check independent IDs and authenticated original upload options, including the no-mask case and EXIF rotation.
2. Reject URLs, malformed/noncanonical base64, unsupported/mismatched formats, oversized/animated/corrupt images, more than five images, invalid/overflowing/zero-size masks, more than 50 masks and ambiguous legacy mapping.
3. Serialize new and hydrated legacy item documents via `toJSON()`, `toObject()` and nested claim/escrow documents. Check create/list/detail/my-items, my-claims/my-escrows and admin responses never expose original refs and legacy images are empty with `imagesUnavailable: true`.
4. Mock failure at original upload, public upload, a later image and DB creation; verify best-effort cleanup uses only this request's new IDs. Successful persistence must not trigger cleanup if a later notification fails.
