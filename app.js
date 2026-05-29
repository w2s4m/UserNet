let networkData = JSON.parse(localStorage.getItem('networkData')) || [];
let currentRouterIndex = null;
let deferredPrompt;
let newWorker;

window.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupPWA();
    setupNotifications();
    initSystemStatusBar(); // تشغيل شريط الحالة الذكي المطور
    initVersionControl();   // تشغيل نظام الإصدارات المخزن للوحة التذييل
});

function initApp() {
    renderRouters();
    updateStats();
    
    const themeBtn = document.getElementById('themeToggle');
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
        const icon = themeBtn.querySelector('i');
        if(document.body.classList.contains('light-mode')) {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    });
}

// --- نظام التحكم بالإصدار الحالي (تعديل مباشر وحفظ أوفلاين) ---
function initVersionControl() {
    let savedVersion = localStorage.getItem('appVersion') || "1.0";
    document.getElementById('app-version-display').innerText = savedVersion;
    document.getElementById('versionInput').value = savedVersion;
}

function updateVersionNumber() {
    const newVer = document.getElementById('versionInput').value.trim();
    if(!newVer) return alert('الرجاء إدخال رقم إصدار صالح');
    localStorage.setItem('appVersion', newVer);
    document.getElementById('app-version-display').innerText = newVer;
    closeModal('versionModal');
}

// --- محرك شريط النظام الذكي (الوقت، التاريخ، حالة النت، نوع الجوال) ---
function initSystemStatusBar() {
    // 1. تحديث مباشر للوقت والتاريخ ثانية بثانية
    setInterval(() => {
        const now = new Date();
        document.getElementById('sys-time').innerText = now.toLocaleTimeString('ar-EG');
    }, 1000);

    const today = new Date();
    document.getElementById('sys-date').innerText = today.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // 2. فحص حالة الاتصال بالإنترنت (متصل / غير متصل)
    function updateOnlineStatus() {
        const netStatus = document.getElementById('net-status');
        if (navigator.onLine) {
            netStatus.innerHTML = '<i class="fa-solid fa-circle" style="color:var(--success)"></i> متصل بالإنترنت';
        } else {
            netStatus.innerHTML = '<i class="fa-solid fa-circle" style="color:var(--danger)"></i> غير متصل (أوفلاين)';
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 3. التعرّف الذكي على نوع الجوال المفتوح منه النظام
    const ua = navigator.userAgent;
    let deviceName = "كمبيوتر / غير معرف";
    if (/iPhone/i.test(ua)) deviceName = "iPhone 📱";
    else if (/iPad/i.test(ua)) deviceName = "iPad 🍏";
    else if (/Android/i.test(ua)) deviceName = "Android 🤖";
    document.getElementById('sys-device').innerText = deviceName;

    // 4. قراءة نوع وجودة الاتصال بالشبكة
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        document.getElementById('sys-net-type').innerText = `${conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Wi-Fi'}`;
    } else {
        document.getElementById('sys-net-type').innerText = "Wi-Fi نشط";
    }
}

function saveToStorage() {
    localStorage.setItem('networkData', JSON.stringify(networkData));
    updateStats();
}

function evaluateBilling(joinDateStr, durationDays) {
    const start = new Date(joinDateStr);
    const duration = parseInt(durationDays) || 0;
    const expiry = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    start.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);

    const totalPeriod = expiry - start;
    const currentPassed = today - start;
    
    let progress = 100 - Math.round((currentPassed / totalPeriod) * 100);
    progress = Math.max(0, Math.min(100, progress));

    const diffTime = expiry - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        expiryDate: expiry.toISOString().split('T')[0],
        daysLeft: daysLeft,
        progress: progress,
        isActive: daysLeft >= 0
    };
}

function updateStats() {
    document.getElementById('stat-routers').innerText = networkData.length;
    let totalDevices = 0;
    let activeSubs = 0;
    let expiredSubs = 0;

    networkData.forEach(r => {
        totalDevices += r.devices.length;
        r.devices.forEach(d => {
            const billing = evaluateBilling(d.joinDate, d.duration);
            if(billing.isActive) activeSubs++; else expiredSubs++;
        });
    });

    document.getElementById('stat-devices').innerText = totalDevices;
    document.getElementById('stat-active').innerText = activeSubs;
    document.getElementById('stat-expired').innerText = expiredSubs;
}

