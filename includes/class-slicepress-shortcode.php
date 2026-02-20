<?php
/**
 * SlicePress Shortcode
 *
 * Registers [slicepress_quote] and enqueues all frontend assets.
 * On the dedicated SlicePress page, replaces content via the_content filter
 * so the theme's header, footer, and navigation render normally.
 */

defined('ABSPATH') || exit;

class SlicePress_Shortcode {

    public static function init() {
        add_shortcode('slicepress_quote', array(__CLASS__, 'render'));
        add_filter('the_content', array(__CLASS__, 'override_content'), 20);
        add_action('wp_enqueue_scripts', array(__CLASS__, 'maybe_enqueue'));
    }

    /**
     * On the SlicePress page, enqueue assets early (wp_enqueue_scripts)
     * so they load in <head> / before footer regardless of content parsing.
     */
    public static function maybe_enqueue() {
        if (!is_page()) return;
        $page_id = get_option('slicepress_page_id', 0);
        if ($page_id && is_page($page_id)) {
            self::enqueue_assets();
        }
    }

    /**
     * On the SlicePress page, replace the_content with the full viewer.
     * The theme renders everything else (header, nav, footer) normally.
     */
    public static function override_content($content) {
        if (!is_page() || !in_the_loop() || !is_main_query()) {
            return $content;
        }

        $page_id = get_option('slicepress_page_id', 0);
        if (!$page_id || !is_page($page_id)) {
            return $content;
        }

        ob_start();
        include SLICEPRESS_PLUGIN_DIR . 'templates/viewer-inline.php';
        return ob_get_clean();
    }

    /**
     * Enqueue JS/CSS only when shortcode is present.
     */
    public static function enqueue_assets() {
        $ver = SLICEPRESS_VERSION;
        $url = SLICEPRESS_PLUGIN_URL . 'assets/';

        // Vendor libs
        wp_enqueue_script('slicepress-three', $url . 'vendor/three.min.js', array(), '0.149.0', true);
        wp_enqueue_script('slicepress-jszip', $url . 'vendor/jszip.min.js', array(), '3.10.1', true);

        // Plugin JS
        wp_enqueue_script('slicepress-controls', $url . 'js/slicepress-controls.js', array('slicepress-three'), $ver, true);
        wp_enqueue_script('slicepress-orient', $url . 'js/slicepress-orient.js', array(), $ver, true);
        wp_enqueue_script('slicepress-viewer', $url . 'js/slicepress-viewer.js', array('slicepress-three', 'slicepress-controls', 'slicepress-orient'), $ver, true);
        wp_enqueue_script('slicepress-slicer', $url . 'js/slicepress-slicer.js', array('slicepress-viewer'), $ver, true);
        wp_enqueue_script('slicepress-cart', $url . 'js/slicepress-cart.js', array('slicepress-slicer', 'jquery'), $ver, true);

        // Theme adaptation (detect colors before anything renders)
        wp_enqueue_script('slicepress-theme-adapt', $url . 'js/slicepress-theme-adapt.js', array(), $ver, false);

        // Inject viewer theme mode ('auto'|'light'|'dark') as an inline var BEFORE
        // the theme-adapt script runs — needed in Phase 1 which has no body access yet.
        $theme_mode = SlicePress_Settings::get('slicepress_viewer_theme', 'auto');
        if (!in_array($theme_mode, array('auto', 'light', 'dark'), true)) {
            $theme_mode = 'auto';
        }
        wp_add_inline_script(
            'slicepress-theme-adapt',
            'var slicepressThemeMode = ' . wp_json_encode($theme_mode) . ';',
            'before'
        );

        // CSS
        wp_enqueue_style('slicepress-viewer', $url . 'css/slicepress-viewer.css', array(), $ver);

        // Localize settings for JS
        $materials_raw = SlicePress_Settings::get('slicepress_materials', 'PLA,PETG');
        $materials = array_map('trim', explode(',', $materials_raw));

        $colors_raw = SlicePress_Settings::get('slicepress_colors', 'Black,White');
        $colors = array_map('trim', explode(',', $colors_raw));

        $currency_symbol = SlicePress_Settings::get('slicepress_currency_symbol', '');
        if (empty($currency_symbol)) {
            $currency_symbol = get_woocommerce_currency_symbol();
        }

        wp_localize_script('slicepress-slicer', 'slicepress_config', array(
            'slicer_url'       => esc_url(SlicePress_Settings::get('slicepress_slicer_url', 'https://slicepress.druckhochdrei.com')),
            'api_key'          => SlicePress_Settings::get('slicepress_api_key', ''),
            'max_file_size_mb' => intval(SlicePress_Settings::get('slicepress_max_file_size', 21)),
            'materials'        => $materials,
            'colors'           => $colors,
            'pricing'          => array(
                'pla_per_gram'      => floatval(SlicePress_Settings::get('slicepress_price_pla', '2.4')),
                'petg_per_gram'     => floatval(SlicePress_Settings::get('slicepress_price_petg', '2.6')),
                'electricity_rate'  => floatval(SlicePress_Settings::get('slicepress_electricity_rate', '24')),
                'printer_power'     => floatval(SlicePress_Settings::get('slicepress_printer_power', '120')),
                'printer_hourly'    => floatval(SlicePress_Settings::get('slicepress_printer_hourly', '240')),
                'minimum_price'     => floatval(SlicePress_Settings::get('slicepress_minimum_price', '240')),
                'multiplier'        => floatval(SlicePress_Settings::get('slicepress_price_multiplier', '1.0')),
            ),
            'currency_symbol'  => $currency_symbol,
            'ajax_url'         => admin_url('admin-ajax.php'),
            'nonce'            => wp_create_nonce('slicepress_add_to_cart'),
            'product_id'       => SlicePress_Product::get_product_id(),
            'cart_url'         => wc_get_cart_url(),
        ));
    }

    /**
     * Render the shortcode output (used when embedded in other pages).
     */
    public static function render($atts) {
        if (!class_exists('WooCommerce')) {
            return '<p>' . esc_html__('WooCommerce is required.', 'slicepress') . '</p>';
        }

        self::enqueue_assets();

        ob_start();
        include SLICEPRESS_PLUGIN_DIR . 'templates/viewer-shortcode.php';
        return ob_get_clean();
    }
}
