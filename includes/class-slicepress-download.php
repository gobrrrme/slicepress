<?php
/**
 * SlicePress File Download Handler
 *
 * Serves the stored 3MF file to shop admins.
 * Files are stored outside the web root (in /wp-content/uploads/slicepress/orders/
 * with a .htaccess deny) and are only accessible through this handler.
 *
 * Security:
 *  - Requires manage_woocommerce capability (shop admins only)
 *  - Nonce tied to the specific order item ID
 *  - Path validated to be within the expected uploads directory
 *  - No directory traversal possible (nonce + realpath check)
 */

defined('ABSPATH') || exit;

class SlicePress_Download {

    public static function init() {
        add_action('wp_ajax_slicepress_download_file', array(__CLASS__, 'handle'));
        // No nopriv — downloads are admin-only
    }

    public static function handle() {
        // Shop admins only
        if (!current_user_can('manage_woocommerce')) {
            wp_die(esc_html__('Unauthorized.', 'slicepress'), 403);
        }

        $item_id = intval($_GET['item_id'] ?? 0);
        if ($item_id <= 0) {
            wp_die(esc_html__('Invalid request.', 'slicepress'), 400);
        }

        // Nonce is tied to this specific item ID
        if (!check_ajax_referer('slicepress_download_' . $item_id, 'nonce', false)) {
            wp_die(esc_html__('Security check failed.', 'slicepress'), 403);
        }

        $order_item = WC_Order_Factory::get_order_item($item_id);
        if (!$order_item) {
            wp_die(esc_html__('Order item not found.', 'slicepress'), 404);
        }

        $file_path = $order_item->get_meta('_slicepress_file_path');
        if (empty($file_path)) {
            wp_die(esc_html__('No file attached to this order item.', 'slicepress'), 404);
        }

        if (!file_exists($file_path)) {
            wp_die(esc_html__('File not found on disk.', 'slicepress'), 404);
        }

        // Path traversal guard — resolved path must be inside uploads/slicepress/orders/
        $upload_dir    = wp_upload_dir();
        $allowed_base  = realpath($upload_dir['basedir'] . '/slicepress/orders');
        $resolved_path = realpath($file_path);

        if (!$allowed_base || !$resolved_path || strpos($resolved_path, $allowed_base . DIRECTORY_SEPARATOR) !== 0) {
            wp_die(esc_html__('Invalid file path.', 'slicepress'), 403);
        }

        // Use original filename from order meta for the download prompt
        $original_filename = $order_item->get_meta('_slicepress_filename');
        if (empty($original_filename)) {
            $original_filename = 'model_processed.3mf';
        } else {
            // Always serve as .3mf regardless of what the customer uploaded
            $original_filename = pathinfo($original_filename, PATHINFO_FILENAME) . '_processed.3mf';
        }

        // Stream the file
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . rawurlencode($original_filename) . '"');
        header('Content-Length: ' . filesize($resolved_path));
        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');

        readfile($resolved_path);
        exit;
    }
}