/* --- نظام الـ Routers --- */
function renderRouters() {
    const grid = document.getElementById('routersGrid');
    grid.innerHTML = '';
    networkData.forEach((router, idx) => {
        const card = document.createElement('div');
        card.className = `router-card ${currentRouterIndex === idx ? 'active' : ''}`;
        card.onclick = () => selectRouter(idx);
        card.innerHTML = `
            <button class="delete-action-btn" onclick="deleteRouter(event, ${idx})"><i class="fa-solid fa-trash-can"></i></button>
            <h3><i class="fa-solid fa-router" style="color:var(--accent); margin-left:8px;"></i> ${router.name}</h3>
            <p style="margin-top:12px; font-size:0.85rem; color:var(--text-secondary)">الأجهزة المتصلة: ${router.devices.length}</p>
        `;
        grid.appendChild(card);
    });
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function saveRouter() {
    const name = document.getElementById('routerName').value.trim();
    if(!name) return;
    networkData.push({ name: name, devices: [] });
    saveToStorage();
    renderRouters();
    closeModal('routerModal');
    document.getElementById('routerName').value = '';
}

function deleteRouter(e, idx) {
    e.stopPropagation();
    if(confirm('هل تود مسح الراوتر وكافة بيانات المستخدمين داخله نهائياً؟')) {
        networkData.splice(idx, 1);
        if(currentRouterIndex === idx) {
            document.getElementById('devicesSection').style.display = 'none';
            currentRouterIndex = null;
        }
        saveToStorage();
        renderRouters();
    }
}

function selectRouter(idx) {
    currentRouterIndex = idx;
    renderRouters();
    document.getElementById('devicesSection').style.display = 'block';
    document.getElementById('selectedRouterTitle').innerHTML = `<i class="fa-solid fa-laptop-network"></i> أجهزة راوتر: ${networkData[idx].name}`;
    renderDevices();
}

/* --- نظام الأجهزة والمشتركين مصلح بالكامل --- */
function openDeviceModal(editIdx = null) {
    if(editIdx !== null) {
        document.getElementById('deviceModalTitle').innerHTML = "<i class='fa-solid fa-user-pen'></i> تعديل بيانات المشترك";
        document.getElementById('editDeviceIndex').value = editIdx;
        const dev = networkData[currentRouterIndex].devices[editIdx];
        document.getElementById('devOwner').value = dev.owner;
        document.getElementById('devPhone').value = dev.phone || "";
        document.getElementById('devMac').value = dev.mac;
        document.getElementById('devModel').value = dev.model;
        document.getElementById('devJoinDate').value = dev.joinDate;
        document.getElementById('devDuration').value = dev.duration;
        document.getElementById('devPayment').value = dev.payment;
    } else {
        document.getElementById('deviceModalTitle').innerHTML = "<i class='fa-solid fa-user-plus'></i> إضافة مشترك جديد";
        document.getElementById('editDeviceIndex').value = "";
        document.getElementById('devOwner').value = "";
        document.getElementById('devPhone').value = "";
        document.getElementById('devMac').value = "";
        document.getElementById('devModel').value = "";
        document.getElementById('devJoinDate').valueAsDate = new Date();
        document.getElementById('devDuration').value = "30";
        document.getElementById('devPayment').value = "واصل";
    }
    openModal('deviceModal');
}

function saveDevice() {
    const owner = document.getElementById('devOwner').value.trim();
    const phone = document.getElementById('devPhone').value.trim();
    const mac = document.getElementById('devMac').value.trim().toUpperCase();
    const model = document.getElementById('devModel').value.trim();
    const joinDate = document.getElementById('devJoinDate').value;
    const duration = document.getElementById('devDuration').value;
    const payment = document.getElementById('devPayment').value;
    const editIdx = document.getElementById('editDeviceIndex').value;

    if(!owner || !mac) return alert('يرجى كتابة الاسم والماك آدرس بدقة');

    const schema = { owner, phone, mac, model, joinDate, duration, payment };

    if(editIdx !== "") networkData[currentRouterIndex].devices[editIdx] = schema;
    else networkData[currentRouterIndex].devices.push(schema);

    saveToStorage();
    renderDevices();
    closeModal('deviceModal');
}

function deleteDevice(idx) {
    if(confirm('حذف هذا العميل نهائياً من النظام؟')) {
        networkData[currentRouterIndex].devices.splice(idx, 1);
        saveToStorage();
        renderDevices();
    }
}

function renderDevices() {
    const list = document.getElementById('devicesList');
    list.innerHTML = '';
    if(currentRouterIndex === null) return;

    const query = document.getElementById('searchDevice').value.toLowerCase();
    const payFilter = document.getElementById('filterPayment').value;
    const statusFilter = document.getElementById('filterStatus').value;

    networkData[currentRouterIndex].devices.forEach((dev, idx) => {
        const billing = evaluateBilling(dev.joinDate, dev.duration);

        if(query && !dev.owner.toLowerCase().includes(query) && !dev.mac.toLowerCase().includes(query) && !dev.model.toLowerCase().includes(query)) return;
        if(payFilter !== 'all' && dev.payment !== payFilter) return;
        
        if(statusFilter !== 'all') {
            if(statusFilter === 'active' && !billing.isActive) return;
            if(statusFilter === 'expired' && billing.isActive) return;
            if(statusFilter === 'warning' && (!billing.isActive || billing.daysLeft > 3)) return; 
        }

        let expiryBadge = '';
        if(!billing.isActive) {
            expiryBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> منتهي منذ ${Math.abs(billing.daysLeft)} يوم</span>`;
        } else if(billing.daysLeft <= 3) {
            expiryBadge = `<span class="badge badge-warning-critical"><i class="fa-solid fa-triangle-exclamation"></i> متبقي ${billing.daysLeft} يوم فقط!</span>`;
        } else {
            expiryBadge = `<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> نشط (باقي ${billing.daysLeft} يوم)</span>`;
        }

        const card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <h3 style="font-size:1.1rem;"><i class="fa-solid fa-user" style="color:var(--text-secondary); margin-left:6px;"></i> ${dev.owner}</h3>
                    ${expiryBadge}
                    <span class="badge" style="background:rgba(255,255,255,0.04); color:var(--text-primary); border:1px solid var(--border-color);">${dev.payment}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:8px;">
                    <i class="fa-solid fa-mobile-screen"></i> الجوال: ${dev.model || 'غير معرّف'} | <i class="fa-solid fa-fingerprint"></i> MAC: <code style="color:var(--accent)">${dev.mac}</code>
                </p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;"><i class="fa-solid fa-calendar-days"></i> نهاية الاشتراك: ${billing.expiryDate}</p>
                <div class="billing-progress-container">
                    <div class="billing-progress-bar" style="width: ${billing.progress}%; background: ${billing.isActive ? (billing.daysLeft <= 3 ? 'var(--warning)' : 'var(--success)') : 'var(--danger)'}"></div>
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn btn-secondary" style="color:#25D366; border-color:rgba(37,211,102,0.2);" onclick="sendWhatsAppReminder('${dev.owner}', ${billing.daysLeft}, '${billing.expiryDate}', '${dev.phone || ""}')"><i class="fa-brands fa-whatsapp"></i> تذكير</button>
                <button class="btn btn-secondary" onclick="openDeviceModal(${idx})"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
                <button class="btn btn-danger" onclick="deleteDevice(${idx})"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        list.appendChild(card);
    });

    if(list.innerHTML === '') {
        list.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:20px;">لا يوجد أجهزة مطابقة للفلترة الحالية.</p>';
    }
}

function sendWhatsAppReminder(ownerName, daysLeft, expiryDate, phoneNumber) {
    let message = "";
    
    if (daysLeft < 0) {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك قد انتهى وصلاحية الحساب متوقفة حالياً. يرجى التواصل معنا لتجديد الاشتراك وسداد الرسوم. شكراً لك!`;
    } else if (daysLeft == 0) {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك ينتهي اليوم الموافق ${expiryDate}. يرجى التجديد لضمان استمرار الخدمة دون انقطاع. شكراً لك!`;
    } else {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك أوشك على الانتهاء (متبقي ${daysLeft} أيام فقط وينتهي بتاريخ ${expiryDate}). يرجى الترتيب للتجديد قريباً. شكراً لك!`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    let whatsappUrl = "";
    
    if(phoneNumber && phoneNumber.trim() !== "") {
        let cleanNumber = phoneNumber.trim().replace(/[+\s\-]/g, '');
        whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedMessage}`;
    } else {
        whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    }
    
    window.open(whatsappUrl, '_blank');
}

function checkForExpiredSubscribers() {
    let criticalCount = 0;
    let expiredCount = 0;

    networkData.forEach(r => {
        r.devices.forEach(d => {
            const b = evaluateBilling(d.joinDate, d.duration);
            if (!b.isActive) {
                expiredCount++;
            } else if (b.daysLeft <= 3) {
                criticalCount++;
            }
        });
    });

    if ((criticalCount > 0 || expiredCount > 0) && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('مركز التحكم: تنبيه الاشتراكات ⚠️', {
                body: `لديك (${criticalCount}) مشتركين باقاتهم تنتهي قريباً، و (${expiredCount}) اشتراكات منتهية تحتاج مراجعة.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3050/3050449.png',
                vibrate: [300, 100, 300],
                badge: 'https://cdn-icons-png.flaticon.com/512/3050/3050449.png'
            });
        });
    }
}

