<?php
/**
 * SlicePress — Full-Width Page Template
 *
 * Instead of replacing the theme's template (which can break navigation),
 * we hook into the_content and replace the page content with our viewer.
 * The theme handles header, footer, and navigation normally.
 */
defined('ABSPATH') || exit;

// Let the theme render this page normally — we inject via the_content filter.
// This file is no longer used as a template override.
// See SlicePress_Shortcode::override_content() instead.

// Fallback: if somehow loaded directly, use the shortcode.
echo do_shortcode('[slicepress_quote]');
