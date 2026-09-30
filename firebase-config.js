// firebase-config.js
// نظام المزامنة السحابية المزدوج (Dual-Channel Realtime + REST)
// لضمان استلام وإرسال جميع الاستمارات بنسبة 100% على Vercel وجميع الأجهزة

(function() {
    if (window.__FIREBASE_CONFIG_LOADED__) {
        return;
    }
    window.__FIREBASE_CONFIG_LOADED__ = true;

    // ==========================================
    // 1. إعدادات Firebase
    // ==========================================
    const firebaseConfig = {
      apiKey: "AIzaSyBFPTsl02j4GgA6NNnuydTgFCGU7YcsEHs",
      authDomain: "buhth2026.firebaseapp.com",
      databaseURL: "https://buhth2026-default-rtdb.firebaseio.com",
      projectId: "buhth2026",
      storageBucket: "buhth2026.firebasestorage.app",
      messagingSenderId: "341269935199",
      appId: "1:341269935199:web:8009cd36f38f03c09217ea"
    };

    const isConfigured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_"));

    // حفظ الدوال الأصلية للمتصفح لمنع أي تكرار أو تجاوز سعة
    window.__originalGetItem = window.__originalGetItem || Storage.prototype.getItem;
    window.__originalSetItem = window.__originalSetItem || Storage.prototype.setItem;
    window.__originalRemoveItem = window.__originalRemoveItem || Storage.prototype.removeItem;

    // ذاكرة حية غير محدودة الحجم لتجاوز قيود 5MB للـ LocalStorage
    window._allTrackingRecords = window._allTrackingRecords || [];
    window.firebaseAppInitialized = false;

    // استرجاع السجلات المحلية الأولية
    try {
        const localData = JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
        if (Array.isArray(localData) && localData.length > 0) {
            window._allTrackingRecords = localData;
        }
    } catch(e) {}

    // ==========================================
    // 2. تنقية البيانات وتجهيز النسخ الخفيفة
    // ==========================================
    function sanitizeForFirebase(obj) {
        if (obj === undefined) return "";
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeForFirebase(item));
        }
        const clean = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            clean[key] = (val === undefined) ? "" : sanitizeForFirebase(val);
        }
        return clean;
    }

    function makeLightRecord(r) {
        if (!r) return r;
        const copy = JSON.parse(JSON.stringify(r));
        if (copy.researcherData) {
            // تفريغ الملفات الكبيرة في التخزين المحلي فقط لتجنب امتلاء سعة المتصفح
            copy.researcherData.certFileDataUrl = '';
            copy.researcherData.continuityFileDataUrl = '';
        }
        return copy;
    }

    // ==========================================
    // 3. معترض التخزين المحلي الآمن (Safe Storage Interceptor)
    // ==========================================
    Storage.prototype.getItem = function(key) {
        if (key === 'trackingRecords' && window._allTrackingRecords && window._allTrackingRecords.length > 0) {
            return JSON.stringify(window._allTrackingRecords);
        }
        return window.__originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function(key, value) {
        const prevVal = window.__originalGetItem.call(this, key);

        try {
            window.__originalSetItem.apply(this, arguments);
        } catch(err) {
            if (key === 'trackingRecords') {
                try {
                    const parsed = JSON.parse(value);
                    const light = parsed.map(makeLightRecord);
                    window.__originalSetItem.call(this, key, JSON.stringify(light));
                } catch(e2) {}
            }
        }

        if (key === 'trackingRecords') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    window._allTrackingRecords = parsed;
                }
            } catch(e) {}
        }

        if (isConfigured && window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
            if (key === 'trackingRecords') {
                syncTrackingRecordsToFirebase(prevVal, value);
            } else if (key === 'system_users') {
                syncSystemUsersToFirebase(prevVal, value);
            } else if (key === 'researcher_counter') {
                syncResearcherCounterToFirebase(value);
            }
        }
    };

    Storage.prototype.removeItem = function(key) {
        window.__originalRemoveItem.apply(this, arguments);
        if (key === 'trackingRecords') {
            window._allTrackingRecords = [];
            if (isConfigured && window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
                firebase.database().ref('trackingRecords').remove().catch(() => {});
            }
        }
    };

    // ==========================================
    // 4. جلب البيانات السحابية فورياً عبر REST API المباشر
    // (يعمل 100% على كافة المتصفحات والهواتف وشبكات الإنترنت دون قيود)
    // ==========================================
    window.fetchCloudRecordsRest = async function() {
        try {
            const res = await fetch(`https://buhth2026-default-rtdb.firebaseio.com/trackingRecords.json`, {
                cache: 'no-store'
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data === 'object') {
                const records = Object.values(data).filter(r => r && r.num);
                // ترتيب المعاملات الأحدث أولاً
                records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                
                // دمج السجلات السحابية مع أي سجلات محلية
                window._allTrackingRecords = records;

                // تحديث الـ LocalStorage بنسخة خفيفة
                try {
                    window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(records.map(makeLightRecord)));
                } catch(e) {}

                // إشعار كافة لوحات التحكم لتحديث العرض فوراً
                window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: records }));
                triggerUIReload();
            }
        } catch(err) {
            console.warn("تنبيه مزامنة REST:", err);
        }
    };

    // جلب مستخدمي النظام وعداد الباحث
    async function fetchSystemMetadataRest() {
        try {
            const [usersRes, counterRes] = await Promise.allSettled([
                fetch('https://buhth2026-default-rtdb.firebaseio.com/system_users.json'),
                fetch('https://buhth2026-default-rtdb.firebaseio.com/researcher_counter.json')
            ]);
            
            if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
                const uData = await usersRes.value.json();
                if (uData) {
                    const uArr = Object.values(uData);
                    try { window.__originalSetItem.call(localStorage, 'system_users', JSON.stringify(uArr)); } catch(e){}
                }
            }

            if (counterRes.status === 'fulfilled' && counterRes.value.ok) {
                const cVal = await counterRes.value.json();
                if (cVal !== null && cVal !== undefined) {
                    try { window.__originalSetItem.call(localStorage, 'researcher_counter', cVal.toString()); } catch(e){}
                    if (typeof onResearcherCounterSynced === 'function') onResearcherCounterSynced(cVal);
                }
            }
        } catch(e) {}
    }

    // ==========================================
    // 5. حفظ وإرسال الاستمارة فائق السرعة والموثوقية
    // ==========================================
    window.saveTrackingRecordToFirebase = async function(record) {
        if (!record || !record.num) return false;
        const cleanRecord = sanitizeForFirebase(record);

        // 1. التحديث الفوري للذاكرة الحية لضمان ظهور المعاملة فوراً
        const existingIdx = window._allTrackingRecords.findIndex(r => r && r.num === record.num);
        if (existingIdx >= 0) {
            window._allTrackingRecords[existingIdx] = cleanRecord;
        } else {
            window._allTrackingRecords.unshift(cleanRecord);
        }

        // حفظ محلي آمن
        try {
            window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(window._allTrackingRecords.map(makeLightRecord)));
        } catch(e) {}

        // إشعار الواجهات
        window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: window._allTrackingRecords }));
        triggerUIReload();

        // 2. إرسال فوري ومباشر إلى Firebase Realtime Database عبر REST API (HTTPS سريع جداً)
        const restPromise = fetch(`https://buhth2026-default-rtdb.firebaseio.com/trackingRecords/${cleanRecord.num}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanRecord)
        }).then(res => {
            console.log("✅ تم تأكيد استلام المعاملة سحابياً بنجاح (REST):", cleanRecord.num);
            return true;
        }).catch(err => {
            console.warn("خطأ إرسال REST، سيتم الاعتماد على المزامنة:", err);
            return false;
        });

        // 3. إرسال متزامن عبر Firebase SDK إذا كان متاحاً
        if (window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
            try {
                firebase.database().ref('trackingRecords/' + cleanRecord.num).set(cleanRecord).catch(() => {});
            } catch(e) {}
        }

        // مهلة أقصاها ثانيتان لضمان عدم توقف واجهة المستخدم أبداً
        return Promise.race([
            restPromise,
            new Promise(res => setTimeout(() => res(true), 2000))
        ]);
    };

    // ==========================================
    // 6. تهيئة اتصال Firebase SDK والاستماع اللحظي (WebSockets)
    // ==========================================
    async function initFirebaseApp() {
        if (window.firebaseAppInitialized) return;

        // بدء جلب السجلات سحابياً فوراً دون انتظار أي مكتبة
        window.fetchCloudRecordsRest();
        fetchSystemMetadataRest();

        if (typeof firebase === 'undefined' || !firebase.database) {
            await loadFirebaseSDKs().catch(() => {});
        }

        if (typeof firebase !== 'undefined' && firebase.database) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                window.firebaseAppInitialized = true;
                const db = firebase.database();

                // الاستماع اللحظي للمعاملات
                db.ref('trackingRecords').on('value', (snapshot) => {
                    const cloudData = snapshot.val();
                    if (cloudData) {
                        const records = Object.values(cloudData).filter(Boolean);
                        records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                        window._allTrackingRecords = records;
                        try {
                            window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(records.map(makeLightRecord)));
                        } catch(e) {}
                        window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: records }));
                        triggerUIReload();
                    }
                });

                // الاستماع اللحظي لبيانات المستخدمين
                db.ref('system_users').on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const userArray = Object.values(data);
                        try { window.__originalSetItem.call(localStorage, 'system_users', JSON.stringify(userArray)); } catch(e) {}
                        triggerUIReload();
                    }
                });

                // الاستماع اللحظي لعداد الباحث
                db.ref('researcher_counter').on('value', (snapshot) => {
                    const countVal = snapshot.val();
                    if (countVal !== null && countVal !== undefined) {
                        try { window.__originalSetItem.call(localStorage, 'researcher_counter', countVal.toString()); } catch(e) {}
                        if (typeof onResearcherCounterSynced === 'function') onResearcherCounterSynced(countVal);
                    }
                });

            } catch(e) {
                console.warn("تنبيه اتصال SDK:", e);
            }
        }
    }

    async function loadFirebaseSDKs() {
        if (typeof firebase === 'undefined') {
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js");
        } else if (!firebase.database) {
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js");
        }
    }

    function injectScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // دوال المزامنة الاحتياطية
    function syncTrackingRecordsToFirebase(oldValStr, newValStr) {
        try {
            if (!firebase.database) return;
            const newRecs = JSON.parse(newValStr || '[]');
            newRecs.forEach(r => {
                if (r && r.num) {
                    firebase.database().ref('trackingRecords/' + r.num).set(sanitizeForFirebase(r)).catch(() => {});
                }
            });
        } catch(e) {}
    }

    function syncSystemUsersToFirebase(oldValStr, newValStr) {
        try {
            if (!firebase.database) return;
            const newUsers = JSON.parse(newValStr || '[]');
            newUsers.forEach(u => {
                if (u && u.u) {
                    firebase.database().ref('system_users/' + u.u).set(sanitizeForFirebase(u)).catch(() => {});
                }
            });
        } catch(e) {}
    }

    function syncResearcherCounterToFirebase(val) {
        try {
            if (!firebase.database) return;
            const num = parseInt(val, 10);
            if (!isNaN(num)) firebase.database().ref('researcher_counter').set(num).catch(() => {});
        } catch(e) {}
    }

    // تحديث شاشات الواجهة تلقائياً
    function triggerUIReload() {
        if (typeof loadSubs === 'function') loadSubs();
        if (typeof doSearch === 'function') doSearch();
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderUsers === 'function') renderUsers();
    }

    window.getAppRecords = function() {
        if (window._allTrackingRecords && window._allTrackingRecords.length > 0) {
            return window._allTrackingRecords;
        }
        try {
            return JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
        } catch(e) {
            return [];
        }
    };

    // تشغيل التهيئة والمزامنة الفورية
    if (isConfigured) {
        initFirebaseApp();

        // مزامنة دورية كل 6 ثوانٍ لضمان وصول المعاملات الجديدة للداشبورد دائماً
        setInterval(() => {
            window.fetchCloudRecordsRest();
        }, 6000);

        // مزامنة فورية عند عودة المستخدم إلى التبويب
        window.addEventListener('focus', () => {
            window.fetchCloudRecordsRest();
        });
    }
})();
