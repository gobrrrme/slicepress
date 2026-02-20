<?php
/**
 * SlicePress — Inline Viewer Template
 *
 * Replaces the_content on the SlicePress page.
 * The theme handles header, navigation, footer — we only control
 * what goes inside the content area.
 */
defined('ABSPATH') || exit;
?>

<style>
    /* Full-width viewer — JS positions this precisely */
    .slicepress-fullpage {
        position: relative;
        height: 80vh;
        min-height: 500px;
        background: color-mix(in srgb, var(--slicepress-bg, #fff) 92%, gray);
    }

    /* Viewer fills entire container */
    .slicepress-viewer-area {
        position: absolute;
        inset: 0;
    }
    .slicepress-viewer-area #slicepress-viewer {
        width: 100%;
        height: 100%;
    }

    /* Left panel — upload, quote, results */
    .slicepress-panel-left {
        position: absolute;
        top: 20px;
        left: 20px;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 100;
        max-height: calc(100% - 40px);
        overflow-y: auto;
        scrollbar-width: none;
    }
    .slicepress-panel-left::-webkit-scrollbar { display: none; }

    /* Right panel — model info */
    .slicepress-panel-right {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 200px;
        z-index: 100;
    }

    /* Mobile: stack vertically */
    @media (max-width: 768px) {
        .slicepress-fullpage {
            height: auto;
            min-height: auto;
        }
        .slicepress-viewer-area {
            position: relative;
            height: 50vh;
            min-height: 300px;
        }
        .slicepress-panel-left,
        .slicepress-panel-right {
            position: relative;
            top: auto; left: auto; right: auto;
            width: auto;
            max-height: none;
            padding: 12px;
        }
    }
</style>

<div class="slicepress-fullpage">
    <!-- 3D Viewer (full background) -->
    <div class="slicepress-viewer-area">
        <div id="slicepress-viewer"></div>
        <div class="slicepress-hint" id="slicepress-hint">Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan</div>
        <div class="slicepress-drop-overlay" id="slicepress-drop-overlay">Drop file here</div>
        <div class="slicepress-loading-overlay" id="slicepress-loading-overlay">
            <div class="slicepress-spinner"></div>
            <div class="slicepress-loading-text">Loading model&hellip;</div>
        </div>
        <div class="slicepress-error" id="slicepress-error"></div>
    </div>

    <!-- Left floating panels -->
    <div class="slicepress-panel-left">

        <!-- Upload Card -->
        <div class="slicepress-card" id="slicepress-upload-card">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">1</span>
                <?php esc_html_e('Upload 3D Model', 'slicepress'); ?>
            </h3>
            <label class="slicepress-upload-label" for="slicepress-file-input">
                <?php esc_html_e('Drop STL / 3MF or click to upload', 'slicepress'); ?>
            </label>
            <input type="file" id="slicepress-file-input" class="slicepress-file-input" accept=".stl,.3mf">

            <div class="slicepress-view-buttons">
                <button type="button" class="slicepress-btn" onclick="slicepressViewer.viewIsometric()">Iso</button>
                <button type="button" class="slicepress-btn" onclick="slicepressViewer.viewFromTop()">Top</button>
                <button type="button" class="slicepress-btn" onclick="slicepressViewer.viewFromFront()">Front</button>
                <button type="button" class="slicepress-btn" onclick="slicepressViewer.viewFromSide()">Side</button>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block" onclick="slicepressViewer.resetView()"><?php esc_html_e('Reset View', 'slicepress'); ?></button>

            <div class="slicepress-toggle-row">
                <label class="slicepress-toggle">
                    <input type="checkbox" id="slicepress-wireframe" onchange="slicepressViewer.setWireframe(this.checked)">
                    <span class="slicepress-toggle-track"></span>
                    <span class="slicepress-toggle-text"><?php esc_html_e('Wireframe', 'slicepress'); ?></span>
                </label>
                <label class="slicepress-toggle">
                    <input type="checkbox" id="slicepress-autorotate" onchange="slicepressViewer.setAutoRotate(this.checked)">
                    <span class="slicepress-toggle-track"></span>
                    <span class="slicepress-toggle-text"><?php esc_html_e('Auto-rotate', 'slicepress'); ?></span>
                </label>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-accent" id="slicepress-orient-btn" onclick="slicepressViewer.autoOrient()" disabled><?php esc_html_e('Smart Orient', 'slicepress'); ?></button>
        </div>

        <!-- Slice & Quote Card -->
        <div class="slicepress-card" id="slicepress-slice-card">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">2</span>
                <?php esc_html_e('Get Instant Quote', 'slicepress'); ?>
            </h3>

            <div class="slicepress-form-group">
                <label for="slicepress-material"><?php esc_html_e('Material', 'slicepress'); ?></label>
                <select id="slicepress-material"></select>
            </div>

            <div class="slicepress-form-group">
                <label for="slicepress-quality"><?php esc_html_e('Print Quality', 'slicepress'); ?></label>
                <select id="slicepress-quality">
                    <option value="0.08mm Extra Fine">0.08mm Extra Fine</option>
                    <option value="0.12mm High Quality">0.12mm High Quality</option>
                    <option value="0.12mm Fine">0.12mm Fine</option>
                    <option value="0.20mm Standard" selected>0.20mm Standard</option>
                    <option value="0.20mm Strength">0.20mm Strength</option>
                    <option value="0.28mm Extra Draft">0.28mm Draft</option>
                </select>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-primary" id="slicepress-slice-btn" disabled><?php esc_html_e('Get Instant Quote', 'slicepress'); ?></button>
        </div>

        <!-- Results Card (hidden until quote) -->
        <div class="slicepress-card slicepress-results-card" id="slicepress-results-card" style="display:none;">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">3</span>
                <?php esc_html_e('Your Quote', 'slicepress'); ?>
            </h3>

            <div class="slicepress-result-row">
                <span><?php esc_html_e('Material Cost', 'slicepress'); ?></span>
                <span id="slicepress-res-material">-</span>
            </div>
            <div class="slicepress-result-row">
                <span><?php esc_html_e('Electricity', 'slicepress'); ?></span>
                <span id="slicepress-res-electricity">-</span>
            </div>
            <div class="slicepress-result-row">
                <span><?php esc_html_e('Printer Time', 'slicepress'); ?></span>
                <span id="slicepress-res-printer">-</span>
            </div>
            <div class="slicepress-result-row">
                <span><?php esc_html_e('Base Fee', 'slicepress'); ?></span>
                <span id="slicepress-res-minimum">-</span>
            </div>
            <div class="slicepress-result-row slicepress-result-total">
                <span><?php esc_html_e('Total', 'slicepress'); ?></span>
                <span id="slicepress-res-total">-</span>
            </div>

            <div class="slicepress-result-meta">
                <small><?php esc_html_e('Print time:', 'slicepress'); ?> <span id="slicepress-res-time">-</span></small>
                <small><?php esc_html_e('Filament:', 'slicepress'); ?> <span id="slicepress-res-filament">-</span> g</small>
            </div>

            <div class="slicepress-form-group">
                <label for="slicepress-color"><?php esc_html_e('Color', 'slicepress'); ?></label>
                <select id="slicepress-color"></select>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-primary" id="slicepress-add-cart-btn"><?php esc_html_e('Add to Cart', 'slicepress'); ?></button>
            <div id="slicepress-upgrade-hint" style="display:none; text-align:center; margin-top:8px;">
                <small style="color:var(--slicepress-muted);"><?php esc_html_e('Add to Cart requires a Pro subscription.', 'slicepress'); ?></small><br>
                <a href="https://slicepress.druckhochdrei.com/#pricing" target="_blank" class="slicepress-btn slicepress-btn-block slicepress-btn-accent" style="margin-top:6px;"><?php esc_html_e('Upgrade to Pro', 'slicepress'); ?></a>
            </div>
        </div>
    </div>

    <!-- Right floating panel — Model Info -->
    <div class="slicepress-panel-right">
        <div class="slicepress-card slicepress-stats-card" id="slicepress-stats-card">
            <h3 class="slicepress-card-title"><?php esc_html_e('Model Info', 'slicepress'); ?></h3>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size X</span><span class="slicepress-stat-value" id="slicepress-stat-x">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size Y</span><span class="slicepress-stat-value" id="slicepress-stat-y">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size Z</span><span class="slicepress-stat-value" id="slicepress-stat-z">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label"><?php esc_html_e('Triangles', 'slicepress'); ?></span><span class="slicepress-stat-value" id="slicepress-stat-tris">-</span></div>
        </div>
    </div>
</div>

<script>
/* Move viewer out of any constraining content wrapper.
   Find the narrowest ancestor and break out above it. */
(function() {
    var fp = document.querySelector('.slicepress-fullpage');
    if (!fp) return;

    // Leave a placeholder so the page flow isn't broken
    var placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    fp.parentNode.insertBefore(placeholder, fp);

    // Find the theme's main content wrapper (the narrowed container)
    // by walking up until we find an element that's full viewport width
    var target = fp.parentNode;
    while (target && target !== document.body) {
        var w = target.getBoundingClientRect().width;
        if (w >= window.innerWidth - 1) break;
        target = target.parentNode;
    }

    // Insert the viewer as a sibling right before the content wrapper
    if (target && target !== document.body && target.parentNode) {
        target.parentNode.insertBefore(fp, target);
    } else {
        // Fallback: insert after header-ish elements
        var header = document.querySelector('header, .site-header, #masthead, [role="banner"]');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(fp, header.nextSibling);
        }
    }

    // Now stretch to full width
    fp.style.width = '100vw';
    fp.style.maxWidth = '100vw';
    fp.style.marginLeft = '0';
    fp.style.marginRight = '0';
    fp.style.position = 'relative';
    fp.style.left = '0';
})();
</script>
