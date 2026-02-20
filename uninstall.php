<?php
/**
 * SlicePress Uninstall
 *
 * Cleans up product, options, and transients on plugin deletion.
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

// Delete the hidden product
$product_id = get_option('slicepress_product_id');
if ($product_id) {
    wp_delete_post($product_id, true);
}

// Delete the auto-created page
$page_id = get_option('slicepress_page_id');
if ($page_id) {
    wp_delete_post($page_id, true);
}

// Delete all plugin options
$options = array(
    'slicepress_product_id',
    'slicepress_slicer_url',
    'slicepress_max_file_size',
    'slicepress_price_pla',
    'slicepress_price_petg',
    'slicepress_electricity_rate',
    'slicepress_printer_power',
    'slicepress_printer_hourly',
    'slicepress_minimum_price',
    'slicepress_price_multiplier',
    'slicepress_materials',
    'slicepress_colors',
    'slicepress_currency',
    'slicepress_currency_symbol',
    'slicepress_page_id',
);

foreach ($options as $option) {
    delete_option($option);
}

// Clean up rate limit transients
global $wpdb;
$wpdb->query(
    "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_slicepress_rate_%' OR option_name LIKE '_transient_timeout_slicepress_rate_%'"
);
