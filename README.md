# SlicePress - 3D Print Quoting for WooCommerce

**Instant 3D print quotes, right on your WooCommerce product page.**

Customers upload an STL or 3MF file, see a live 3D preview, pick material and quality, get an instant price quote based on real slicer data — and add it to cart. No back-and-forth emails. No manual calculations.

![SlicePress Demo](https://slicepress.druckhochdrei.com/static/DemoRecording.gif)

---

## Features

- **Interactive 3D viewer** — Three.js powered, works in any browser, no plugins needed
- **Real slicer data** — quotes based on actual filament usage and print time (OrcaSlicer engine)
- **STL + 3MF support** — binary and ASCII STL, full 3MF validation
- **Smart auto-orient** — automatically rotates models for optimal print position
- **Material & quality selection** — configurable options with per-material pricing
- **Add to cart** — seamless WooCommerce integration, HPOS compatible
- **Admin 3MF download** — download the processed file per order from the WooCommerce order screen
- **Theme-adaptive** — works with any WordPress theme

---

## Requirements

- WordPress 6.0+
- WooCommerce 7.0+
- A [SlicePress API key](https://slicepress.druckhochdrei.com) (free tier available)

The slicer backend is a hosted service — this plugin is the open-source WooCommerce client. The backend handles all the heavy lifting: slicing, file processing, and pricing calculations.

---

## Installation

1. Download the latest release below
2. In WordPress: **Plugins → Add New → Upload Plugin**
3. Upload the zip, activate
4. Go to **WooCommerce → Settings → SlicePress**
5. Enter your API key from [slicepress.druckhochdrei.com](https://slicepress.druckhochdrei.com)
6. Configure your pricing (markup, minimum price, materials)

---

## How it works

```
Customer uploads STL/3MF
        ↓
SlicePress API slices the file (OrcaSlicer, server-side)
        ↓
Real filament usage + print time returned
        ↓
Your pricing rules applied → instant quote shown
        ↓
Customer adds to cart → order placed
        ↓
You download the processed 3MF from the order screen
```

---

## License

GPL-2.0-or-later. The plugin is open-source.

---

## Download

**[→ Download latest release (v1.1.2)](https://github.com/gobrrrme/slicepress/releases/latest)**

Available on [WordPress.org](https://wordpress.org/plugins/slicepress/) once approved.
