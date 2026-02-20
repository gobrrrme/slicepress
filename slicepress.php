<?php
/**
 * Plugin Name: SlicePress
 * Plugin URI: https://slicepress.druckhochdrei.com
 * Description: SlicePress — 3D model viewer with instant print quoting for WooCommerce. Powered by slicepress.druckhochdrei.com.
 * Version: 1.1.2
 * Author: Druck Hoch Drei
 * Author URI: https://slicepress.druckhochdrei.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: slicepress
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

defined('ABSPATH') || exit;

define('SLICEPRESS_VERSION', '1.1.2');
define('SLICEPRESS_PLUGIN_FILE', __FILE__);
define('SLICEPRESS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SLICEPRESS_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Check if WooCommerce is active before loading.
 */
function slicepress_check_woocommerce() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>';
            esc_html_e('SlicePress requires WooCommerce to be installed and active.', 'slicepress');
            echo '</p></div>';
        });
        return false;
    }
    return true;
}

/**
 * Plugin activation hook.
 */
function slicepress_activate() {
    // Defaults need to be set before product/page creation
    $defaults = array(
        'slicepress_slicer_url'        => 'https://slicepress.druckhochdrei.com',
        'slicepress_max_file_size'     => 21,
        'slicepress_price_pla'         => '2.4',
        'slicepress_price_petg'        => '2.6',
        'slicepress_electricity_rate'  => '24',
        'slicepress_printer_power'     => '120',
        'slicepress_printer_hourly'    => '240',
        'slicepress_minimum_price'     => '240',
        'slicepress_price_multiplier'  => '1.0',
        'slicepress_materials'         => 'PLA,PETG',
        'slicepress_colors'            => 'Black,White,Gray,Red,Blue,Green,Orange,Yellow',
        'slicepress_currency'          => 'EUR',
        'slicepress_currency_symbol'   => '',
    );

    foreach ($defaults as $key => $value) {
        if (get_option($key) === false) {
            add_option($key, $value);
        }
    }

    // Flag so we can run WC-dependent setup on next admin_init
    set_transient('slicepress_activation_redirect', true, 30);
}
register_activation_hook(__FILE__, 'slicepress_activate');

/**
 * Plugin deactivation hook.
 */
function slicepress_deactivate() {
    // Product and page stay for order history
}
register_deactivation_hook(__FILE__, 'slicepress_deactivate');

/**
 * Declare compatibility with WooCommerce HPOS and Blocks.
 */
add_action('before_woocommerce_init', function () {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

/**
 * Initialize plugin after all plugins are loaded.
 */
add_action('plugins_loaded', function () {
    if (!slicepress_check_woocommerce()) {
        return;
    }

    require_once SLICEPRESS_PLUGIN_DIR . 'includes/class-slicepress-settings.php';
    require_once SLICEPRESS_PLUGIN_DIR . 'includes/class-slicepress-product.php';
    require_once SLICEPRESS_PLUGIN_DIR . 'includes/class-slicepress-shortcode.php';
    require_once SLICEPRESS_PLUGIN_DIR . 'includes/class-slicepress-ajax.php';
    require_once SLICEPRESS_PLUGIN_DIR . 'includes/class-slicepress-download.php';

    SlicePress_Settings::init();
    SlicePress_Product::init();
    SlicePress_Shortcode::init();
    SlicePress_Ajax::init();
    SlicePress_Download::init();

    // Admin menu under WooCommerce
    add_action('admin_menu', 'slicepress_admin_menu');

    // Ensure product + page exist (catches missed activations)
    add_action('admin_init', 'slicepress_ensure_setup');
});

/**
 * Add menu item under WooCommerce.
 */
function slicepress_admin_menu() {
    add_submenu_page(
        'woocommerce',
        __('SlicePress Settings', 'slicepress'),
        __('SlicePress', 'slicepress'),
        'manage_woocommerce',
        'admin.php?page=wc-settings&tab=slicepress'
    );
}

/**
 * Ensure hidden product and shortcode page exist.
 * Runs on every admin_init as a safety net.
 */
function slicepress_ensure_setup() {
    // Create hidden product if missing
    if (!SlicePress_Product::get_product_id()) {
        SlicePress_Product::create_product();
    }

    // Create shortcode page if missing
    $page_id = get_option('slicepress_page_id', 0);
    if (!$page_id || !get_post_status($page_id)) {
        $page_id = wp_insert_post(array(
            'post_title'   => __('Quote 3D Print', 'slicepress'),
            'post_content' => '<!-- wp:shortcode -->[slicepress_quote]<!-- /wp:shortcode -->',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_name'    => 'quote-3d-print',
        ));
        if ($page_id && !is_wp_error($page_id)) {
            update_option('slicepress_page_id', $page_id);
        }
    }

    // Redirect to settings after first activation
    if (get_transient('slicepress_activation_redirect')) {
        delete_transient('slicepress_activation_redirect');
        if (!isset($_GET['activate-multi'])) {
            wp_safe_redirect(admin_url('admin.php?page=wc-settings&tab=slicepress'));
            exit;
        }
    }
}
