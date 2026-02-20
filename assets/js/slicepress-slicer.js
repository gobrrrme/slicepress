/**
 * SlicePress Slicer Integration
 * Sends file to remote slicer API, receives raw metrics,
 * calculates price client-side using store settings.
 */

/* global slicepress_config, slicepressViewer */

var SlicePress_Slicer = (function () {
    'use strict';

    // Current slice result (used by cart.js)
    var lastResult = null;

    function init() {
        populateDropdowns();

        var sliceBtn = document.getElementById('slicepress-slice-btn');
        if (sliceBtn) {
            sliceBtn.addEventListener('click', handleSlice);
        }
    }

    function populateDropdowns() {
        var cfg = slicepress_config;

        // Materials
        var matSelect = document.getElementById('slicepress-material');
        if (matSelect && cfg.materials) {
            matSelect.innerHTML = '';
            cfg.materials.forEach(function (m) {
                var opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                matSelect.appendChild(opt);
            });
        }

        // Colors
        var colorSelect = document.getElementById('slicepress-color');
        if (colorSelect && cfg.colors) {
            colorSelect.innerHTML = '';
            cfg.colors.forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                colorSelect.appendChild(opt);
            });
        }
    }

    function handleSlice() {
        var fileData = slicepressViewer.getFile();
        if (!fileData) {
            slicepressViewer.showError('Please upload a file first');
            return;
        }

        var btn = document.getElementById('slicepress-slice-btn');
        btn.disabled = true;
        btn.textContent = 'Slicing...';

        var material = document.getElementById('slicepress-material').value;
        var quality = document.getElementById('slicepress-quality').value;

        var formData = new FormData();
        formData.append('file', fileData.blob, fileData.name);
        formData.append('filament_type', material);
        formData.append('quality', quality);

        var slicerUrl = slicepress_config.slicer_url.replace(/\/+$/, '');
        var headers = {};
        if (slicepress_config.api_key) {
            headers['Authorization'] = 'Bearer ' + slicepress_config.api_key;
        }

        fetch(slicerUrl + '/api/slice', {
            method: 'POST',
            headers: headers,
            body: formData
        })
        .then(function (response) {
            if (response.status === 429) {
                throw new Error('Monthly slice limit reached. Upgrade at slicepress.druckhochdrei.com for unlimited slicing.');
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error('Invalid API key. Check your SlicePress API key in WooCommerce > Settings > SlicePress.');
            }
            if (!response.ok) throw new Error('Slicer returned ' + response.status);
            return response.json();
        })
        .then(function (data) {
            if (!data.success) throw new Error(data.error || 'Slicing failed');

            var filament_g = data.filament ? data.filament.used_g : 0;
            var time_min = data.total_time_in_min || 0;
            var max_z = data.max_z || 0;
            var total_time_str = data.total_time || '';

            var costs = calculatePrice(filament_g, time_min, material);

            lastResult = {
                filename: fileData.name,
                material: material,
                quality: quality,
                filament_g: filament_g,
                time_min: time_min,
                time_str: total_time_str,
                max_z: max_z,
                costs: costs,
                dimensions: slicepressViewer.getDimensions(),
                tier: data.tier || 'pro',
                quota: data.quota || null,
                job_id: data.job_id || null
            };

            showResults(lastResult);

            // Free tier: hide Add to Cart button, show upgrade hint
            var cartBtn = document.getElementById('slicepress-add-cart-btn');
            var upgradeHint = document.getElementById('slicepress-upgrade-hint');
            if (lastResult.tier === 'free') {
                if (cartBtn) cartBtn.style.display = 'none';
                if (upgradeHint) upgradeHint.style.display = '';
            } else {
                if (cartBtn) cartBtn.style.display = '';
                if (upgradeHint) upgradeHint.style.display = 'none';
            }

            btn.disabled = false;
            btn.textContent = 'Get Instant Quote';
        })
        .catch(function (err) {
            slicepressViewer.showError('Slicing error: ' + err.message);
            btn.disabled = false;
            btn.textContent = 'Get Instant Quote';
        });
    }

    function calculatePrice(filament_g, time_min, material) {
        var p = slicepress_config.pricing;
        var materialKey = material.toUpperCase();

        // Material cost (cents)
        var materialRate = p.pla_per_gram;
        if (materialKey === 'PETG') materialRate = p.petg_per_gram;
        var materialCost = materialRate * filament_g;

        // Electricity cost (cents)
        // electricity_rate = cents/kWh, printer_power = watts
        var electricityCost = p.electricity_rate * (time_min / 60) * p.printer_power / (100 * 60);

        // Printer hourly rate (cents)
        var printerCost = p.printer_hourly * (time_min / 60);

        // Minimum base price (cents)
        var minimum = p.minimum_price;

        // Raw total in cents
        var rawCents = materialCost + electricityCost + printerCost + minimum;

        // Apply multiplier
        var multiplier = p.multiplier || 1.0;
        var totalCents = rawCents * multiplier;

        // Round up to nearest cent, convert to currency units
        var toCurrency = function (cents) { return Math.ceil(cents) / 100; };

        return {
            material: toCurrency(materialCost),
            electricity: toCurrency(electricityCost),
            printer: toCurrency(printerCost),
            minimum: toCurrency(minimum),
            total: toCurrency(totalCents)
        };
    }

    function formatPrice(amount) {
        var sym = slicepress_config.currency_symbol || '';
        return sym + amount.toFixed(2);
    }

    function showResults(result) {
        var card = document.getElementById('slicepress-results-card');
        if (!card) return;

        var c = result.costs;
        setText('slicepress-res-material', formatPrice(c.material));
        setText('slicepress-res-electricity', formatPrice(c.electricity));
        setText('slicepress-res-printer', formatPrice(c.printer));
        setText('slicepress-res-minimum', formatPrice(c.minimum));
        setText('slicepress-res-total', formatPrice(c.total));
        setText('slicepress-res-time', result.time_str);
        setText('slicepress-res-filament', result.filament_g.toFixed(1));

        card.style.display = '';
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function getLastResult() {
        return lastResult;
    }

    return {
        init: init,
        getLastResult: getLastResult,
        calculatePrice: calculatePrice,
        formatPrice: formatPrice
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    if (typeof slicepress_config !== 'undefined') {
        SlicePress_Slicer.init();
    }
});
