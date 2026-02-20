/**
 * SlicePress — Theme Adaptation
 *
 * Detects the active WordPress / WooCommerce theme's colors
 * and sets CSS custom properties so the viewer UI blends in.
 *
 * Two-phase approach to eliminate flash-of-default-colors:
 *
 * Phase 1 — synchronous, runs immediately when script is parsed in <head>:
 *   Probes only document.documentElement (body doesn't exist yet).
 *   Sets card-bg, muted, input, overlay vars. Enough to prevent any flash.
 *
 * Phase 2 — DOMContentLoaded, body is available:
 *   Full probe including body background, text color, WooCommerce accent.
 *   Refines accent and text vars. No visible change if Phase 1 was correct.
 */
(function () {
    'use strict';

    var root = document.documentElement;

    /* ── helpers ───────────────────────────────────────────── */

    function css(el, prop) {
        return getComputedStyle(el).getPropertyValue(prop).trim();
    }

    /** Parse any CSS color to {r,g,b} or null */
    function parseColor(str) {
        if (!str) return null;
        var m = str.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3] };
        var h = str.match(/^#([0-9a-f]{3,8})$/i);
        if (h) {
            var hex = h[1];
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            return {
                r: parseInt(hex.substr(0,2), 16),
                g: parseInt(hex.substr(2,2), 16),
                b: parseInt(hex.substr(4,2), 16)
            };
        }
        return null;
    }

    /** Relative luminance (0 = black, 1 = white) */
    function luminance(c) {
        var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
        rs = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
        gs = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
        bs = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    /** WCAG contrast ratio between two luminance values */
    function contrastRatio(l1, l2) {
        var lighter = Math.max(l1, l2) + 0.05;
        var darker  = Math.min(l1, l2) + 0.05;
        return lighter / darker;
    }

    /**
     * Ensure the text color has at least 4.5:1 contrast against the card
     * background we actually apply (near-white for light themes, near-black
     * for dark themes). Returns a safe fallback if contrast is insufficient.
     */
    function ensureTextContrast(textColor, isDark) {
        // Approximate card-bg luminance for each branch:
        //   light → rgba(255,255,255,0.92) ≈ lum 0.92
        //   dark  → rgba(255,255,255,0.08) over dark bg ≈ lum 0.04
        var cardLum = isDark ? 0.04 : 0.92;
        var textLum = luminance(textColor);
        if (contrastRatio(cardLum, textLum) < 4.5) {
            return isDark ? { r: 220, g: 220, b: 220 } : { r: 30, g: 30, b: 30 };
        }
        return textColor;
    }

    /** Darken/lighten a color by a factor (-1..1) */
    function adjustColor(c, amount) {
        var r, g, b;
        if (amount < 0) {
            var f = 1 + amount;
            r = Math.round(c.r * f);
            g = Math.round(c.g * f);
            b = Math.round(c.b * f);
        } else {
            r = Math.round(c.r + (255 - c.r) * amount);
            g = Math.round(c.g + (255 - c.g) * amount);
            b = Math.round(c.b + (255 - c.b) * amount);
        }
        return { r: r, g: g, b: b };
    }

    function rgb(c)      { return 'rgb('  + c.r + ',' + c.g + ',' + c.b + ')'; }
    function rgba(c, a)  { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }

    /* ── Phase 1: early dark/light detection (no body needed) ─ */

    /**
     * Detects dark vs light using only document.documentElement.
     * Reliable signals available before body exists:
     *   1. Background-color on <html>
     *   2. prefers-color-scheme media query
     *   3. Common dark-mode classes / data attributes on <html>
     */
    function detectDarkEarly() {
        var isDark = false;

        // 1. Background on <html> element itself
        var htmlBg = parseColor(css(root, 'background-color'));
        if (htmlBg && !(htmlBg.r === 0 && htmlBg.g === 0 && htmlBg.b === 0 &&
                css(root, 'background-color').indexOf('0)') !== -1)) {
            isDark = luminance(htmlBg) < 0.4;
        }

        // 2. prefers-color-scheme (overrides if html has no explicit bg)
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            isDark = true;
        }

        // 3. Common theme signals on <html> — check after media query so
        //    explicit theme choice beats the system preference.
        var cls = ' ' + root.className.toLowerCase() + ' ';
        var dataTheme = (
            root.getAttribute('data-theme') ||
            root.getAttribute('data-color-scheme') ||
            root.getAttribute('data-bs-theme') || ''
        ).toLowerCase();

        if (/\s(dark|dark-mode|is-dark|night|theme-dark)\s/.test(cls) || dataTheme === 'dark')  isDark = true;
        if (/\s(light|light-mode|is-light|day|theme-light)\s/.test(cls) || dataTheme === 'light') isDark = false;

        return isDark;
    }

    /* ── Phase 2: full probe (body required) ─────────────────── */

    function probeFull() {
        var body = document.body;

        // Background — walk up from body
        var bgColor = parseColor(css(body, 'background-color'));
        if (!bgColor || (bgColor.r === 0 && bgColor.g === 0 && bgColor.b === 0 &&
            css(body, 'background-color').indexOf('0)') !== -1)) {
            bgColor = parseColor(css(root, 'background-color'));
        }
        if (!bgColor) bgColor = { r: 255, g: 255, b: 255 };

        // Text color
        var textColor = parseColor(css(body, 'color'));
        if (!textColor) textColor = { r: 51, g: 51, b: 51 };

        // Accent — try WooCommerce .button.alt, then link color
        var accent = null;
        var probeEl = document.createElement('a');
        probeEl.className = 'button alt';
        probeEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
        probeEl.textContent = 'x';
        body.appendChild(probeEl);
        accent = parseColor(css(probeEl, 'background-color'));
        if (accent && (accent.r + accent.g + accent.b === 0 ||
            (accent.r > 240 && accent.g > 240 && accent.b > 240))) {
            accent = parseColor(css(probeEl, 'color'));
        }
        body.removeChild(probeEl);

        if (!accent || (accent.r + accent.g + accent.b === 0)) {
            var linkEl = document.createElement('a');
            linkEl.href = '#';
            linkEl.style.cssText = 'position:absolute;visibility:hidden;';
            linkEl.textContent = 'x';
            body.appendChild(linkEl);
            accent = parseColor(css(linkEl, 'color'));
            body.removeChild(linkEl);
        }

        if (!accent) accent = { r: 0, g: 115, b: 170 };

        var isDark = luminance(bgColor) < 0.4;

        return { bg: bgColor, text: textColor, accent: accent, isDark: isDark };
    }

    /* ── apply helpers ────────────────────────────────────────── */

    /** Apply the structural card/UI vars — only needs isDark, no body. */
    function applyStructural(isDark) {
        root.style.setProperty('--slicepress-is-dark', isDark ? '1' : '0');
        if (isDark) {
            root.style.setProperty('--slicepress-card-bg',      'rgba(255,255,255,0.08)');
            root.style.setProperty('--slicepress-card-border',  'rgba(255,255,255,0.12)');
            root.style.setProperty('--slicepress-muted',        'rgba(255,255,255,0.5)');
            root.style.setProperty('--slicepress-input-bg',     'rgba(255,255,255,0.06)');
            root.style.setProperty('--slicepress-input-border', 'rgba(255,255,255,0.15)');
            root.style.setProperty('--slicepress-overlay-bg',   'rgba(0,0,0,0.75)');
            root.style.setProperty('--slicepress-shadow',       '0 2px 8px rgba(0,0,0,0.4)');
            root.style.setProperty('--slicepress-text',         'rgb(220,220,220)');
        } else {
            root.style.setProperty('--slicepress-card-bg',      'rgba(255,255,255,0.92)');
            root.style.setProperty('--slicepress-card-border',  'rgba(0,0,0,0.12)');
            root.style.setProperty('--slicepress-muted',        'rgba(0,0,0,0.5)');
            root.style.setProperty('--slicepress-input-bg',     'rgba(0,0,0,0.04)');
            root.style.setProperty('--slicepress-input-border', 'rgba(0,0,0,0.15)');
            root.style.setProperty('--slicepress-overlay-bg',   'rgba(255,255,255,0.85)');
            root.style.setProperty('--slicepress-shadow',       '0 2px 8px rgba(0,0,0,0.12)');
            root.style.setProperty('--slicepress-text',         'rgb(30,30,30)');
        }
    }

    /** Apply the theme-specific vars that require the full body probe. */
    function applyFull(t) {
        var safeText = ensureTextContrast(t.text, t.isDark);
        root.style.setProperty('--slicepress-accent',   rgb(t.accent));
        root.style.setProperty('--slicepress-accent-h', rgb(adjustColor(t.accent, -0.15)));
        root.style.setProperty('--slicepress-bg',       rgb(t.bg));
        root.style.setProperty('--slicepress-text',     rgb(safeText));
        // Re-apply structural in case full probe flipped isDark vs early detection
        applyStructural(t.isDark);
    }

    /* ── run ───────────────────────────────────────────────── */

    // slicepressThemeMode is injected as an inline script BEFORE this file
    // via wp_add_inline_script(..., 'before'). Values: 'auto'|'light'|'dark'.
    var forced = (typeof slicepressThemeMode !== 'undefined' &&
                  (slicepressThemeMode === 'light' || slicepressThemeMode === 'dark'))
                 ? slicepressThemeMode : 'auto';

    // Phase 1: synchronous — runs while <head> is being parsed, before any
    // body content is rendered. Prevents flash of default light-theme colors.
    var phase1Dark = (forced === 'dark') ? true
                   : (forced === 'light') ? false
                   : detectDarkEarly();
    applyStructural(phase1Dark);

    // Phase 2: full probe once body is available — refines accent + bg + text.
    // Structural vars are already correct from Phase 1; only accent may shift.
    function runPhase2() {
        var t = probeFull();
        // If theme mode is forced, override isDark so card vars stay consistent.
        if (forced !== 'auto') t.isDark = (forced === 'dark');
        applyFull(t);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runPhase2);
    } else {
        runPhase2();
    }

})();
