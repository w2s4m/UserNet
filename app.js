let networkData = JSON.parse(localStorage.getItem('networkData')) || [];
let currentRouterIndex = null;
let deferredPrompt;

window.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupPWA();
    setupNotifications();
});

function initApp() {
    renderRouters();
    updateStats();
    
    // مشغل وضع الثيم المتقدم
    const themeBtn = document.getElementById('themeToggle');
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
    });
}

function saveToStorage() {
    localStorage.setItem('networkData', JSON.stringify(networkData));
    updateStats();
}

// محرك الحسابات الذكي للفوترة التلقائية
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
    progress = Math.max(0, Math.min(100, progress)); // الحصر بين 0-100

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
            <button class="delete-action-btn" onclick="deleteRouter(event, ${idx})">🗑️</button>
            <h3>📶 ${router.name}</h3>
            <p style="margin-top:8px; font-size:0.85rem; color:var(--text-secondary)">الأجهزة المتصلة: ${router.devices.length}</p>
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
    document.getElementById('selectedRouterTitle').innerText = `📱 أجهزة راوتر: ${networkData[idx].name}`;
    renderDevices();
}

/* --- نظام الأجهزة والمشتركين والفلترة المتقدمة --- */
function openDeviceModal(editIdx = null) {
    if(editIdx !== null) {
        document.getElementById('deviceModalTitle').innerText = "تعديل بيانات المشترك 📝";
        document.getElementById('editDeviceIndex').value = editIdx;
        const dev = networkData[currentRouterIndex].devices[editIdx];
        document.getElementById('devOwner').value = dev.owner;
        document.getElementById('devMac').value = dev.mac;
        document.getElementById('devModel').value = dev.model;
        document.getElementById('devJoinDate').value = dev.joinDate;
        document.getElementById('devDuration').value = dev.duration;
        document.getElementById('devPayment').value = dev.payment;
    } else {
        document.getElementById('deviceModalTitle').innerText = "إضافة مشترك جديد ➕";
        document.getElementById('editDeviceIndex').value = "";
        document.getElementById('devOwner').value = "";
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
    const mac = document.getElementById('devMac').value.trim().toUpperCase();
    const model = document.getElementById('devModel').value.trim();
    const joinDate = document.getElementById('devJoinDate').value;
    const duration = document.getElementById('devDuration').value;
    const payment = document.getElementById('devPayment').value;
    const editIdx = document.getElementById('editDeviceIndex').value;

    if(!owner || !mac) return alert('يرجى كتابة الاسم والماك آدرس بدقة');

    const schema = { owner, mac, model, joinDate, duration, payment };

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

// 1. تحديث دالة renderDevices لتعرض زر الواتساب وفلتر التنبيهات
function renderDevices() {
    const list = document.getElementById('devicesList');
    list.innerHTML = '';
    if(currentRouterIndex === null) return;

    const query = document.getElementById('searchDevice').value.toLowerCase();
    const payFilter = document.getElementById('filterPayment').value;
    const statusFilter = document.getElementById('filterStatus').value;

    networkData[currentRouterIndex].devices.forEach((dev, idx) => {
        const billing = evaluateBilling(dev.joinDate, dev.duration);

        // محرك الفلترة والبحث المتقدم
        if(query && !dev.owner.toLowerCase().includes(query) && !dev.mac.toLowerCase().includes(query) && !dev.model.toLowerCase().includes(query)) return;
        if(payFilter !== 'all' && dev.payment !== payFilter) return;
        
        if(statusFilter !== 'all') {
            if(statusFilter === 'active' && !billing.isActive) return;
            if(statusFilter === 'expired' && billing.isActive) return;
            if(statusFilter === 'warning' && (!billing.isActive || billing.daysLeft > 3)) return; 
        }

        // تحديد شارة حالة الاشتراك الديناميكية
        let expiryBadge = '';
        if(!billing.isActive) {
            expiryBadge = `<span class="badge badge-danger">منتهي منذ ${Math.abs(billing.daysLeft)} يوم</span>`;
        } else if(billing.daysLeft <= 3) {
            expiryBadge = `<span class="badge badge-warning-critical">ينتهي قريباً (باقي ${billing.daysLeft} يوم) ⚠️</span>`;
        } else {
            expiryBadge = `<span class="badge badge-active">نشط (باقي ${billing.daysLeft} يوم)</span>`;
        }

        // إنشاء كرت الجهاز وضخ كود الـ HTML المتناسق الجديد
        const card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <h3 style="font-size:1.1rem;">👤 ${dev.owner}</h3>
                    ${expiryBadge}
                    <span class="badge" style="background:rgba(255,255,255,0.05);">${dev.payment}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:6px;">
                    HW: ${dev.model || 'غير معرّف'} | MAC: <code style="color:var(--accent)">${dev.mac}</code>
                </p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">تاريخ الانتهاء: ${billing.expiryDate}</p>
                <div class="billing-progress-container">
                    <div class="billing-progress-bar" style="width: ${billing.progress}%; background: ${billing.isActive ? (billing.daysLeft <= 3 ? 'var(--warning)' : 'var(--success)') : 'var(--danger)'}"></div>
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn btn-secondary" onclick="sendWhatsAppReminder('${dev.owner}', ${billing.daysLeft}, '${billing.expiryDate}')">تذكير 💬</button>
                <button class="btn btn-secondary" onclick="openDeviceModal(${idx})">تعديل 📝</button>
                <button class="btn btn-danger" onclick="deleteDevice(${idx})">حذف 🗑️</button>
            </div>
        `;
        list.appendChild(card);
    });

    if(list.innerHTML === '') {
        list.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:20px;">لا يوجد أجهزة مطابقة للفلترة الحالية.</p>';
    }
}

// 2. دالة توليد رسائل الواتساب وإرسالها تلقائياً
function sendWhatsAppReminder(ownerName, daysLeft, expiryDate) {
    let message = "";
    
    if (daysLeft < 0) {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك قد انتهى وصلاحية الحساب متوقفة حالياً. يرجى التواصل معنا لتجديد الاشتراك وسداد الرسوم. شكراً لك!`;
    } else if (daysLeft == 0) {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك ينتهي اليوم الماوفق ${expiryDate}. يرجى التجديد لضمان استمرار الخدمة دون انقطاع. شكراً لك!`;
    } else {
        message = `مرحباً أخي ${ownerName}، نود تذكيرك بأن اشتراك الإنترنت الخاص بك أوشك على الانتهاء (متبقي ${daysLeft} أيام فقط وينتهي بتاريخ ${expiryDate}). يرجى الترتيب للتجديد قريباً. شكراً لك!`;
    }
    
    // ترميز النص ليتوافق مع الروابط الذكية للواتساب
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    // فتح الواتساب ليقوم المستخدم باختيار الشخص وإرسال الرسالة الجاهزة له مباشرة
    window.open(whatsappUrl, '_blank');
}

// 3. تحديث نظام فحص الإشعارات اليومي ليعطي تقريراً منبثقاً ذكياً
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

    // إرسال إشعار للنظام إذا وُجدت أجهزة حرجة
    if ((criticalCount > 0 || expiredCount > 0) && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('مركز التحكم: تنبيه الاشتراكات ⚠️', {
                body: `لديك (${criticalCount}) مشتركين أوشكت باقاتهم على الانتهاء، و (${expiredCount}) اشتراكات منتهية بالفعل تحتاج مراجعة.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3050/3050449.png',
                vibrate: [300, 100, 300],
                badge: 'https://cdn-icons-png.flaticon.com/512/3050/3050449.png'
            });
        });
    }
}

/* --- محرك النسخ الاحتياطي (Backup) --- */
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

/* --- متطلبات الـ PWA والتثبيت --- */
function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker Registered'));
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

/* --- محرك الإشعارات (Push-like Notifications) --- */
function setupNotifications() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                checkForExpiredSubscribers();
            }
        });
    }
}

function checkForExpiredSubscribers() {
    let expiredCount = 0;
    networkData.forEach(r => {
        r.devices.forEach(d => {
            const b = evaluateBilling(d.joinDate, d.duration);
            if (!b.isActive && Math.abs(b.daysLeft) <= 1) { // منتهي حديثاً اليوم
                expiredCount++;
            }
        });
    });

    if (expiredCount > 0) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('تنبيه الفوترة الذكي', {
                body: `يوجد لديك ${expiredCount} اشتراكات انتهت صلاحيتها اليوم، يرجى مراجعة اللوحة.`,
                icon: 'icon.png',
                vibrate: [200, 100, 200]
            });
        });
    }
}
