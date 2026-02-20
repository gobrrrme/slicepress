# Changelog

All notable changes to SlicePress are documented here.

---

## [1.1.2] — 2026-02-20

### Added
- Admin file download: shop owners can download the sanitized OrcaSlicer 3MF for each order directly from the WooCommerce order view
- Server-side 3MF fetch with API key authentication and magic byte validation
- Files stored outside web root (`uploads/slicepress/orders/`) with `.htaccess deny`
- Download link secured with per-item nonces and `manage_woocommerce` capability check
- Path traversal guard via `realpath()` against `uploads/slicepress/orders/`
- Viewer Theme setting: Auto / Force Light / Force Dark (fixes edge cases where auto-detection fails)
- FOUC prevention: two-phase theme detection — Phase 1 synchronous in `<head>`, Phase 2 refines on DOMContentLoaded
- WCAG 4.5:1 contrast enforcement for text on theme-inherited backgrounds

### Changed
- All 6 print quality profiles now shown: 0.08mm Extra Fine, 0.12mm High Quality, 0.12mm Fine, 0.20mm Standard, 0.20mm Strength, 0.28mm Extra Draft
- Theme adaptation fully rewrites theme-adapt.js with forced mode support via `slicepressThemeMode` inline var
- Plugin author updated to Druck Hoch Drei

---

## [1.0.0] — 2026-02-14

### Initial Release

- Three.js 3D viewer (r149) with orbit controls, wireframe, auto-rotate
- Smart Auto-Orient algorithm ported from OrcaSlicer's `Orient.cpp`
- STL upload and parsing (binary + ASCII)
- 3MF upload and parsing (ZIP-based)
- Material and quality selection dropdowns
- Client-side price calculation (material, electricity, printer time, base fee, multiplier)
- WooCommerce cart integration via `cart_item_data` (no product variation race conditions)
- Hidden WooCommerce product auto-created on activation
- Quote page auto-created with `[slicepress_quote]` shortcode
- Full-page template that breaks out of theme content wrapper
- Shortcode template for inline embedding
- WooCommerce Settings tab with full pricing configuration
- HPOS (High-Performance Order Storage) compatibility declaration
- Order meta: filename, material, quality, color, print time, filament weight, dimensions
- Rate limiting: 10 requests / 60 seconds per IP via WP transients
- Nonce verification on all AJAX handlers
- File validation: size limit, extension, MIME/magic bytes, ZIP bomb protection
