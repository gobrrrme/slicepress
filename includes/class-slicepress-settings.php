<?php
/**
 * SlicePress Settings
 *
 * Adds a settings tab under WooCommerce > Settings > SlicePress.
 */

defined('ABSPATH') || exit;

class SlicePress_Settings {

    public static function init() {
        add_filter('woocommerce_settings_tabs_array', array(__CLASS__, 'add_tab'), 50);
        add_action('woocommerce_settings_tabs_slicepress', array(__CLASS__, 'output'));
        add_action('woocommerce_update_options_slicepress', array(__CLASS__, 'save'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_admin_css'));
    }

    public static function add_tab($tabs) {
        $tabs['slicepress'] = __('SlicePress', 'slicepress');
        return $tabs;
    }

    public static function enqueue_admin_css($hook) {
        if ($hook !== 'woocommerce_page_wc-settings') {
            return;
        }
        if (!isset($_GET['tab']) || $_GET['tab'] !== 'slicepress') {
            return;
        }
        wp_enqueue_style(
            'slicepress-admin',
            SLICEPRESS_PLUGIN_URL . 'assets/css/slicepress-admin.css',
            array(),
            SLICEPRESS_VERSION
        );
    }

    public static function get_settings() {
        return array(
            // Section: SlicePress Connection
            array(
                'title' => __('SlicePress Connection', 'slicepress'),
                'type'  => 'title',
                'desc'  => __('Connect to your SlicePress slicer service. Get your API key at <a href="https://slicepress.druckhochdrei.com" target="_blank">slicepress.druckhochdrei.com</a>.', 'slicepress'),
                'id'    => 'slicepress_slicer_section',
            ),
            array(
                'title'    => __('API Key', 'slicepress'),
                'id'       => 'slicepress_api_key',
                'type'     => 'password',
                'default'  => '',
                'desc_tip' => true,
                'desc'     => __('Your SlicePress API key (starts with sp_live_). Free tier: 1 slice/month. Upgrade for unlimited.', 'slicepress'),
            ),
            array(
                'title'             => __('Max File Size (MB)', 'slicepress'),
                'id'                => 'slicepress_max_file_size',
                'type'              => 'text',
                'default'           => '21',
                'desc_tip'          => true,
                'desc'              => __('Determined by your SlicePress plan. Free: 10 MB, Pro: 50 MB.', 'slicepress'),
                'custom_attributes' => array('disabled' => 'disabled'),
            ),
            array(
                'type' => 'sectionend',
                'id'   => 'slicepress_slicer_section',
            ),

            // Section: Appearance
            array(
                'title' => __('Appearance', 'slicepress'),
                'type'  => 'title',
                'desc'  => __('Controls how the viewer blends into your theme.', 'slicepress'),
                'id'    => 'slicepress_appearance_section',
            ),
            array(
                'title'    => __('Viewer Theme', 'slicepress'),
                'id'       => 'slicepress_viewer_theme',
                'type'     => 'select',
                'default'  => 'auto',
                'desc_tip' => true,
                'desc'     => __('Auto-detect reads your theme\'s colors. Force Light or Force Dark if auto-detection produces wrong results on your theme.', 'slicepress'),
                'options'  => array(
                    'auto'  => __('Auto-detect (recommended)', 'slicepress'),
                    'light' => __('Force Light', 'slicepress'),
                    'dark'  => __('Force Dark', 'slicepress'),
                ),
            ),
            array(
                'type' => 'sectionend',
                'id'   => 'slicepress_appearance_section',
            ),

            // Section: Materials & Colors
            array(
                'title' => __('Materials & Colors', 'slicepress'),
                'type'  => 'title',
                'desc'  => __('Comma-separated lists of available materials and colors.', 'slicepress'),
                'id'    => 'slicepress_materials_section',
            ),
            array(
                'title'             => __('Materials', 'slicepress'),
                'desc'              => __('Available slicer profiles. More materials coming soon.', 'slicepress'),
                'id'                => 'slicepress_materials',
                'type'              => 'text',
                'default'           => 'PLA,PETG',
                'desc_tip'          => true,
                'custom_attributes' => array('disabled' => 'disabled'),
            ),
            array(
                'title'    => __('Colors', 'slicepress'),
                'desc'     => __('Comma-separated list (e.g. Black,White,Red).', 'slicepress'),
                'id'       => 'slicepress_colors',
                'type'     => 'text',
                'default'  => 'Black,White,Gray,Red,Blue,Green,Orange,Yellow',
                'desc_tip' => true,
            ),
            array(
                'type' => 'sectionend',
                'id'   => 'slicepress_materials_section',
            ),

            // Section: Pricing
            array(
                'title' => __('Pricing', 'slicepress'),
                'type'  => 'title',
                'desc'  => __('Cost rates used to calculate print quotes. All values in cents (of your store currency).', 'slicepress'),
                'id'    => 'slicepress_pricing_section',
            ),
            array(
                'title'    => __('PLA Price (cents/gram)', 'slicepress'),
                'id'       => 'slicepress_price_pla',
                'type'     => 'text',
                'default'  => '2.4',
                'desc_tip' => true,
                'desc'     => __('Cost per gram of PLA filament in cents.', 'slicepress'),
            ),
            array(
                'title'    => __('PETG Price (cents/gram)', 'slicepress'),
                'id'       => 'slicepress_price_petg',
                'type'     => 'text',
                'default'  => '2.6',
                'desc_tip' => true,
                'desc'     => __('Cost per gram of PETG filament in cents.', 'slicepress'),
            ),
            array(
                'title'    => __('Electricity Rate (cents/kWh)', 'slicepress'),
                'id'       => 'slicepress_electricity_rate',
                'type'     => 'text',
                'default'  => '24',
                'desc_tip' => true,
                'desc'     => __('Your electricity cost per kilowatt-hour in cents.', 'slicepress'),
            ),
            array(
                'title'    => __('Printer Power (watts)', 'slicepress'),
                'id'       => 'slicepress_printer_power',
                'type'     => 'text',
                'default'  => '120',
                'desc_tip' => true,
                'desc'     => __('Average power consumption of your printer in watts.', 'slicepress'),
            ),
            array(
                'title'    => __('Printer Hourly Rate (cents/hour)', 'slicepress'),
                'id'       => 'slicepress_printer_hourly',
                'type'     => 'text',
                'default'  => '240',
                'desc_tip' => true,
                'desc'     => __('Depreciation/wear cost per hour of printing in cents.', 'slicepress'),
            ),
            array(
                'title'    => __('Minimum Price (cents)', 'slicepress'),
                'id'       => 'slicepress_minimum_price',
                'type'     => 'text',
                'default'  => '240',
                'desc_tip' => true,
                'desc'     => __('Minimum base price added to every print in cents.', 'slicepress'),
            ),
            array(
                'title'    => __('Price Multiplier', 'slicepress'),
                'id'       => 'slicepress_price_multiplier',
                'type'     => 'text',
                'default'  => '1.0',
                'desc_tip' => true,
                'desc'     => __('Multiply the final price by this factor (e.g. 1.5 = 50% markup).', 'slicepress'),
            ),
            array(
                'title'    => __('Currency Symbol Override', 'slicepress'),
                'id'       => 'slicepress_currency_symbol',
                'type'     => 'text',
                'default'  => '',
                'desc_tip' => true,
                'desc'     => __('Leave empty to use WooCommerce default. Override for custom display (e.g. CHF, sats).', 'slicepress'),
            ),
            array(
                'type' => 'sectionend',
                'id'   => 'slicepress_pricing_section',
            ),
        );
    }

    public static function output() {
        woocommerce_admin_fields(self::get_settings());
    }

    public static function save() {
        woocommerce_update_options(self::get_settings());
    }

    /**
     * Get a setting value with fallback.
     */
    public static function get($key, $default = '') {
        $value = get_option($key, $default);
        return $value !== '' ? $value : $default;
    }
}
