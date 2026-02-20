/**
 * SlicePress Cart Integration
 * AJAX add-to-cart. Sends print metadata + job_id to the server.
 * The server-side handler fetches the sanitized 3MF from SlicePress directly
 * — the original user file never re-enters the system.
 */

/* global jQuery, slicepress_config, SlicePress_Slicer */

(function ($) {
    'use strict';

    $(document).ready(function () {
        var btn = document.getElementById('slicepress-add-cart-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var result = SlicePress_Slicer.getLastResult();
            if (!result) return;

            var color = document.getElementById('slicepress-color');
            if (!color || !color.value) {
                if (typeof slicepressViewer !== 'undefined') slicepressViewer.showError('Please select a color');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Adding...';

            $.ajax({
                url: slicepress_config.ajax_url,
                type: 'POST',
                data: {
                    action:        'slicepress_add_to_cart',
                    nonce:         slicepress_config.nonce,
                    price:         result.costs.total,
                    filename:      result.filename,
                    material:      result.material,
                    color:         color.value,
                    quality:       result.quality,
                    print_time:    result.time_str,
                    filament_used: result.filament_g.toFixed(1),
                    max_z:         result.max_z,
                    dimensions:    result.dimensions || '',
                    job_id:        result.job_id || ''
                },
                success: function (response) {
                    if (response.success) {
                        btn.textContent = 'Added!';
                        setTimeout(function () {
                            window.location.href = response.data.cart_url || slicepress_config.cart_url;
                        }, 600);
                    } else {
                        var msg = response.data && response.data.message ? response.data.message : 'Failed to add to cart';
                        if (typeof slicepressViewer !== 'undefined') slicepressViewer.showError(msg);
                        btn.disabled = false;
                        btn.textContent = 'Add to Cart';
                    }
                },
                error: function () {
                    if (typeof slicepressViewer !== 'undefined') slicepressViewer.showError('Network error');
                    btn.disabled = false;
                    btn.textContent = 'Add to Cart';
                }
            });
        });
    });
})(jQuery);
