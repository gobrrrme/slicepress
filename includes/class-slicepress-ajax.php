<?php
/**
 * SlicePress AJAX Handler
 *
 * Handles add-to-cart via AJAX with nonce verification and rate limiting.
 * After adding to cart, fetches the sanitized 3MF from the SlicePress API
 * server-side (using the API key) and stores it in the uploads directory.
 * The original user file is never re-uploaded or re-used.
 */

defined('ABSPATH') || exit;

class SlicePress_Ajax {

    public static function init() {
        add_action('wp_ajax_slicepress_add_to_cart', array(__CLASS__, 'add_to_cart'));
        add_action('wp_ajax_nopriv_slicepress_add_to_cart', array(__CLASS__, 'add_to_cart'));
    }

    /**
     * Rate limit check using transients.
     */
    private static function check_rate_limit() {
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
        $key = 'slicepress_rate_' . md5($ip);
        $count = (int) get_transient($key);

        if ($count >= 10) {
            return false;
        }

        set_transient($key, $count + 1, 60);
        return true;
    }

    /**
     * AJAX add-to-cart handler.
     */
    public static function add_to_cart() {
        // Verify nonce
        if (!check_ajax_referer('slicepress_add_to_cart', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'slicepress')), 403);
        }

        // Rate limit
        if (!self::check_rate_limit()) {
            wp_send_json_error(array('message' => __('Too many requests. Please wait a moment.', 'slicepress')), 429);
        }

        $product_id = SlicePress_Product::get_product_id();
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Print product not configured.', 'slicepress')), 500);
        }

        // Sanitize inputs
        $price         = floatval($_POST['price'] ?? 0);
        $filename      = sanitize_text_field($_POST['filename'] ?? '');
        $material      = sanitize_text_field($_POST['material'] ?? '');
        $color         = sanitize_text_field($_POST['color'] ?? '');
        $quality       = sanitize_text_field($_POST['quality'] ?? '');
        $print_time    = sanitize_text_field($_POST['print_time'] ?? '');
        $filament_used = sanitize_text_field($_POST['filament_used'] ?? '');
        $max_z         = sanitize_text_field($_POST['max_z'] ?? '');
        $dimensions    = sanitize_text_field($_POST['dimensions'] ?? '');
        $job_id        = sanitize_text_field($_POST['job_id'] ?? '');

        // Validate price range
        if ($price < 0.01 || $price > 100000) {
            wp_send_json_error(array('message' => __('Invalid price.', 'slicepress')), 400);
        }

        // Validate required fields
        if (empty($filename) || empty($material) || empty($color)) {
            wp_send_json_error(array('message' => __('Missing required fields.', 'slicepress')), 400);
        }

        // Fetch the sanitized 3MF from SlicePress API (server-to-server, no user file re-upload)
        $file_path = '';
        if (!empty($job_id)) {
            $result = self::fetch_and_store_3mf($job_id, $filename);
            if (!is_wp_error($result)) {
                $file_path = $result;
            }
            // Non-fatal: if fetch fails, order proceeds without stored file
        }

        // Build cart item data
        $cart_item_data = array(
            'slicepress_custom_price' => $price,
            'slicepress_data'         => array(
                'filename'      => $filename,
                'material'      => $material,
                'color'         => $color,
                'quality'       => $quality,
                'print_time'    => $print_time,
                'filament_used' => $filament_used,
                'max_z'         => $max_z,
                'dimensions'    => $dimensions,
            ),
            'slicepress_file_path' => $file_path,
            // Unique key so the same file can be added multiple times
            'unique_key'      => md5($filename . $material . $color . $quality . microtime()),
        );

        $cart_item_key = WC()->cart->add_to_cart($product_id, 1, 0, array(), $cart_item_data);

        if ($cart_item_key) {
            wp_send_json_success(array(
                'message'    => __('Added to cart!', 'slicepress'),
                'cart_url'   => wc_get_cart_url(),
                'cart_count' => WC()->cart->get_cart_contents_count(),
            ));
        } else {
            wp_send_json_error(array('message' => __('Failed to add to cart.', 'slicepress')), 500);
        }
    }

    /**
     * Fetch the sanitized 3MF from the SlicePress API using the stored API key,
     * then save it to the WordPress uploads directory.
     *
     * @param  string $job_id    The slicer job ID from the slice response.
     * @param  string $filename  Original filename (used to derive storage name).
     * @return string|WP_Error   Absolute path to saved file, or WP_Error on failure.
     */
    private static function fetch_and_store_3mf($job_id, $filename) {
        // Strict job_id validation — must be digits + underscores only (slicer timestamp format)
        if (!preg_match('/^[0-9_]{10,30}$/', $job_id)) {
            return new WP_Error('invalid_job_id', __('Invalid job ID.', 'slicepress'));
        }

        $api_key    = SlicePress_Settings::get('slicepress_api_key', '');
        $slicer_url = rtrim(SlicePress_Settings::get('slicepress_slicer_url', ''), '/');

        if (empty($api_key) || empty($slicer_url)) {
            return new WP_Error('no_api_key', __('No API key configured.', 'slicepress'));
        }

        $download_url = $slicer_url . '/api/download/' . rawurlencode($job_id);

        $response = wp_remote_get($download_url, array(
            'headers' => array('Authorization' => 'Bearer ' . $api_key),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status !== 200) {
            return new WP_Error('fetch_failed', sprintf(__('SlicePress API returned %d.', 'slicepress'), $status));
        }

        $content = wp_remote_retrieve_body($response);
        if (empty($content)) {
            return new WP_Error('empty_response', __('Empty file received.', 'slicepress'));
        }

        // Verify it's actually a ZIP/3MF (PK magic bytes)
        if (substr($content, 0, 2) !== "PK") {
            return new WP_Error('invalid_file', __('Downloaded file is not a valid 3MF.', 'slicepress'));
        }

        return self::store_file($content, $filename);
    }

    /**
     * Write file content to the protected SlicePress uploads directory.
     *
     * @param  string $content   Raw file bytes.
     * @param  string $filename  Original filename (used for suffix display only).
     * @return string|WP_Error   Absolute path on success.
     */
    private static function store_file($content, $filename) {
        $upload_dir      = wp_upload_dir();
        $slicepress_dir  = $upload_dir['basedir'] . '/slicepress/orders';

        if (!file_exists($slicepress_dir)) {
            wp_mkdir_p($slicepress_dir);
        }

        // Protect the parent directory from direct HTTP access
        $htaccess = $upload_dir['basedir'] . '/slicepress/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "Options -Indexes\ndeny from all\n");
            file_put_contents($upload_dir['basedir'] . '/slicepress/index.php', '<?php // Silence is golden.');
        }

        // Random filename — never expose original name, never guessable
        $hash      = wp_generate_password(24, false, false);
        $dest_path = $slicepress_dir . '/' . $hash . '.3mf';

        if (file_put_contents($dest_path, $content) === false) {
            return new WP_Error('write_failed', __('Could not write file to disk.', 'slicepress'));
        }

        return $dest_path;
    }
}