function exportData() {
    const blob = new Blob([JSON.stringify(networkData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Network_Backup_2026.json`;
    a.click();
}

function importData(e) {
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if(Array.isArray(data)) {
                networkData = data;
                saveToStorage();
                renderRouters();
                document.getElementById('devicesSection').style.display = 'none';
                alert('تم استيراد قاعدة البيانات بنجاح!');
            }
        } catch(c) { alert('الملف المرفوع تالف أو غير صالح'); }
    };
    reader.readAsText(e.target.files[0]);
}

/* --- محرك الـ PWA والتحديث التلقائي الذكي فور توفر الإنترنت --- */
function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            // فحص وجود كود جديد على السيرفر الرئيسي للموقع بشكل دوري وعند الفتح بالنت
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // إظهار بانر التحديث فوراً للمستخدم لإنعاش الكاش
                        document.getElementById('update-banner').style.display = 'flex';
                    }
                });
            });
        });

        // تشغيل آلية التحديث الفوري عند النقر
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }

    const installBtn = document.getElementById('installBtn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'inline-block';
    });

    installBtn.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            });
        }
    });
}

function applyAppUpdate() {
    if (newWorker) {
        newWorker.postMessage({ action: 'skipWaiting' });
    } else {
        window.location.reload();
    }
}

function setupNotifications() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                checkForExpiredSubscribers();
            }
        });
    }
}
