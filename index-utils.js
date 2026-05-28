    window.__customConfirmCallback = null;
    window.showCustomAlert = function(message) { const modal = document.getElementById('custom-alert'); const msg = document.getElementById('custom-alert-message'); if (msg) msg.innerText = message || ''; if (modal) modal.style.display = 'flex'; lucide.createIcons(); };
    window.closeCustomAlert = function() { const modal = document.getElementById('custom-alert'); if (modal) modal.style.display = 'none'; };
    window.showCustomConfirm = function(message, onConfirm, options = {}) {
        const modal = document.getElementById('custom-confirm'); const msg = document.getElementById('custom-confirm-message'); const okBtn = document.getElementById('custom-confirm-ok-btn'); const cancelBtn = document.getElementById('custom-confirm-cancel-btn'); const iconWrap = document.getElementById('custom-confirm-icon-wrap'); const icon = document.getElementById('custom-confirm-icon');
        window.__customConfirmCallback = onConfirm; if (msg) msg.innerText = message || ''; if (cancelBtn) cancelBtn.innerText = options.cancelText || '아니오';
        if (okBtn) { okBtn.innerText = options.okText || '네'; okBtn.style.backgroundColor = options.okBg || '#FF3B30'; okBtn.style.color = '#FFFFFF'; okBtn.onmouseenter = () => { okBtn.style.backgroundColor = options.okHoverBg || options.okBg || '#D93025'; }; okBtn.onmouseleave = () => { okBtn.style.backgroundColor = options.okBg || '#FF3B30'; }; okBtn.onclick = async () => { const callback = window.__customConfirmCallback; window.closeCustomConfirm(); if (typeof callback === 'function') await callback(); }; }
        if (iconWrap) { iconWrap.style.backgroundColor = options.iconBg || '#FFF5F5'; iconWrap.style.borderColor = options.iconBorder || '#E8D8D8'; iconWrap.style.color = options.iconColor || '#A06C6C'; }
        if (icon) { icon.setAttribute('data-lucide', options.icon || 'trash-2'); } if (modal) modal.style.display = 'flex'; lucide.createIcons();
    };
    window.closeCustomConfirm = function() { const modal = document.getElementById('custom-confirm'); if (modal) modal.style.display = 'none'; window.__customConfirmCallback = null; };
    lucide.createIcons();
