<?php
/**
 * SlicePress Product Handler
 *
 * Creates a hidden WooCommerce product used as a cart container for custom prints.
 * Overrides price per cart item via cart_item_data.
 */

defined('ABSPATH') || exit;

class SlicePress_Product {

    const PRODUCT_SLUG = 'slicepress-custom-print';
    const PRODUCT_META = '_slicepress_product';

    public static function init() {
        add_action('woocommerce_before_calculate_totals', array(__CLASS__, 'set_custom_price'), 20);
        add_filter('woocommerce_get_item_data', array(__CLASS__, 'display_cart_item_data'), 10, 2);
        add_action('woocommerce_checkout_create_order_line_item', array(__CLASS__, 'save_order_item_meta'), 10, 4);
        add_action('woocommerce_after_order_itemmeta', array(__CLASS__, 'display_admin_order_meta'), 10, 3);
        add_filter('woocommerce_cart_item_name', array(__CLASS__, 'custom_cart_item_name'), 10, 3);
    }

    /**
     * Create the hidden product on activation.
     */
    public static function create_product() {
        $existing_id = self::get_product_id();
        if ($existing_id) {
            return $existing_id;
        }

        $product = new WC_Product_Simple();
        $product->set_name(__('Custom 3D Print', 'slicepress'));
        $product->set_slug(self::PRODUCT_SLUG);
        $product->set_status('publish');
        $product->set_catalog_visibility('hidden');
        $product->set_price(0);
        $product->set_regular_price(0);
        $product->set_sold_individually(false);
        $product->set_virtual(true);
        $product->set_tax_status('taxable');
        $product->set_description(__('Custom 3D printed part — see order details for specifications.', 'slicepress'));
        $product->save();

        $product_id = $product->get_id();
        update_post_meta($product_id, self::PRODUCT_META, '1');
        update_option('slicepress_product_id', $product_id);

        return $product_id;
    }

    /**
     * Get the hidden product ID.
     */
    public static function get_product_id() {
        $id = get_option('slicepress_product_id', 0);
        if ($id && get_post_status($id)) {
            return (int) $id;
        }
        return 0;
    }

    /**
     * Override product price for each cart item using stored cart_item_data.
     */
    public static function set_custom_price($cart) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return;
        }

        foreach ($cart->get_cart() as $cart_item) {
            if (isset($cart_item['slicepress_custom_price'])) {
                $price = floatval($cart_item['slicepress_custom_price']);
                $cart_item['data']->set_price($price);
            }
        }
    }

    /**
     * Show print details in cart and checkout.
     */
    public static function display_cart_item_data($item_data, $cart_item) {
        if (!isset($cart_item['slicepress_data'])) {
            return $item_data;
        }

        $data = $cart_item['slicepress_data'];

        $fields = array(
            'filename'      => __('File', 'slicepress'),
            'material'      => __('Material', 'slicepress'),
            'color'         => __('Color', 'slicepress'),
            'quality'       => __('Quality', 'slicepress'),
            'print_time'    => __('Print Time', 'slicepress'),
            'filament_used' => __('Filament', 'slicepress'),
            'dimensions'    => __('Dimensions', 'slicepress'),
        );

        foreach ($fields as $key => $label) {
            if (!empty($data[$key])) {
                $value = $data[$key];
                if ($key === 'filament_used') {
                    $value .= ' g';
                }
                $item_data[] = array(
                    'key'   => $label,
                    'value' => esc_html($value),
                );
            }
        }

        return $item_data;
    }

    /**
     * Save print metadata to order line items.
     */
    public static function save_order_item_meta($item, $cart_item_key, $values, $order) {
        if (!isset($values['slicepress_data'])) {
            return;
        }

        $data = $values['slicepress_data'];
        $meta_fields = array(
            'filename', 'material', 'color', 'quality',
            'print_time', 'filament_used', 'max_z', 'dimensions',
        );

        foreach ($meta_fields as $key) {
            if (!empty($data[$key])) {
                $item->add_meta_data(
                    '_slicepress_' . $key,
                    sanitize_text_field($data[$key]),
                    true
                );
            }
        }

        if (isset($values['slicepress_custom_price'])) {
            $item->add_meta_data('_slicepress_calculated_price', floatval($values['slicepress_custom_price']), true);
        }

        // Store the path to the sanitized 3MF file (fetched server-side from SlicePress API)
        if (!empty($values['slicepress_file_path'])) {
            $item->add_meta_data('_slicepress_file_path', $values['slicepress_file_path'], true);
        }
    }

    /**
     * Display print details in admin order view.
     */
    public static function display_admin_order_meta($item_id, $item, $product) {
        $meta_labels = array(
            '_slicepress_filename'      => __('File', 'slicepress'),
            '_slicepress_material'      => __('Material', 'slicepress'),
            '_slicepress_color'         => __('Color', 'slicepress'),
            '_slicepress_quality'       => __('Quality', 'slicepress'),
            '_slicepress_print_time'    => __('Print Time', 'slicepress'),
            '_slicepress_filament_used' => __('Filament Used', 'slicepress'),
            '_slicepress_max_z'         => __('Height (mm)', 'slicepress'),
            '_slicepress_dimensions'    => __('Dimensions', 'slicepress'),
        );

        $has_data = false;
        foreach ($meta_labels as $meta_key => $label) {
            $value = $item->get_meta($meta_key);
            if ($value) {
                if (!$has_data) {
                    echo '<div class="slicepress-order-meta" style="margin-top:10px;padding:8px;background:#f8f8f8;border-radius:4px;">';
                    echo '<strong>' . esc_html__('3D Print Details', 'slicepress') . '</strong><br>';
                    $has_data = true;
                }
                echo '<small>' . esc_html($label) . ': ' . esc_html($value) . '</small><br>';
            }
        }

        if ($has_data) {
            // Download link for the sanitized 3MF (only shown if file was stored)
            $file_path = $item->get_meta('_slicepress_file_path');
            if ($file_path && file_exists($file_path)) {
                $download_url = add_query_arg(array(
                    'action'  => 'slicepress_download_file',
                    'item_id' => $item_id,
                    'nonce'   => wp_create_nonce('slicepress_download_' . $item_id),
                ), admin_url('admin-ajax.php'));
                echo '<a href="' . esc_url($download_url) . '" class="button button-small" style="margin-top:6px;">'
                    . esc_html__('Download 3D File (.3mf)', 'slicepress')
                    . '</a>';
            }
            echo '</div>';
        }
    }

    /**
     * Custom cart item name showing the filename.
     */
    public static function custom_cart_item_name($name, $cart_item, $cart_item_key) {
        if (isset($cart_item['slicepress_data']['filename'])) {
            $filename = esc_html($cart_item['slicepress_data']['filename']);
            return __('3D Print', 'slicepress') . ' — ' . $filename;
        }
        return $name;
    }
}
